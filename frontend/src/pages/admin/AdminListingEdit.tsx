import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, ShieldCheck, Star } from "lucide-react";
import toast from "react-hot-toast";
import AdminLayout from "../../components/AdminLayout";
import adminApi from "../../adminApi";
import { STATUS_BADGE } from "./adminStyles";

interface AdminListingDetail {
  id: string;
  title: string;
  description: string;
  price: string;
  is_negotiable: boolean;
  condition: string;
  status: string;
  location: string | null;
  category_id: string | null;
  is_featured: boolean;
  created_country: string | null;
  view_count: number;
  images: string[];
  created_at: string;
  seller: { id: string; name: string | null; email: string; is_trusted: boolean; is_active: boolean } | null;
}

export interface AdminCategory {
  id: string;
  name: string;
  name_es: string | null;
  slug: string;
  icon: string | null;
  sort_order: number;
  parent_id: string | null;
  is_hidden: boolean;
  listing_count: number;
  active_count: number;
}

const CONDITIONS = ["new", "like_new", "good", "fair", "poor"];

/** Categories in tree order with their depth, for indented pickers. */
export function flattenTree(cats: AdminCategory[]): { cat: AdminCategory; depth: number }[] {
  const children = new Map<string | null, AdminCategory[]>();
  for (const c of cats) children.set(c.parent_id, [...(children.get(c.parent_id) ?? []), c]);
  const out: { cat: AdminCategory; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const c of children.get(parent) ?? []) {
      out.push({ cat: c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export default function AdminListingEdit() {
  const { listingId } = useParams();
  const [listing, setListing] = useState<AdminListingDetail | null>(null);
  const [form, setForm] = useState<Partial<AdminListingDetail>>({});
  const [cats, setCats] = useState<AdminCategory[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.get<AdminListingDetail>(`/admin/listings/${listingId}`).then((r) => {
      setListing(r.data);
      setForm(r.data);
    }).catch(() => toast.error("Listing not found"));
    adminApi.get<AdminCategory[]>("/admin/categories").then((r) => setCats(r.data));
  }, [listingId]);

  const tree = useMemo(() => flattenTree(cats), [cats]);

  if (!listing) return <AdminLayout><p className="text-gray-400">Loading…</p></AdminLayout>;

  const set = (k: keyof AdminListingDetail, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true);
    try {
      const { data } = await adminApi.patch<AdminListingDetail>(`/admin/listings/${listing!.id}/edit`, {
        title: form.title, description: form.description, price: form.price, is_negotiable: form.is_negotiable,
        condition: form.condition, location: form.location ?? "", category_id: form.category_id, is_featured: form.is_featured,
      });
      setListing(data);
      setForm(data);
      toast.success("Listing saved");
    } catch (e: any) {
      toast.error(e?.response?.data?.detail?.[0]?.msg ?? e?.response?.data?.detail ?? "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function bulk(action: string) {
    await adminApi.post("/admin/listings/bulk", { ids: [listing!.id], action });
    const { data } = await adminApi.get<AdminListingDetail>(`/admin/listings/${listing!.id}`);
    setListing(data);
    setForm(data);
    toast.success("Status updated");
  }

  const isPublic = !["pending", "inactive"].includes(listing.status);

  return (
    <AdminLayout>
      <Link to="/admin/listings" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ocean-700 mb-4">
        <ArrowLeft size={14} /> Listings
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-gray-900 flex-1">Edit listing</h1>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[listing.status] ?? ""}`}>{listing.status}</span>
          </div>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Title</span>
            <input className="input" value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} maxLength={200} />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Description</span>
            <textarea className="input" rows={7} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} maxLength={5000} />
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Category</span>
              <select className="input" value={form.category_id ?? ""} onChange={(e) => set("category_id", e.target.value)}>
                {tree.map(({ cat, depth }) => (
                  <option key={cat.id} value={cat.id}>
                    {"  ".repeat(depth * 2)}{cat.name}{cat.is_hidden ? " (hidden)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Condition</span>
              <select className="input" value={form.condition ?? ""} onChange={(e) => set("condition", e.target.value)}>
                {CONDITIONS.map((c) => <option key={c} value={c}>{c.replace("_", " ")}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Price (ƒ)</span>
              <input className="input" type="number" min="0" step="0.01" value={form.price ?? ""} onChange={(e) => set("price", e.target.value)} />
            </label>
            <label className="block">
              <span className="block text-sm font-medium text-gray-700 mb-1">Location</span>
              <input className="input" value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} maxLength={200} />
            </label>
          </div>
          <div className="flex flex-wrap gap-5 text-sm">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" className="accent-ocean-600" checked={!!form.is_negotiable} onChange={(e) => set("is_negotiable", e.target.checked)} />
              Negotiable
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" className="accent-ocean-600" checked={!!form.is_featured} onChange={(e) => set("is_featured", e.target.checked)} />
              <Star size={14} className="text-sand-500 fill-sand-400" /> Featured on homepage
            </label>
          </div>
          <button onClick={save} disabled={saving} className="btn-primary">Save changes</button>
        </div>

        <div className="space-y-4">
          {listing.images.length > 0 && (
            <div className="card p-3 grid grid-cols-3 gap-2">
              {listing.images.map((src) => <img key={src} src={src} alt="" className="aspect-square w-full rounded-lg object-cover" />)}
            </div>
          )}
          <div className="card p-5 text-sm space-y-1.5">
            <div className="flex justify-between"><span className="text-gray-500">Views</span><span>{listing.view_count}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Posted from</span><span>{listing.created_country ?? "unknown"}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Created</span><span>{new Date(listing.created_at).toLocaleDateString()}</span></div>
            {listing.seller && (
              <div className="pt-2 mt-2 border-t border-gray-100">
                <Link to={`/admin/users/${listing.seller.id}`} className="font-medium text-ocean-700 hover:underline inline-flex items-center gap-1">
                  {listing.seller.name || listing.seller.email}
                  {listing.seller.is_trusted && <ShieldCheck size={13} />}
                </Link>
                <p className="text-gray-500">{listing.seller.email}{!listing.seller.is_active && " · suspended"}</p>
              </div>
            )}
          </div>
          <div className="card p-5 space-y-2">
            {listing.status === "pending" && <button onClick={() => bulk("approve")} className="btn-primary w-full text-sm">Approve &amp; trust seller</button>}
            {listing.status === "inactive" || listing.status === "pending"
              ? <button onClick={() => bulk("activate")} className="btn-secondary w-full text-sm">Activate</button>
              : <button onClick={() => bulk("deactivate")} className="btn-secondary w-full text-sm text-red-700 border-red-200 hover:bg-red-50">Deactivate</button>}
            {isPublic && (
              <a href={`/listings/${listing.id}`} target="_blank" rel="noreferrer" className="btn-secondary w-full text-sm">
                <ExternalLink size={14} /> View on site
              </a>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
