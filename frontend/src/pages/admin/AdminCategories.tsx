import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, Pencil, Plus, Trash2, Check, X, ChevronRight, ChevronDown } from "lucide-react";
import toast from "react-hot-toast";
import AdminLayout from "../../components/AdminLayout";
import adminApi from "../../adminApi";
import { AdminCategory, flattenTree } from "./AdminListingEdit";

type Draft = { name: string; name_es: string; parent_id: string; sort_order: number };

function errorText(e: any, fallback: string) {
  const d = e?.response?.data?.detail;
  return typeof d === "string" ? d : fallback;
}

export default function AdminCategories() {
  const [cats, setCats] = useState<AdminCategory[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: "", name_es: "", parent_id: "", sort_order: 0 });
  const [adding, setAdding] = useState<Draft>({ name: "", name_es: "", parent_id: "", sort_order: 0 });

  const load = useCallback(() => {
    adminApi.get<AdminCategory[]>("/admin/categories").then((r) => setCats(r.data));
  }, []);
  useEffect(() => { load(); }, [load]);

  const tree = useMemo(() => flattenTree(cats), [cats]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");

  // Top-level categories start collapsed; a filter shows every match with its ancestors' context.
  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    let root = "";
    const childCount = new Map<string, number>();
    const withRoot = tree.map((r) => {
      if (r.depth === 0) root = r.cat.id;
      else childCount.set(root, (childCount.get(root) ?? 0) + 1);
      return { ...r, root };
    });
    const visible = f
      ? withRoot.filter((r) => r.cat.name.toLowerCase().includes(f) || (r.cat.name_es ?? "").toLowerCase().includes(f))
      : withRoot.filter((r) => r.depth === 0 || expanded.has(r.root));
    return visible.map((r) => ({ ...r, children: r.depth === 0 ? childCount.get(r.cat.id) ?? 0 : 0 }));
  }, [tree, expanded, filter]);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  function startEdit(c: AdminCategory) {
    setEditing(c.id);
    setDraft({ name: c.name, name_es: c.name_es ?? "", parent_id: c.parent_id ?? "", sort_order: c.sort_order });
  }

  async function saveEdit(id: string) {
    try {
      await adminApi.patch(`/admin/categories/${id}`, { ...draft, sort_order: Number(draft.sort_order) });
      setEditing(null);
      toast.success("Category saved");
      load();
    } catch (e) {
      toast.error(errorText(e, "Save failed"));
    }
  }

  async function toggleHidden(c: AdminCategory) {
    await adminApi.patch(`/admin/categories/${c.id}`, { is_hidden: !c.is_hidden });
    toast.success(c.is_hidden ? `${c.name} is visible again` : `${c.name} hidden from the site`);
    load();
  }

  async function remove(c: AdminCategory) {
    if (!confirm(`Delete "${c.name}"?`)) return;
    try {
      await adminApi.delete(`/admin/categories/${c.id}`);
      toast.success("Category deleted");
      load();
    } catch (e) {
      toast.error(errorText(e, "Delete failed"));
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await adminApi.post("/admin/categories", { ...adding, parent_id: adding.parent_id || null, sort_order: Number(adding.sort_order) });
      setAdding({ name: "", name_es: "", parent_id: adding.parent_id, sort_order: 0 });
      toast.success("Category added");
      load();
    } catch (err) {
      toast.error(errorText(err, "Add failed"));
    }
  }

  const parentOptions = (excludeId?: string) => (
    <>
      <option value="">— Top level —</option>
      {tree.filter(({ cat }) => cat.id !== excludeId).map(({ cat, depth }) => (
        <option key={cat.id} value={cat.id}>{"  ".repeat(depth * 2)}{cat.name}</option>
      ))}
    </>
  );

  return (
    <AdminLayout>
      <h1 className="text-2xl font-extrabold text-gray-900 mb-1">Categories</h1>
      <p className="text-sm text-gray-500 mb-6">
        Hidden categories (and everything under them) disappear from the site and can't receive new listings.
        Only empty categories without subcategories can be deleted.
      </p>

      <form onSubmit={add} className="card p-4 mb-6 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-gray-600 mb-1">Name</span>
          <input className="input text-sm py-1.5 w-48" required value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="block text-gray-600 mb-1">Spanish name</span>
          <input className="input text-sm py-1.5 w-48" value={adding.name_es} onChange={(e) => setAdding({ ...adding, name_es: e.target.value })} />
        </label>
        <label className="text-sm">
          <span className="block text-gray-600 mb-1">Under</span>
          <select className="input text-sm py-1.5 w-56" value={adding.parent_id} onChange={(e) => setAdding({ ...adding, parent_id: e.target.value })}>
            {parentOptions()}
          </select>
        </label>
        <button className="btn-primary text-sm py-1.5"><Plus size={14} /> Add category</button>
      </form>

      <input
        className="input text-sm py-1.5 w-64 mb-3"
        placeholder="Filter categories…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Category</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Spanish</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Order</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Listings</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(({ cat, depth, children }) => editing === cat.id ? (
              <tr key={cat.id} className="bg-ocean-50/50">
                <td className="px-4 py-2" style={{ paddingLeft: 16 + depth * 20 }}>
                  <input className="input text-sm py-1" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
                  <select className="input text-xs py-1 mt-1" value={draft.parent_id} onChange={(e) => setDraft({ ...draft, parent_id: e.target.value })}>
                    {parentOptions(cat.id)}
                  </select>
                </td>
                <td className="px-4 py-2"><input className="input text-sm py-1" value={draft.name_es} onChange={(e) => setDraft({ ...draft, name_es: e.target.value })} /></td>
                <td className="px-4 py-2"><input className="input text-sm py-1 w-20" type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} /></td>
                <td className="px-4 py-2 text-gray-500">{cat.active_count} / {cat.listing_count}</td>
                <td className="px-4 py-2 whitespace-nowrap text-right">
                  <button onClick={() => saveEdit(cat.id)} className="p-1.5 text-green-700 hover:bg-green-50 rounded" aria-label="Save"><Check size={15} /></button>
                  <button onClick={() => setEditing(null)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" aria-label="Cancel"><X size={15} /></button>
                </td>
              </tr>
            ) : (
              <tr key={cat.id} className={cat.is_hidden ? "text-gray-400" : "hover:bg-gray-50"}>
                <td className="px-4 py-2.5" style={{ paddingLeft: 16 + depth * 20 }}>
                  {depth === 0 && children > 0 && !filter ? (
                    <button onClick={() => toggleExpand(cat.id)} className="inline-flex items-center gap-1 font-semibold text-gray-900 hover:text-ocean-700">
                      {expanded.has(cat.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      {cat.name} <span className="font-normal text-gray-400">({children})</span>
                    </button>
                  ) : (
                    <span className={depth === 0 ? "font-semibold text-gray-900" : "text-gray-800"}>{cat.name}</span>
                  )}
                  {cat.is_hidden && <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">hidden</span>}
                </td>
                <td className="px-4 py-2.5 text-gray-500">{cat.name_es ?? "—"}</td>
                <td className="px-4 py-2.5 text-gray-500">{cat.sort_order}</td>
                <td className="px-4 py-2.5 text-gray-500">{cat.active_count} active · {cat.listing_count} total</td>
                <td className="px-4 py-2.5 whitespace-nowrap text-right">
                  <button onClick={() => startEdit(cat)} className="p-1.5 text-gray-500 hover:text-ocean-700 hover:bg-ocean-50 rounded" aria-label={`Edit ${cat.name}`}><Pencil size={14} /></button>
                  <button onClick={() => toggleHidden(cat)} className="p-1.5 text-gray-500 hover:text-ocean-700 hover:bg-ocean-50 rounded" aria-label={cat.is_hidden ? "Show" : "Hide"}>
                    {cat.is_hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button onClick={() => remove(cat)} className="p-1.5 text-gray-400 hover:text-red-700 hover:bg-red-50 rounded" aria-label={`Delete ${cat.name}`}><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
