import { useRef } from "react";
import { AlertCircle, HelpCircle, RotateCw, Upload, X } from "lucide-react";
import { useLang } from "../contexts/LanguageContext";
import { MAX_PHOTOS, Photo, PhotoUploads, photoSrc } from "../hooks/usePhotoUploads";

function TileOverlay({ photo, isFirst, onRetry }: { photo: Photo; isFirst: boolean; onRetry: () => void }) {
  const { t } = useLang();
  if (photo.kind === "new" && photo.status === "uploading") {
    return (
      <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center">
        <div className="w-3/4 bg-gray-600 rounded-full h-1.5 overflow-hidden">
          <div className="bg-white h-full rounded-full transition-all duration-200" style={{ width: `${photo.progress}%` }} />
        </div>
        <span className="text-white text-[10px] mt-1 font-medium">{photo.progress}%</span>
      </div>
    );
  }
  if (photo.kind === "new" && photo.status === "error") {
    return (
      <div className="absolute inset-0 bg-red-900/60 flex flex-col items-center justify-center gap-1 text-white">
        <AlertCircle className="w-5 h-5" />
        <span className="text-[10px] font-medium">{t.photoUploadFailed}</span>
        <button
          type="button"
          onClick={onRetry}
          className="flex items-center gap-1 text-[10px] font-semibold bg-white/20 hover:bg-white/30 rounded-full px-2 py-0.5"
        >
          <RotateCw className="w-3 h-3" />
          {t.retryUpload}
        </button>
      </div>
    );
  }
  if (!isFirst) return null;
  return (
    <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] text-center py-0.5 font-medium">
      {t.thumbnail}
    </div>
  );
}

/** Photo grid for the listing form: add (uploads immediately), reorder by drag, retry, remove. */
export default function PhotoUploader({ uploads }: { uploads: PhotoUploads }) {
  const { t } = useLang();
  const { photos, addFiles, retry, remove, move } = uploads;
  const dragIdx = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div className="flex items-center gap-1.5 mb-2">
        <label className="block text-sm font-medium text-gray-700">
          {t.fieldPhotos} * <span className="text-gray-400 font-normal">({photos.length}/{MAX_PHOTOS})</span>
        </label>
        <div className="relative group">
          <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
          <div className="absolute left-5 top-0 z-10 hidden group-hover:block w-60 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl">
            <p className="font-semibold mb-1.5">{t.photoTips}</p>
            <ul className="space-y-1 text-gray-300">
              <li>• {t.photoTip1}</li>
              <li>• {t.photoTip2}</li>
              <li>• {t.photoTip3}</li>
              <li>• {t.photoTip4}</li>
            </ul>
          </div>
        </div>
      </div>
      <p className="text-xs text-gray-400 mb-2">{t.dragToReorder}</p>
      <div className="grid grid-cols-4 gap-2 mb-2">
        {photos.map((photo, idx) => (
          <div
            key={photo.id}
            draggable
            onDragStart={() => { dragIdx.current = idx; }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              const from = dragIdx.current;
              dragIdx.current = null;
              if (from !== null) move(from, idx);
            }}
            className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-grab active:cursor-grabbing select-none"
          >
            <img src={photoSrc(photo)} alt="" className="w-full h-full object-cover pointer-events-none" />
            <TileOverlay photo={photo} isFirst={idx === 0} onRetry={() => retry(photo.id)} />
            <button
              type="button"
              aria-label={t.removePhoto}
              onClick={() => void remove(photo.id)}
              className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 hover:bg-black/70"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-ocean-400 hover:text-ocean-500 transition-colors"
          >
            <Upload className="w-5 h-5 mb-1" />
            <span className="text-xs">{t.addPhoto}</span>
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
      />
    </>
  );
}
