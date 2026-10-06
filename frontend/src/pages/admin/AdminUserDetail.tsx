import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, ShieldCheck, Star, Trash2, UserX, UserCheck, Flag } from "lucide-react";
import toast from "react-hot-toast";
import AdminLayout from "../../components/AdminLayout";
import adminApi from "../../adminApi";
import { STATUS_BADGE } from "./adminStyles";

interface UserListing {
  id: string;
  title: string;
  price: string;
  status: string;
  category: string | null;
  created_country: string | null;
  view_count: number;
  image: string | null;
  created_at: string;
}

interface UserConversation {
  id: string;
  listing_title: string | null;
  role: "buyer" | "seller";
  other_party: string | null;
  message_count: number;
  updated_at: string;
}

interface UserDetail {
  id: string;
  email: string;
  full_name: string | null;
  location: string | null;
  phone: string | null;
  whatsapp: string | null;
  avatar_url: string | null;
  is_active: boolean;
  is_trusted: boolean;
  signup_country: string | null;
  admin_note: string | null;
  created_at: string;
  rating_avg: number | null;
  rating_count: number;
  reports_against: number;
  listings: UserListing[];
  conversations: UserConversation[];
}

export default function AdminUserDetail() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    adminApi.get<UserDetail>(`/admin/users/${userId}`).then((r) => {
      setUser(r.data);
      setNote(r.data.admin_note ?? "");
    }).catch(() => toast.error("User not found"));
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  if (!user) return <AdminLayout><p className="text-gray-400">Loading…</p></AdminLayout>;

  async function setActive(active: boolean) {
    if (!active && !confirm("Suspend this user? Their live and pending listings are taken down.")) return;
    await adminApi.patch(`/admin/users/${user!.id}`, { is_active: active });
    toast.success(active ? "User reactivated" : "User suspended");
    load();
  }

  async function setTrusted(trusted: boolean) {
    await adminApi.patch(`/admin/users/${user!.id}/meta`, { is_trusted: trusted });
    toast.success(trusted ? "Seller trusted: listings skip review" : "Trust removed");
    load();
  }

  async function saveNote() {
    await adminApi.patch(`/admin/users/${user!.id}/meta`, { admin_note: note });
    toast.success("Note saved");
  }

  async function purge() {
    const reason = prompt(
      `Permanently delete ${user!.email} and everything they created? Their email will be blocked.\n\nReason (optional):`,
      "spam",
    );
    if (reason === null) return;
    const { data } = await adminApi.post(`/admin/users/${user!.id}/purge`, { reason });
    toast.success(`Purged: ${data.listings} listings, ${data.conversations} conversations, ${data.images} photos`);
    navigate("/admin/users?status=suspended");
  }

  return (
    <AdminLayout>
      <Link to="/admin/users" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-ocean-700 mb-4">
        <ArrowLeft size={14} /> Users
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Profile + actions */}
        <div className="space-y-4">
          <div className="card p-5">
            <div className="flex items-center gap-3 mb-4">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-14 h-14 rounded-full object-cover" />
              ) : (
                <div className="w-14 h-14 rounded-full bg-ocean-100 text-ocean-700 flex items-center justify-center text-xl font-bold">
                  {(user.full_name || user.email)[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-lg font-extrabold text-gray-900 truncate">{user.full_name || "—"}</h1>
                <p className="text-sm text-gray-500 truncate">{user.email}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-4">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${user.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {user.is_active ? "Active" : "Suspended"}
              </span>
              {user.is_trusted && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-ocean-50 text-ocean-700 inline-flex items-center gap-1">
                  <ShieldCheck size={12} /> Trusted
                </span>
              )}
            </div>
            <dl className="text-sm space-y-1.5">
              {[
                ["Joined", new Date(user.created_at).toLocaleDateString()],
                ["Signed up from", user.signup_country ?? "unknown"],
                ["Location", user.location ?? "—"],
                ["Phone", user.phone ?? "—"],
                ["WhatsApp", user.whatsapp ?? "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="text-gray-800 text-right">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Rating</dt>
                <dd className="text-gray-800 inline-flex items-center gap-1">
                  {user.rating_avg !== null ? <><Star size={13} className="text-sand-500 fill-sand-400" />{user.rating_avg} ({user.rating_count})</> : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Reports on listings</dt>
                <dd className={user.reports_against ? "text-red-700 font-medium inline-flex items-center gap-1" : "text-gray-800"}>
                  {user.reports_against > 0 && <Flag size={12} />}{user.reports_against}
                </dd>
              </div>
            </dl>
          </div>

          <div className="card p-5 space-y-2">
            <a href={`/profile/${user.id}`} target="_blank" rel="noreferrer" className="btn-secondary w-full text-sm">
              <ExternalLink size={14} /> Public profile
            </a>
            <button onClick={() => setTrusted(!user.is_trusted)} className="btn-secondary w-full text-sm">
              <ShieldCheck size={14} /> {user.is_trusted ? "Remove trust" : "Trust seller"}
            </button>
            {user.is_active ? (
              <button onClick={() => setActive(false)} className="btn-secondary w-full text-sm text-red-700 border-red-200 hover:bg-red-50">
                <UserX size={14} /> Suspend
              </button>
            ) : (
              <>
                <button onClick={() => setActive(true)} className="btn-secondary w-full text-sm">
                  <UserCheck size={14} /> Reactivate
                </button>
                <button onClick={purge} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700">
                  <Trash2 size={14} /> Purge &amp; block email
                </button>
              </>
            )}
          </div>

          <div className="card p-5">
            <label className="block text-sm font-semibold text-gray-700 mb-2">Admin note <span className="font-normal text-gray-400">(private)</span></label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} className="input text-sm" placeholder="e.g. Knows the owner; sells bikes" />
            <button onClick={saveNote} disabled={note === (user.admin_note ?? "")} className="btn-primary text-sm mt-2">Save note</button>
          </div>
        </div>

        {/* Listings + conversations */}
        <div className="lg:col-span-2 space-y-6">
          <section className="card overflow-hidden">
            <h2 className="px-5 py-3 font-bold text-gray-900 border-b border-gray-100">Listings ({user.listings.length})</h2>
            {user.listings.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400">No listings.</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {user.listings.map((l) => (
                  <li key={l.id}>
                    <Link to={`/admin/listings/${l.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50">
                      {l.image ? <img src={l.image} alt="" className="w-11 h-11 rounded-lg object-cover" /> : <div className="w-11 h-11 rounded-lg bg-gray-100" />}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 truncate">{l.title}</p>
                        <p className="text-xs text-gray-500">
                          {l.category} · ƒ{l.price} · {l.view_count} views
                          {l.created_country && ` · posted from ${l.created_country}`}
                        </p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[l.status] ?? "bg-gray-100 text-gray-600"}`}>{l.status}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card overflow-hidden">
            <h2 className="px-5 py-3 font-bold text-gray-900 border-b border-gray-100">Conversations ({user.conversations.length})</h2>
            {user.conversations.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400">No conversations.</p>
            ) : (
              <ul className="divide-y divide-gray-100 text-sm">
                {user.conversations.map((c) => (
                  <li key={c.id} className="px-5 py-3 flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${c.role === "seller" ? "bg-sand-100 text-sand-800" : "bg-ocean-50 text-ocean-700"}`}>{c.role}</span>
                    <span className="truncate text-gray-800">{c.listing_title ?? "(deleted listing)"}</span>
                    <span className="text-gray-400 truncate">with {c.other_party ?? "?"}</span>
                    <span className="ml-auto text-gray-400 whitespace-nowrap">{c.message_count} msgs · {new Date(c.updated_at).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </AdminLayout>
  );
}
