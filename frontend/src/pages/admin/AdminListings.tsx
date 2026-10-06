import React, { Fragment, useEffect, useState, useCallback } from "react";
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
  // Review context (description only for pending listings)
  description: string | null;
  created_country: string | null;
  seller_email: string | null;
  seller_trusted: boolean;
}

const STATUS_OPTIONS = ["pending", "active", "reserved", "sold", "inactive"];

const STATUS_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  reserved: "bg-amber-100 text-amber-700",
  sold: "bg-blue-100 text-blue-700",
  inactive: "bg-gray-100 text-gray-600",
  pending: "bg-sky-100 text-sky-700",
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

  async function approve(id: string) {
    try {
      await adminApi.post(`/admin/listings/${id}/approve`);
      setItems((prev) => prev.map((l) => (l.id === id ? { ...l, status: "active", seller_trusted: true } : l)));
      toast.success("Approved; seller is now trusted");
    } catch {
      toast.error("Failed to approve");
    }
  }

  async function rejectAndBan(listing: AdminListing) {
    if (!confirm(`Deactivate ${listing.seller_email ?? "this seller"} and take down all their listings?`)) return;
    try {
      await adminApi.patch(`/admin/users/${listing.seller_id}`, { is_active: false });
      setItems((prev) => prev.map((l) => (l.seller_id === listing.seller_id && l.status !== "sold" ? { ...l, status: "inactive" } : l)));
      toast.success("Seller deactivated");
    } catch {
      toast.error("Failed to deactivate seller");
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
                  <Fragment key={listing.id}>
                  <tr className="hover:bg-gray-50">
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
                      {/* Pending/inactive listings 404 on the public site */}
                      {listing.status !== "pending" && listing.status !== "inactive" && (
                        <Link
                          to={`/listings/${listing.id}`}
                          target="_blank"
                          className="text-gray-400 hover:text-gray-700"
                        >
                          <ExternalLink size={14} />
                        </Link>
                      )}
                    </td>
                  </tr>
                  {listing.status === "pending" && (
                    <tr className="bg-sky-50/50">
                      <td colSpan={7} className="px-4 pb-4 pt-1">
                        <p className="text-xs text-gray-500 mb-2">
                          Posted from <strong>{listing.created_country ?? "unknown"}</strong>
                          {" · "}{listing.seller_email}
                          {" · "}<a href="https://db-ip.com" target="_blank" rel="noreferrer" className="underline">IP Geolocation by DB-IP</a>
                        </p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-6 mb-3">{listing.description}</p>
                        <div className="flex gap-2">
                          <button onClick={() => approve(listing.id)} className="px-3 py-1 rounded bg-green-600 text-white text-xs font-medium hover:bg-green-700">
                            Approve &amp; trust seller
                          </button>
                          <button onClick={() => updateStatus(listing.id, "inactive")} className="px-3 py-1 rounded border border-gray-300 text-xs font-medium hover:bg-gray-100">
                            Reject
                          </button>
                          <button onClick={() => rejectAndBan(listing)} className="px-3 py-1 rounded border border-red-300 text-red-700 text-xs font-medium hover:bg-red-50">
                            Reject &amp; ban seller
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
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
