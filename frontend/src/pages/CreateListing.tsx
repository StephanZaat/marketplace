import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Upload, X, ChevronRight, ChevronLeft, HelpCircle, Search, ArrowUpDown, MoreHorizontal } from "lucide-react";
import * as Icons from "lucide-react";
import toast from "react-hot-toast";
import api, { CategoryTree, ListingDetail, catName } from "../api";
import { useAuth } from "../contexts/AuthContext";
import { useLang } from "../contexts/LanguageContext";
import { useCurrency } from "../contexts/CurrencyContext";

type PhotoItem =
  | { kind: "saved"; id: string; idx: number; thumb: string; imgId: string; url: string; pId?: undefined }
  | { kind: "pending"; id: string; idx: number; thumb: string; pId: string; imgId?: undefined; url?: undefined };

interface FormData {
  title: string;
  description: string;
  price: number;
  is_free: boolean;
  is_negotiable: boolean;
  condition: string;
  category_id: string;
}

function CatIcon({ name, className = "w-5 h-5" }: { name: string | null; className?: string }) {
  const Icon = (name && (Icons as unknown as Record<string, Icons.LucideIcon>)[name]) || MoreHorizontal;
  return <Icon className={className} />;
}


// Returns top-level category slugs that match a title string
function guessCategoryId(title: string, tree: CategoryTree[]): string | null {
  if (!title || !tree.length) return null;
  const t = title.toLowerCase();
  const keywords: Record<string, string[]> = {
    "cars": ["car", "auto", "vehicle", "sedan", "suv", "truck", "toyota", "honda", "ford", "hyundai", "kia", "nissan", "bmw", "mercedes", "volkswagen", "vw", "audi", "jeep", "pickup", "minivan"],
    "bikes-mopeds": ["bike", "bicycle", "scooter", "moped", "cycling", "e-bike", "ebike", "vespa"],
    "motorcycles": ["motorcycle", "motorbike", "harley", "yamaha", "kawasaki", "suzuki", "ducati", "ktm", "enduro", "atv", "quad"],
    "mobile-phones": ["phone", "iphone", "samsung", "android", "smartphone", "mobile", "pixel", "oneplus", "huawei", "xiaomi", "oppo", "cellphone"],
    "computers": ["laptop", "computer", "pc", "macbook", "desktop", "imac", "chromebook", "notebook", "monitor", "mouse", "printer"],
    "tablets": ["tablet", "ipad", "galaxy tab", "surface"],
    "furniture": ["sofa", "couch", "table", "chair", "bed", "wardrobe", "desk", "shelf", "cabinet", "dresser", "bookcase", "mattress", "closet", "armchair", "sectional", "ottoman", "nightstand"],
    "appliances": ["fridge", "washing", "washer", "dryer", "oven", "microwave", "dishwasher", "vacuum", "freezer", "airco", "air conditioner", "ac unit", "fan", "toaster", "coffee maker", "espresso", "iron"],
    "kitchen": ["plates", "cutlery", "pots", "pans", "dishes", "bowl", "cups", "glasses", "cookware", "utensils", "kitchen", "bakeware", "knife", "blender", "juicer", "crockery", "mug", "casserole"],
    "sport": ["tennis", "golf", "fitness", "gym", "sport", "dumbbell", "weights", "treadmill", "yoga", "running", "football", "soccer", "basketball", "baseball", "martial arts", "boxing", "skiing"],
    "watersports-boats": ["boat", "kayak", "surfboard", "paddle", "kite", "windsurf", "sail", "snorkel", "diving", "jet ski", "pwc", "catamaran", "fishing", "sup", "wingfoil", "kitesurf"],
    "womens-clothing": ["dress", "blouse", "skirt", "women", "womens", "ladies", "leggings", "heels", "bra", "bikini", "swimsuit", "cardigan", "jumpsuit"],
    "mens-clothing": ["shirt", "pants", "jeans", "mens", "suit", "tie", "shorts", "trunks", "blazer", "chinos"],
    "kids-babies": ["kids", "baby", "toddler", "children", "toy", "stroller", "pram", "crib", "playpen", "lego", "doll", "puzzle", "cradle", "baby seat", "car seat", "nappy", "diaper"],
    "garden": ["garden", "plant", "lawn", "mower", "flower", "pot", "soil", "bbq", "barbecue", "grill", "hose", "rake", "shovel", "parasol", "outdoor furniture", "tree", "shrub"],
    "garden-tools": ["drill", "saw", "hammer", "wrench", "screwdriver", "ladder", "level", "grinder", "sander", "compressor", "generator", "welder", "spade", "wheelbarrow"],
    "gaming": ["playstation", "xbox", "nintendo", "game", "console", "ps5", "ps4", "ps3", "switch", "wii", "controller", "gaming"],
    "audio-tv-photo": ["tv", "television", "speaker", "headphone", "camera", "audio", "sound", "subwoofer", "amplifier", "receiver", "projector", "gopro", "lens", "drone"],
    "books": ["book", "novel", "textbook", "magazine", "comic", "manual", "guide", "dictionary", "autobiography", "biography"],
    "music": ["guitar", "piano", "keyboard", "drum", "violin", "instrument", "bass", "trumpet", "saxophone", "microphone", "amp"],
    "bags-accessories": ["bag", "purse", "wallet", "backpack", "handbag", "luggage", "suitcase", "tote", "briefcase", "belt", "watch", "sunglasses", "jewellery", "necklace", "bracelet", "ring"],
    "antiques-art": ["art", "painting", "sculpture", "collectible", "antique", "vintage", "figurine", "poster", "canvas", "print", "statue"],
    "pet-supplies": ["dog", "cat", "pet", "animal", "cage", "leash", "collar", "aquarium", "fish tank", "bird", "hamster", "rabbit"],
    "cosmetics": ["makeup", "cosmetics", "skincare", "perfume", "nail", "lipstick", "foundation", "mascara", "serum", "moisturiser"],
    "health-beauty": ["beauty", "hair", "massage", "supplement", "vitamins", "medical", "wheelchair", "crutches"],
    "office": ["office", "printer", "scanner", "shredder", "filing", "stationery", "whiteboard"],
  };
  for (const [slug, kws] of Object.entries(keywords)) {
    if (kws.some((kw) => t.includes(kw))) {
      const found = tree.find((c) => c.slug === slug);
      if (found) return found.id;
    }
  }
  return null;
}

export default function CreateListing() {
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCategorySlug = searchParams.get("category");
  const { user } = useAuth();
  const { t, lang } = useLang();
  const { currency, setCurrency } = useCurrency();
  const AWG_PER_USD = 1.77;

  const [tree, setTree] = useState<CategoryTree[]>([]);
  const [selectedParent, setSelectedParent] = useState<CategoryTree | null>(null);
  const [selectedMid, setSelectedMid] = useState<CategoryTree | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategoryTree | null>(null);
  const [catSearch, setCatSearch] = useState("");
  const [catSuggestDismissed, setCatSuggestDismissed] = useState(false);
  const [catSortAZ, setCatSortAZ] = useState(false);

  const [attributes, setAttributes] = useState<Record<string, string>>({});

  const [images, setImages] = useState<{ id: string; url: string }[]>([]);
  const [pendingFiles, setPendingFiles] = useState<{ id: string; file: File }[]>([]);
  // Unified display order: array of {kind, id} — null means use default (saved then pending)
  const [photoOrder, setPhotoOrder] = useState<{ kind: "saved" | "pending"; id: string }[] | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const dragIdx = useRef<number | null>(null);
  const [descLen, setDescLen] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement | null>(null);

  const autoResize = useCallback(() => {
    const el = descRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<FormData>();
  // Register price field programmatically (input is controlled for currency conversion)
  useEffect(() => {
    register("price", {
      required: t.priceRequired,
      min: { value: 0, message: t.priceMustBePositive },
      max: { value: 9999999, message: t.priceMax },
    });
  }, [register, t]);
  const titleValue = watch("title") ?? "";

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  useEffect(() => {
    api.get<CategoryTree[]>("/categories/tree").then((r) => setTree(r.data)).catch(() => {});
  }, []);

  // Pre-select category from URL param (e.g. when clicking sell from a category page)
  useEffect(() => {
    if (isEdit || !preselectedCategorySlug || !tree.length) return;

    // Find the node matching the slug at any level
    const findNode = (nodes: CategoryTree[], slug: string): CategoryTree | null => {
      for (const n of nodes) {
        if (n.slug === slug) return n;
        const found = findNode(n.children, slug);
        if (found) return found;
      }
      return null;
    };

    const node = findNode(tree, preselectedCategorySlug);
    if (!node) return;

    // Find parent and mid for the found node
    for (const parent of tree) {
      if (parent.id === node.id) {
        setSelectedParent(parent);
        if (parent.children.length === 0) {
          setSelectedCategory(parent);
          setValue("category_id", parent.id);
        }
        return;
      }
      for (const mid of parent.children) {
        if (mid.id === node.id) {
          setSelectedParent(parent);
          setSelectedMid(mid);
          if (mid.children.length === 0) {
            setSelectedCategory(mid);
            setValue("category_id", mid.id);
          }
          return;
        }
        for (const leaf of mid.children) {
          if (leaf.id === node.id) {
            setSelectedParent(parent);
            setSelectedMid(mid);
            setSelectedCategory(leaf);
            setValue("category_id", leaf.id);
            return;
          }
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, preselectedCategorySlug, tree.length, setValue]);

  useEffect(() => {
    if (isEdit && id) {
      api.get<ListingDetail>(`/listings/${id}?no_track=true`).then((r) => {
        const l = r.data;
        reset({
          title: l.title,
          description: l.description,
          price: parseFloat(l.price),
          is_negotiable: l.is_negotiable,
          is_free: parseFloat(l.price) === 0,
          condition: l.condition,
          category_id: l.category_id,
        });
        setDescLen(l.description.length);
        setImages(l.images.map((url, i) => ({ id: `${i}:${url}`, url })));
        setSelectedCategory({ ...l.category, children: [], listing_count: 0 } as CategoryTree);
        setAttributes((l.attributes as Record<string, string>) ?? {});
      });
    }
  }, [id, isEdit, reset]);

  // When tree loads in edit mode, find and set parent + mid levels
  useEffect(() => {
    if (isEdit && selectedCategory && tree.length > 0) {
      for (const p of tree) {
        if (p.id === selectedCategory.id) { setSelectedParent(p); return; }
        for (const m of p.children) {
          if (m.id === selectedCategory.id) { setSelectedParent(p); return; }
          for (const g of m.children) {
            if (g.id === selectedCategory.id) { setSelectedParent(p); setSelectedMid(m); return; }
          }
        }
      }
    }
  }, [isEdit, tree, selectedCategory?.id]);

  // Category-specific attribute fields — use the first category in the hierarchy that has attributes defined
  const attrFields = useMemo(() => {
    for (const cat of [selectedCategory, selectedMid, selectedParent]) {
      if (cat?.attributes?.length) return cat.attributes;
    }
    return [];
  }, [selectedCategory, selectedMid, selectedParent]);

  // Auto-suggest category from title (only when nothing selected yet and not dismissed)
  const suggestedCatId = useMemo(() => {
    if (selectedCategory || !titleValue || catSuggestDismissed) return null;
    return guessCategoryId(titleValue, tree);
  }, [titleValue, tree, selectedCategory, catSuggestDismissed]);

  // Filtered top-level cats for search
  const filteredTree = useMemo(() => {
    const q = catSearch.trim().toLowerCase();
    const base = !q ? tree : tree.filter((c: CategoryTree) => catName(c, lang).toLowerCase().includes(q) ||
      c.children.some((m: CategoryTree) => catName(m, lang).toLowerCase().includes(q) ||
        m.children.some((g: CategoryTree) => catName(g, lang).toLowerCase().includes(q))
      )
    );
    return catSortAZ
      ? [...base].sort((a, b) => catName(a, lang).localeCompare(catName(b, lang)))
      : [...base].sort((a, b) => (b.listing_count ?? 0) - (a.listing_count ?? 0));
  }, [tree, catSearch, catSortAZ]);

  const pickParent = (cat: CategoryTree) => {
    setSelectedMid(null);
    setSelectedCategory(null);
    setAttributes({});
    setCatSearch("");
    setValue("category_id", "");
    if (cat.children.length === 0) {
      setSelectedParent(cat);
      setSelectedCategory(cat);
      setValue("category_id", cat.id, { shouldValidate: true });
    } else {
      setSelectedParent(cat);
    }
  };

  const pickMid = (cat: CategoryTree) => {
    setSelectedCategory(null);
    setAttributes({});
    setValue("category_id", "");
    if (cat.children.length === 0) {
      setSelectedMid(null);
      setSelectedCategory(cat);
      setValue("category_id", cat.id, { shouldValidate: true });
    } else {
      setSelectedMid(cat);
    }
  };

  const pickLeaf = (cat: CategoryTree) => {
    setAttributes({});
    setSelectedCategory(cat);
    setValue("category_id", cat.id, { shouldValidate: true });
  };

  const clearParent = () => {
    setSelectedParent(null);
    setSelectedMid(null);
    setSelectedCategory(null);
    setAttributes({});
    setCatSearch("");
    setValue("category_id", "");
  };

  const clearMid = () => {
    setSelectedMid(null);
    setSelectedCategory(null);
    setAttributes({});
    setValue("category_id", "");
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const total = images.length + pendingFiles.length;
    const allowed = Array.from(files).slice(0, 10 - total);
    if (allowed.length < files.length) toast.error(t.maxPhotos);
    setPendingFiles((prev) => [
      ...prev,
      ...allowed.map((file) => ({ id: crypto.randomUUID(), file })),
    ]);
  };

  const removePending = (id: string) => {
    setPendingFiles((prev) => prev.filter((p) => p.id !== id));
  };

  const removeSaved = async (_imgId: string, url: string) => {
    if (!isEdit || !id) return;
    try {
      const res = await api.delete<{ images: string[] }>(`/listings/${id}/images`, { params: { image_url: url } });
      setImages(res.data.images.map((u, i) => ({ id: `${i}:${u}`, url: u })));
    } catch {
      toast.error(t.failedToRemoveImage);
    }
  };

  const uploadFiles = async (lid: string, files: { id: string; file: File }[]) => {
    for (const { id: fileId, file } of files) {
      const form = new FormData();
      form.append("file", file);
      setUploadProgress((prev) => ({ ...prev, [fileId]: 0 }));
      try {
        await api.post(`/listings/${lid}/images`, form, {
          onUploadProgress: (e) => {
            if (e.total) {
              setUploadProgress((prev) => ({ ...prev, [fileId]: Math.round((e.loaded / e.total!) * 100) }));
            }
          },
        });
      } catch {
        toast.error(t.failedToUpload.replace("{name}", file.name));
      } finally {
        setUploadProgress((prev) => { const n = { ...prev }; delete n[fileId]; return n; });
      }
    }
  };

  const onSubmit = async (data: FormData) => {
    const { is_free, ...payload } = data;
    if (is_free) payload.price = 0;
    const totalImgs = images.length + pendingFiles.length;
    if (totalImgs === 0) {
      toast.error(t.addAtLeastOnePhoto);
      return;
    }
    const attrPayload = Object.fromEntries(
      Object.entries(attributes).filter(([, v]) => (v as string).trim() !== "")
    );
    setSubmitting(true);
    try {
      if (isEdit && id) {
        // Build ordered image URLs from photoOrder (saved images only; pending are appended after upload)
        const savedById: Record<string, string> = Object.fromEntries(images.map((img: { id: string; url: string }) => [img.id, img.url]));
        const orderedSavedUrls = (photoOrder ?? images.map((img: { id: string; url: string }) => ({ kind: "saved" as const, id: img.id })))
          .filter((ref: { kind: string; id: string }) => ref.kind === "saved" && savedById[ref.id])
          .map((ref: { kind: string; id: string }) => savedById[ref.id]);
        await api.patch(`/listings/${id}`, { ...payload, attributes: attrPayload, images: orderedSavedUrls });
        if (pendingFiles.length > 0) await uploadFiles(id, pendingFiles);
        toast.success(t.listingUpdated);
        navigate(`/listings/${id}`);
      } else {
        const res = await api.post<{ id: string }>("/listings", { ...payload, attributes: attrPayload });
        const lid = res.data.id;
        if (pendingFiles.length > 0) await uploadFiles(lid, pendingFiles);
        toast.success(t.listingCreated);
        navigate(`/listings/${lid}`);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? t.failedToSaveListing;
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const totalImages = images.length + pendingFiles.length;
  const hideConditionAndPrice = ["jobs", "services"].includes(selectedParent?.slug ?? "");

  const photoItems = useMemo((): PhotoItem[] => {
    const saved: PhotoItem[] = images.map(
      (img: { id: string; url: string }): PhotoItem => ({
        kind: "saved", id: img.id, idx: 0, thumb: img.url, imgId: img.id, url: img.url,
      })
    );
    const pending: PhotoItem[] = pendingFiles.map(
      (p: { id: string; file: File }): PhotoItem => ({
        kind: "pending", id: p.id, idx: 0, thumb: URL.createObjectURL(p.file), pId: p.id,
      })
    );
    const byId: Record<string, PhotoItem> = Object.fromEntries(
      [...saved, ...pending].map((x: PhotoItem): [string, PhotoItem] => [x.id, x])
    );
    type OrderRef = { kind: "saved" | "pending"; id: string };
    const order: OrderRef[] = photoOrder ?? [
      ...saved.map((x: PhotoItem): OrderRef => ({ kind: "saved", id: x.id })),
      ...pending.map((x: PhotoItem): OrderRef => ({ kind: "pending", id: x.id })),
    ];
    return order
      .map((ref: OrderRef, idx: number): PhotoItem | null => {
        const item = byId[ref.id];
        return item ? { ...item, idx } : null;
      })
      .filter((x: PhotoItem | null): x is PhotoItem => x !== null);
  }, [images, pendingFiles, photoOrder]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">
        {isEdit ? t.editListing2 : t.createListing}
      </h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.fieldTitle} *</label>
          <input
            {...register("title", { required: t.titleRequired })}
            className="input"
            placeholder="e.g. Rip Curl Flashbomb 4/3 Wetsuit - Size M"
          />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
        </div>

        {/* Category picker */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <label className="block text-sm font-medium text-gray-700">{t.fieldCategory} *</label>
            <div className="relative group">
              <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
              <div className="absolute left-5 top-0 z-10 hidden group-hover:block w-72 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl">
                {t.categoryHint}
              </div>
            </div>
          </div>
          <input type="hidden" {...register("category_id", { required: true, validate: v => !!v || "Required" })} />

          {/* Auto-suggest banner */}
          {suggestedCatId && !selectedCategory && (
            <div className="mb-2 flex items-center gap-2 bg-ocean-50 border border-ocean-200 rounded-xl px-3 py-2 text-sm">
              <span className="text-ocean-700 flex-1">
                Suggested: <strong>{(() => { const c = tree.find(c => c.id === suggestedCatId); return c ? catName(c, lang) : ""; })()}</strong>
              </span>
              <button
                type="button"
                className="text-ocean-600 font-medium hover:underline text-xs"
                onClick={() => {
                  const cat = tree.find(c => c.id === suggestedCatId);
                  if (cat) pickParent(cat);
                }}
              >
                Use this
              </button>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-600 text-xs"
                onClick={() => setCatSuggestDismissed(true)}
              >
                Dismiss
              </button>
            </div>
          )}

          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {!selectedParent ? (
              <>
                {/* Search box */}
                <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50">
                  <Search className="w-4 h-4 text-gray-400 shrink-0" />
                  <input
                    type="text"
                    value={catSearch}
                    onChange={(e) => setCatSearch(e.target.value)}
                    placeholder={t.searchCategories}
                    className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
                  />
                  {catSearch && (
                    <button type="button" onClick={() => setCatSearch("")} className="text-gray-400 hover:text-gray-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setCatSortAZ(v => !v)}
                    title={catSortAZ ? t.sortAZTitle : t.sortPopularTitle}
                    className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-colors shrink-0 ${
                      catSortAZ
                        ? "border-ocean-400 text-ocean-600 bg-ocean-50"
                        : "border-gray-300 text-gray-500 hover:border-ocean-300 hover:text-ocean-600"
                    }`}
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    {catSortAZ ? "A–Z" : t.sortPopular}
                  </button>
                </div>
                {/* Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-gray-100 max-h-72 overflow-y-auto">
                  {filteredTree.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => pickParent(cat)}
                      className="bg-white hover:bg-ocean-50 p-3 flex items-center gap-2 text-left transition-colors group"
                    >
                      <span className="text-ocean-600 shrink-0">
                        <CatIcon name={cat.icon} className="w-4 h-4" />
                      </span>
                      <span className="text-sm font-medium text-gray-700 group-hover:text-ocean-700 flex-1 leading-tight">{catName(cat, lang)}</span>
                      {cat.children.length > 0 && <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-ocean-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              </>
            ) : !selectedMid ? (
              <div>
                <button
                  type="button"
                  onClick={clearParent}
                  className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 border-b border-gray-200 text-sm text-gray-600 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="text-ocean-600 shrink-0"><CatIcon name={selectedParent.icon} className="w-4 h-4" /></span>
                  <span className="font-semibold text-gray-800">{catName(selectedParent, lang)}</span>
                </button>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-gray-100">
                  {[...selectedParent.children].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => pickMid(child)}
                      className={`bg-white p-3 text-left text-sm transition-colors hover:bg-ocean-50 hover:text-ocean-700 flex items-center justify-between gap-1 ${
                        selectedCategory?.id === child.id
                          ? "bg-ocean-50 text-ocean-700 font-semibold ring-inset ring-2 ring-ocean-400"
                          : "text-gray-700"
                      }`}
                    >
                      <span>{catName(child, lang)}</span>
                      {child.children.length > 0 && <ChevronRight className="w-3 h-3 text-gray-300 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center border-b border-gray-200">
                  <button
                    type="button"
                    onClick={clearParent}
                    className="flex items-center gap-1 px-3 py-3 bg-gray-50 hover:bg-gray-100 text-sm text-gray-500 transition-colors border-r border-gray-200"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="text-ocean-600"><CatIcon name={selectedParent.icon} className="w-4 h-4" /></span>
                  </button>
                  <button
                    type="button"
                    onClick={clearMid}
                    className="flex-1 flex items-center gap-2 px-3 py-3 bg-gray-50 hover:bg-gray-100 text-sm text-gray-600 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="font-semibold text-gray-800">{catName(selectedMid, lang)}</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-gray-100">
                  {[...selectedMid.children].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((leaf) => (
                    <button
                      key={leaf.id}
                      type="button"
                      onClick={() => pickLeaf(leaf)}
                      className={`bg-white p-3 text-left text-sm transition-colors hover:bg-ocean-50 hover:text-ocean-700 ${
                        selectedCategory?.id === leaf.id
                          ? "bg-ocean-50 text-ocean-700 font-semibold ring-inset ring-2 ring-ocean-400"
                          : "text-gray-700"
                      }`}
                    >
                      {catName(leaf, lang)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

            {errors.category_id && <p className="text-red-500 text-xs mt-1">{t.categoryRequired}</p>}
        </div>

        {/* Category-specific attributes */}
        {attrFields.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {attrFields.map((f) => {
              const fieldLabel = (lang === "es" && f.label_es) ? f.label_es : f.label;
              return (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{fieldLabel}</label>
                  {f.type === "select" ? (
                    <select
                      value={attributes[f.key] ?? ""}
                      onChange={(e) => setAttributes((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      className="input"
                    >
                      <option value="">{lang === "es" ? "Selecciona…" : "Select…"}</option>
                      {f.options!.map((o, i) => (
                        <option key={o} value={o}>
                          {(lang === "es" && f.options_es?.[i]) ? f.options_es[i] : o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={attributes[f.key] ?? ""}
                      onChange={(e) => setAttributes((prev) => ({ ...prev, [f.key]: e.target.value }))}
                      className="input"
                      placeholder={fieldLabel}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Condition */}
        {!hideConditionAndPrice && <div>
          <div className="flex items-center gap-1.5 mb-1">
            <label className="block text-sm font-medium text-gray-700">{t.fieldCondition} *</label>
            <div className="relative group">
              <HelpCircle className="w-3.5 h-3.5 text-gray-400 cursor-help" />
              <div className="absolute left-5 top-0 z-10 hidden group-hover:block w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl">
                <p className="font-semibold mb-1.5">{t.conditionGuide}</p>
                <ul className="space-y-1">
                  <li><span className="font-medium text-green-400">{t.condNew}</span> — {t.condNew2}</li>
                  <li><span className="font-medium text-emerald-400">{t.condLikeNew}</span> — {t.condLikeNew2}</li>
                  <li><span className="font-medium text-blue-400">{t.condGood}</span> — {t.condGood2}</li>
                  <li><span className="font-medium text-yellow-400">{t.condFair}</span> — {t.condFair2}</li>
                  <li><span className="font-medium text-red-400">{t.condPoor}</span> — {t.condPoor2}</li>
                </ul>
              </div>
            </div>
          </div>
          <select {...register("condition", { required: !hideConditionAndPrice })} className="input w-auto" defaultValue="good">
            <option value="new">{t.condNew}</option>
            <option value="like_new">{t.condLikeNew}</option>
            <option value="good">{t.condGood}</option>
            <option value="fair">{t.condFair}</option>
            <option value="poor">{t.condPoor}</option>
          </select>
        </div>}

        {/* Price */}
        {!hideConditionAndPrice &&
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t.fieldPrice.replace("AWG", currency)} *
          </label>
          <div className="flex flex-wrap items-center gap-4">
            {!watch("is_free") && (
              <div className="flex items-center gap-2">
                <div className="relative w-40">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                    {currency === "AWG" ? "ƒ" : "$"}
                  </span>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    inputMode="numeric"
                    onKeyDown={(e) => ["e", "E", "+", "-", "."].includes(e.key) && e.preventDefault()}
                    value={(() => {
                      const awg = watch("price");
                      if (!awg && awg !== 0) return "";
                      return currency === "USD" ? Math.round(awg / AWG_PER_USD) : awg;
                    })()}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (isNaN(v)) { setValue("price", 0, { shouldValidate: true }); return; }
                      const awg = currency === "USD" ? Math.round(v * AWG_PER_USD) : v;
                      setValue("price", awg, { shouldValidate: true });
                    }}
                    className="input pl-7 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    placeholder="0"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setCurrency(currency === "AWG" ? "USD" : "AWG")}
                  className="px-2.5 py-1 text-xs font-semibold text-gray-500 hover:text-ocean-600 hover:bg-ocean-50 rounded-full border border-gray-200 hover:border-ocean-200 transition-colors"
                  title={currency === "AWG" ? "Switch to USD" : "Switch to AWG"}
                >
                  {currency === "AWG" ? "$ USD" : "ƒ AWG"}
                </button>
              </div>
            )}
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" {...register("is_free")} className="rounded" />
              {t.freeLabel}
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" {...register("is_negotiable")} className="rounded" disabled={watch("is_free")} />
              <span className={watch("is_free") ? "text-gray-400" : ""}>{t.negotiableLabel}</span>
            </label>
          </div>
          {errors.price && !watch("is_free") && <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>}
          {currency === "USD" && !watch("is_free") && watch("price") > 0 && (
            <p className="text-xs text-gray-400 mt-1">≈ ƒ{watch("price").toLocaleString("en-AW")} AWG</p>
          )}
        </div>}

        {/* Description */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">{t.fieldDescription} *</label>
            <span className={`text-xs ${descLen > 450 ? "text-red-500" : "text-gray-400"}`}>
              {descLen}/500
            </span>
          </div>
          <textarea
            {...register("description", {
              required: t.descriptionRequired,
              maxLength: { value: 500, message: t.descriptionMaxLength },
              onChange: (e) => { setDescLen(e.target.value.length); autoResize(); },
            })}
            ref={(el) => {
              register("description").ref(el);
              descRef.current = el;
            }}
            rows={4}
            className="input resize-none overflow-hidden"
            placeholder={t.descriptionPlaceholder}
          />
          {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
        </div>

        {/* Photos */}
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <label className="block text-sm font-medium text-gray-700">
              {t.fieldPhotos} * <span className="text-gray-400 font-normal">({totalImages}/10)</span>
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
            {photoItems.map((item) => (
              <div
                key={item.id}
                draggable
                onDragStart={() => { dragIdx.current = item.idx; }}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={() => {
                  const from = dragIdx.current;
                  const to = item.idx;
                  if (from === null || from === to) return;
                  dragIdx.current = null;
                  const current = photoOrder ?? [
                    ...images.map((img): { kind: "saved" | "pending"; id: string } => ({ kind: "saved", id: img.id })),
                    ...pendingFiles.map((p): { kind: "saved" | "pending"; id: string } => ({ kind: "pending", id: p.id })),
                  ];
                  const reordered = [...current];
                  const [moved] = reordered.splice(from, 1);
                  reordered.splice(to, 0, moved);
                  setPhotoOrder(reordered);
                }}
                className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 cursor-grab active:cursor-grabbing select-none"
              >
                <img src={item.thumb} alt="" className="w-full h-full object-cover pointer-events-none" />
                {/* Upload progress bar */}
                {item.kind === "pending" && item.pId && uploadProgress[item.pId] !== undefined && (
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center">
                    <div className="w-3/4 bg-gray-600 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-white h-full rounded-full transition-all duration-200"
                        style={{ width: `${uploadProgress[item.pId!]}%` }}
                      />
                    </div>
                    <span className="text-white text-[10px] mt-1 font-medium">{uploadProgress[item.pId!]}%</span>
                  </div>
                )}
                {item.idx === 0 && !(item.kind === "pending" && item.pId && uploadProgress[item.pId!] !== undefined) && (
                  <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] text-center py-0.5 font-medium">
                    {t.thumbnail}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => item.kind === "saved" ? removeSaved(item.imgId!, item.url!) : removePending(item.pId!)}
                  className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-0.5 hover:bg-black/70"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {totalImages < 10 && (
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
            onChange={(e) => { addFiles(e.target.files); if (fileRef.current) fileRef.current.value = ""; }}
          />
          <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
            <span className="shrink-0 mt-0.5">⏳</span>
            <span><span className="font-semibold">{t.listingExpiry}</span> {t.listingExpiryHint}</span>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={submitting} className="btn-primary flex-1">
            {submitting
              ? (pendingFiles.length > 0 ? t.uploading : t.saving)
              : isEdit ? t.saveChanges : t.createListing}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary px-6">
            {t.cancel}
          </button>
        </div>
      </form>
    </div>
  );
}
