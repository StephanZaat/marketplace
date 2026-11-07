import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import api from "../api";
import { useLang } from "../contexts/LanguageContext";

export const MAX_PHOTOS = 10;

export type SavedPhoto = { id: string; kind: "saved"; url: string };
export type NewPhoto = {
  id: string;
  kind: "new";
  file: File;
  preview: string; // blob: URL, revoked once the server thumbnail is shown
  thumbnail?: string;
  status: "uploading" | "done" | "error";
  progress: number;
  key?: string;
};
export type Photo = SavedPhoto | NewPhoto;

interface UploadResponse {
  key: string;
  url: string;
  thumbnail: string;
}

const newId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export const photoSrc = (p: Photo) => (p.kind === "saved" ? p.url : p.thumbnail ?? p.preview);

/** Ordered image references for the listing payload: saved URLs and finished upload keys. */
export function imageRefs(photos: Photo[]): string[] {
  return photos.flatMap((p) => {
    if (p.kind === "saved") return [p.url];
    return p.status === "done" && p.key ? [p.key] : [];
  });
}

export function movePhoto<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Photo state for the listing form. New files upload to /uploads as soon as they are added;
 * the listing is later saved with `refs` (saved URLs + upload keys, in display order).
 * `listingId` enables immediate removal of already-saved images (edit mode).
 */
export function usePhotoUploads(listingId?: string) {
  const { t } = useLang();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const photosRef = useRef(photos);
  photosRef.current = photos;
  const controllers = useRef(new Map<string, AbortController>());

  const patchNew = useCallback((id: string, changes: Partial<NewPhoto>) => {
    setPhotos((prev) => prev.map((p) => (p.id === id && p.kind === "new" ? { ...p, ...changes } : p)));
  }, []);

  const upload = useCallback(
    async (photo: NewPhoto) => {
      const ctrl = new AbortController();
      controllers.current.set(photo.id, ctrl);
      patchNew(photo.id, { status: "uploading", progress: 0 });
      const form = new FormData();
      form.append("file", photo.file);
      try {
        const res = await api.post<UploadResponse>("/uploads", form, {
          signal: ctrl.signal,
          onUploadProgress: (e) => {
            if (e.total) patchNew(photo.id, { progress: Math.round((e.loaded / e.total) * 100) });
          },
        });
        const { key, thumbnail } = res.data;
        patchNew(photo.id, { status: "done", progress: 100, key, thumbnail });
        URL.revokeObjectURL(photo.preview);
      } catch {
        if (ctrl.signal.aborted) return; // removed while uploading
        patchNew(photo.id, { status: "error" });
        toast.error(t.failedToUpload.replace("{name}", photo.file.name));
      } finally {
        controllers.current.delete(photo.id);
      }
    },
    [patchNew, t],
  );

  const addFiles = useCallback(
    (files: FileList | File[] | null) => {
      if (!files) return;
      const list = Array.from(files);
      const allowed = list.slice(0, Math.max(0, MAX_PHOTOS - photosRef.current.length));
      if (allowed.length < list.length) toast.error(t.maxPhotos);
      const added: NewPhoto[] = allowed.map((file) => ({
        id: newId(), kind: "new", file, preview: URL.createObjectURL(file), status: "uploading", progress: 0,
      }));
      if (!added.length) return;
      photosRef.current = [...photosRef.current, ...added];
      setPhotos((prev) => [...prev, ...added]);
      added.forEach((p) => void upload(p));
    },
    [t, upload],
  );

  const retry = useCallback(
    (id: string) => {
      const p = photosRef.current.find((x) => x.id === id);
      if (p?.kind === "new" && p.status === "error") void upload(p);
    },
    [upload],
  );

  const remove = useCallback(
    async (id: string) => {
      const p = photosRef.current.find((x) => x.id === id);
      if (!p) return;
      if (p.kind === "saved") {
        if (!listingId) return;
        try {
          await api.delete(`/listings/${listingId}/images`, { params: { image_url: p.url } });
          setPhotos((prev) => prev.filter((x) => x.id !== id));
        } catch {
          toast.error(t.failedToRemoveImage);
        }
        return;
      }
      controllers.current.get(id)?.abort();
      if (!p.thumbnail) URL.revokeObjectURL(p.preview);
      setPhotos((prev) => prev.filter((x) => x.id !== id));
      if (p.key) api.delete("/uploads", { params: { key: p.key } }).catch(() => {});
    },
    [listingId, t],
  );

  const setSaved = useCallback((urls: string[]) => {
    const saved: SavedPhoto[] = urls.map((url) => ({ id: newId(), kind: "saved", url }));
    setPhotos((prev) => [...saved, ...prev.filter((p) => p.kind === "new")]);
  }, []);

  const move = useCallback((from: number, to: number) => setPhotos((prev) => movePhoto(prev, from, to)), []);

  useEffect(() => {
    const ctrls = controllers.current;
    return () => {
      ctrls.forEach((c) => c.abort());
      photosRef.current.forEach((p) => {
        if (p.kind === "new" && !p.thumbnail) URL.revokeObjectURL(p.preview);
      });
    };
  }, []);

  const uploading = photos.some((p) => p.kind === "new" && p.status === "uploading");
  const refs = useMemo(() => imageRefs(photos), [photos]);

  return { photos, uploading, refs, addFiles, retry, remove, move, setSaved };
}

export type PhotoUploads = ReturnType<typeof usePhotoUploads>;
