import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import AdminHeader from "../../components/AdminHeader";
import adminApi from "../../adminApi";
import toast from "react-hot-toast";

interface AdminListing {
  id: string;
  title: string;
  price: string;
  status: string;
  condition: string;
  images: string[];
  view_count: number;
  created_at: string;
  seller_id: string;
  seller_name: string | null;
}

const STATUS_OPTIONS = ["active", "reserved", "sold", "inactive"];

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  reserved: "bg-amber-100 text-amber-700",
  sold: "bg-blue-100 text-blue-700",
  inactive: "bg-gray-100 text-gray-600",
};

export default function AdminListings() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<AdminListing[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const page = Number(searchParams.get("page") || 1);
  const status = searchParams.get("status") || "";
  const q = searchParams.get("q") || "";
  const limit = 25;

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, any> = { page, limit };
    if (status) params.status = status;
    if (q) params.q = q;
    adminApi
      .get("/admin/listings", { params })
      .then((res) => {
        setItems(res.data.items);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  }, [page, status, q]);

  useEffect(() => {
    load();
  }, [load]);

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setSearchParams(next);
  }

  async function updateStatus(id: string, newStatus: string) {
    try {
      await adminApi.patch(`/admin/listings/${id}`, { status: newStatus });
      setItems((prev) => prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l)));
      toast.success("Status updated");
    } catch {
      toast.error("Failed to update status");
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Listings
            {total > 0 && <span className="ml-2 text-lg font-normal text-gray-400">({total})</span>}
          </h1>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <input
            type="text"
            placeholder="Search title…"
            value={q}
            onChange={(e) => setParam("q", e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
          <select
            value={status}
            onChange={(e) => setParam("status", e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Listing</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Seller</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Price</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Views</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    Loading…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                    No listings found
                  </td>
                </tr>
              ) : (
                items.map((listing) => (
                  <tr key={listing.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {listing.images[0] ? (
                          <img
                            src={listing.images[0]}
                            alt=""
                            className="w-10 h-10 rounded object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded bg-gray-100 shrink-0" />
                        )}
                        <span className="font-medium text-gray-900 line-clamp-1 max-w-xs">
                          {listing.title}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {listing.seller_name ?? `#${listing.seller_id}`}
                    </td>
                    <td className="px-4 py-3 text-gray-700">ƒ{listing.price}</td>
                    <td className="px-4 py-3 text-gray-500">{listing.view_count}</td>
                    <td className="px-4 py-3">
                      <select
                        value={listing.status}
                        onChange={(e) => updateStatus(listing.id, e.target.value)}
                        className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${
                          STATUS_BADGE[listing.status] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                      {new Date(listing.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/listings/${listing.id}`}
                        target="_blank"
                        className="text-gray-400 hover:text-gray-700"
                      >
                        <ExternalLink size={14} />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setParam("page", String(page - 1))}
                className="flex items-center gap-1 px-3 py-1 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-40"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setParam("page", String(page + 1))}
                className="flex items-center gap-1 px-3 py-1 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-40"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
