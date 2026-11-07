import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import toast from "react-hot-toast";
import { LanguageProvider } from "../contexts/LanguageContext";
import { MAX_PHOTOS, movePhoto, usePhotoUploads } from "../hooks/usePhotoUploads";
import api from "../api";

vi.mock("../api", () => ({ default: { post: vi.fn(), delete: vi.fn() } }));
vi.mock("react-hot-toast", () => ({ default: { error: vi.fn(), success: vi.fn() } }));

const post = vi.mocked(api.post);
const del = vi.mocked(api.delete);

const file = (name: string) => new File(["x"], name, { type: "image/jpeg" });
const uploaded = (key: string) => ({ data: { key, url: `/img/${key}`, thumbnail: `/thumb/${key}` } });

function setup(listingId?: string) {
  return renderHook(() => usePhotoUploads(listingId), {
    wrapper: ({ children }) => <LanguageProvider>{children}</LanguageProvider>,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  let n = 0;
  URL.createObjectURL = vi.fn(() => `blob:preview-${n++}`);
  URL.revokeObjectURL = vi.fn();
  del.mockResolvedValue({ data: {} });
});

describe("usePhotoUploads", () => {
  it("uploads picked files immediately and swaps the preview for the server thumbnail", async () => {
    let resolve!: (v: unknown) => void;
    post.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const { result } = setup();

    act(() => result.current.addFiles([file("a.jpg")]));
    expect(post).toHaveBeenCalledWith("/uploads", expect.any(FormData), expect.any(Object));
    expect(result.current.uploading).toBe(true);
    expect(result.current.refs).toEqual([]);

    await act(async () => resolve(uploaded("uploads/u/a.jpg")));
    expect(result.current.uploading).toBe(false);
    expect(result.current.refs).toEqual(["uploads/u/a.jpg"]);
    expect(result.current.photos[0]).toMatchObject({ status: "done", thumbnail: "/thumb/uploads/u/a.jpg" });
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview-0");
  });

  it("caps the total at the maximum and warns", async () => {
    post.mockImplementation(async () => uploaded("k"));
    const { result } = setup();
    act(() => result.current.setSaved(["/img/1.jpg", "/img/2.jpg"]));
    act(() => result.current.addFiles(Array.from({ length: 12 }, (_, i) => file(`${i}.jpg`))));
    await waitFor(() => expect(result.current.uploading).toBe(false));
    expect(result.current.photos).toHaveLength(MAX_PHOTOS);
    expect(post).toHaveBeenCalledTimes(MAX_PHOTOS - 2);
    expect(toast.error).toHaveBeenCalled();
  });

  it("marks a failed upload as error, toasts, and can retry", async () => {
    post.mockRejectedValueOnce(new Error("boom")).mockResolvedValueOnce(uploaded("uploads/u/b.jpg"));
    const { result } = setup();
    act(() => result.current.addFiles([file("b.jpg")]));
    await waitFor(() => expect(result.current.photos[0]).toMatchObject({ status: "error" }));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("b.jpg"));
    expect(result.current.refs).toEqual([]);

    act(() => result.current.retry(result.current.photos[0].id));
    await waitFor(() => expect(result.current.refs).toEqual(["uploads/u/b.jpg"]));
  });

  it("removing an unsaved upload drops it and deletes the upload by key", async () => {
    post.mockResolvedValueOnce(uploaded("uploads/u/c.jpg"));
    const { result } = setup();
    act(() => result.current.addFiles([file("c.jpg")]));
    await waitFor(() => expect(result.current.refs).toHaveLength(1));

    await act(() => result.current.remove(result.current.photos[0].id));
    expect(result.current.photos).toEqual([]);
    expect(del).toHaveBeenCalledWith("/uploads", { params: { key: "uploads/u/c.jpg" } });
  });

  it("removing a saved image calls the listing endpoint", async () => {
    const { result } = setup("L1");
    act(() => result.current.setSaved(["/img/1.jpg", "/img/2.jpg"]));
    await act(() => result.current.remove(result.current.photos[0].id));
    expect(del).toHaveBeenCalledWith("/listings/L1/images", { params: { image_url: "/img/1.jpg" } });
    expect(result.current.refs).toEqual(["/img/2.jpg"]);
  });

  it("refs follow display order, mixing saved URLs and upload keys", async () => {
    post.mockResolvedValueOnce(uploaded("uploads/u/d.jpg"));
    const { result } = setup("L1");
    act(() => result.current.setSaved(["/img/1.jpg", "/img/2.jpg"]));
    act(() => result.current.addFiles([file("d.jpg")]));
    await waitFor(() => expect(result.current.uploading).toBe(false));
    act(() => result.current.move(2, 0));
    expect(result.current.refs).toEqual(["uploads/u/d.jpg", "/img/1.jpg", "/img/2.jpg"]);
  });
});

describe("movePhoto", () => {
  it("moves an item and ignores out-of-range moves", () => {
    expect(movePhoto([1, 2, 3], 0, 2)).toEqual([2, 3, 1]);
    expect(movePhoto([1, 2, 3], 0, 5)).toEqual([1, 2, 3]);
  });
});
