import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, MessageSquare, ExternalLink, X } from "lucide-react";
import AdminHeader from "../../components/AdminHeader";
import adminApi from "../../adminApi";

interface ConvListing {
  id: string;
  title: string;
  images: string[];
}

interface AdminConversation {
  id: string;
  listing: ConvListing | null;
  buyer_name: string | null;
  seller_name: string | null;
  message_count: number;
  last_message: string | null;
  updated_at: string;
}

interface AdminMessage {
  id: number;
  body: string;
  sender_name: string | null;
  is_read: boolean;
  created_at: string;
}

export default function AdminMessages() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<AdminConversation[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const page = Number(searchParams.get("page") || 1);
  const limit = 25;

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .get("/admin/messages", { params: { page, limit, q: q || undefined } })
      .then((res) => {
        setItems(res.data.items);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  }, [page, q]);

  useEffect(() => {
    load();
  }, [load]);

  function setPage(p: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(p));
    setSearchParams(next);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    next.set("q", q);
    next.set("page", "1");
    setSearchParams(next);
  }

  async function openConversation(id: string) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    setLoadingMessages(true);
    try {
      const res = await adminApi.get(`/admin/messages/${id}`);
      setMessages(res.data);
    } finally {
      setLoadingMessages(false);
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Messages
            <span className="ml-2 text-lg font-normal text-gray-400">({total} conversations)</span>
          </h1>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search user or listing…"
              className="input text-sm py-1.5 w-56"
            />
            <button type="submit" className="btn-secondary text-sm py-1.5 px-3">
              Search
            </button>
          </form>
        </div>

        {loading ? (
          <p className="text-gray-400">Loading…</p>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            No conversations
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((conv) => (
              <div key={conv.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Conversation row */}
                <div
                  className="flex gap-4 p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => openConversation(conv.id)}
                >
                  {/* Thumbnail */}
                  {conv.listing?.images?.[0] ? (
                    <img
                      src={conv.listing.images[0]}
                      alt=""
                      className="w-14 h-14 rounded-lg object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center">
                      <MessageSquare size={20} className="text-gray-300" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900 truncate">
                            {conv.listing?.title ?? "Deleted listing"}
                          </span>
                          {conv.listing && (
                            <Link
                              to={`/listings/${conv.listing.id}`}
                              target="_blank"
                              onClick={(e) => e.stopPropagation()}
                              className="text-gray-400 hover:text-gray-700"
                            >
                              <ExternalLink size={13} />
                            </Link>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          <span className="font-medium">{conv.buyer_name}</span>
                          <span className="text-gray-300 mx-1">→</span>
                          <span className="font-medium">{conv.seller_name}</span>
                          <span className="text-gray-300 mx-1.5">·</span>
                          <span>{conv.message_count} messages</span>
                        </div>
                        {conv.last_message && (
                          <p className="text-xs text-gray-400 mt-1 truncate">{conv.last_message}</p>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 shrink-0">
                        {new Date(conv.updated_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded messages */}
                {expanded === conv.id && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Thread</span>
                      <button onClick={() => setExpanded(null)} className="text-gray-400 hover:text-gray-600">
                        <X size={14} />
                      </button>
                    </div>
                    {loadingMessages ? (
                      <p className="text-xs text-gray-400">Loading messages…</p>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {messages.map((msg) => (
                          <div key={msg.id} className="flex gap-2.5">
                            <div className="w-6 h-6 rounded-full bg-ocean-100 text-ocean-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                              {(msg.sender_name ?? "?")[0].toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2">
                                <span className="text-xs font-medium text-gray-700">{msg.sender_name}</span>
                                <span className="text-xs text-gray-400">
                                  {new Date(msg.created_at).toLocaleString()}
                                </span>
                                {!msg.is_read && (
                                  <span className="text-xs px-1 py-0.5 rounded bg-blue-100 text-blue-600">unread</span>
                                )}
                              </div>
                              <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap break-words">{msg.body}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
            <span>Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="flex items-center gap-1 px-3 py-1 rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-40"
              >
                <ChevronLeft size={14} /> Prev
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
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
