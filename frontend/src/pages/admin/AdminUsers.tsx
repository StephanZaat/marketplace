import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ExternalLink, ShieldCheck, Trash2 } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import adminApi from "../../adminApi";
import toast from "react-hot-toast";
import PurgeDialog from "./PurgeDialog";

interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  location: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_verified: boolean;
  is_trusted: boolean;
  signup_country: string | null;
  created_at: string;
  listing_count: number;
}

interface BlockedEmail {
  id: number;
  email: string;
  reason: string | null;
  created_at: string;
}

export default function AdminUsers() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const page = Number(searchParams.get("page") || 1);
  const q = searchParams.get("q") || "";
  const status = searchParams.get("status") || "";
  const limit = 25;
  const [blocked, setBlocked] = useState<BlockedEmail[]>([]);
  const [showBlocked, setShowBlocked] = useState(false);
  const [purgingAll, setPurgingAll] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params: Record<string, any> = { page, limit };
    if (q) params.q = q;
    if (status) params.status = status;
    adminApi
      .get("/admin/users", { params })
      .then((res) => {
        setItems(res.data.items);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  }, [page, q, status]);

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

  async function toggleActive(id: string, current: boolean) {
    try {
      await adminApi.patch(`/admin/users/${id}`, { is_active: !current });
      setItems((prev) =>
        prev.map((u) => (u.id === id ? { ...u, is_active: !current } : u))
      );
      toast.success(current ? "User deactivated" : "User activated");
    } catch {
      toast.error("Failed to update user");
    }
  }

  const loadBlocked = useCallback(() => {
    adminApi.get<BlockedEmail[]>("/admin/blocked-emails").then((r) => setBlocked(r.data)).catch(() => {});
  }, []);
  useEffect(() => { loadBlocked(); }, [loadBlocked]);


  async function unblock(b: BlockedEmail) {
    if (!confirm(`Allow ${b.email} to sign up again?`)) return;
    await adminApi.delete(`/admin/blocked-emails/${b.id}`);
    setBlocked((prev) => prev.filter((x) => x.id !== b.id));
    toast.success("Unblocked");
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <AdminLayout>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-extrabold text-gray-900">
            Users
            {total > 0 && <span className="ml-2 text-lg font-normal text-gray-400">({total})</span>}
          </h1>
        </div>

        {purgingAll && (
          <PurgeDialog
            title={`Purge all ${total} suspended users?`}
            description={<>Permanently deletes every suspended account with their listings, photos, conversations, favorites and ratings, and blocks their emails from signing up again. This can't be undone.</>}
            onRun={async (reason) => (await adminApi.post("/admin/users/purge-suspended", { reason })).data}
            onClose={(purged) => { setPurgingAll(false); if (purged) { load(); loadBlocked(); } }}
          />
        )}
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            placeholder="Search name or email…"
            value={q}
            onChange={(e) => setParam("q", e.target.value)}
            className="input text-sm py-1.5 w-64"
          />
          <select value={status} onChange={(e) => setParam("status", e.target.value)} className="input text-sm py-1.5 w-auto">
            <option value="">All users</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          {status === "suspended" && total > 0 && (
            <button onClick={() => setPurgingAll(true)} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-sm font-medium hover:bg-red-50">
              <Trash2 size={14} /> Purge all {total} suspended
            </button>
          )}
        </div>

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">User</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Email</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Location</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Listings</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Joined</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
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
                    {status === "suspended" ? "No suspended users." : "No users found"}
                  </td>
                </tr>
              ) : (
                items.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-medium shrink-0">
                            {(user.full_name || user.email || "?")[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <Link to={`/admin/users/${user.id}`} className="font-medium text-gray-900 hover:text-ocean-700 flex items-center gap-1">
                            {user.full_name || user.email}
                            {user.is_trusted && <ShieldCheck size={13} className="text-ocean-600" aria-label="Trusted seller" />}
                          </Link>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{user.email}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {user.location ?? "—"}
                      {user.signup_country && <span className="ml-1.5 text-xs text-gray-400">({user.signup_country})</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{user.listing_count}</td>
                    <td className="px-4 py-3 text-gray-400 whitespace-nowrap">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleActive(user.id, user.is_active)}
                        className={`text-xs font-medium px-2 py-1 rounded-full transition-colors ${
                          user.is_active
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-red-100 text-red-700 hover:bg-red-200"
                        }`}
                      >
                        {user.is_active ? "Active" : "Suspended"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/profile/${user.id}`}
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

        <div className="mt-6">
          <button onClick={() => setShowBlocked((v) => !v)} className="text-sm text-gray-500 hover:text-ocean-700">
            {showBlocked ? "Hide" : "Show"} blocked emails ({blocked.length})
          </button>
          {showBlocked && (
            <div className="card mt-2 divide-y divide-gray-100">
              {blocked.length === 0 ? (
                <p className="px-4 py-3 text-sm text-gray-400">No blocked emails.</p>
              ) : blocked.map((b) => (
                <div key={b.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                  <span className="font-medium text-gray-800">{b.email}</span>
                  <span className="text-gray-400 truncate">{b.reason}</span>
                  <span className="ml-auto text-gray-400 whitespace-nowrap">{new Date(b.created_at).toLocaleDateString()}</span>
                  <button onClick={() => unblock(b)} className="text-ocean-700 hover:underline">Unblock</button>
                </div>
              ))}
            </div>
          )}
        </div>

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
      </AdminLayout>
  );
}
