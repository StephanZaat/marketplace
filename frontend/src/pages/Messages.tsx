import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Send, MessageCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import toast from "react-hot-toast";
import api, { Conversation, Message, PendingRating } from "../api";
import { useAuth } from "../contexts/AuthContext";
import { useLang } from "../contexts/LanguageContext";
import RatingModal from "../components/RatingModal";

export default function Messages() {
  const { convId } = useParams<{ convId?: string }>();
  const { user } = useAuth();
  const { t, lang } = useLang();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation | null>(null);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [pendingRatings, setPendingRatings] = useState<PendingRating[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    api.get<Conversation[]>("/messages").then((r) => {
      setConversations(r.data);
      if (convId) {
        const found = r.data.find((c) => c.id === convId);
        if (found) setActive(found);
      } else if (r.data.length > 0) {
        setActive(r.data[0]);
      }
    }).catch(() => {});
    api.get<PendingRating[]>("/ratings/pending").then((r) => setPendingRatings(r.data)).catch(() => {});
  }, [user, navigate, convId]);

  useEffect(() => {
    if (active) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [active?.messages.length]);

  const openConversation = async (conv: Conversation) => {
    try {
      const res = await api.get<Conversation>(`/messages/${conv.id}`);
      setActive(res.data);
      setConversations((prev) => prev.map((c) => c.id === res.data.id ? res.data : c));
      navigate(`/messages/${conv.id}`, { replace: true });
    } catch {
      setActive(conv);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active || !newMsg.trim()) return;
    setSending(true);
    try {
      const res = await api.post<Message>(`/messages/${active.id}`, { body: newMsg });
      setActive((prev) => prev ? { ...prev, messages: [...prev.messages, res.data] } : prev);
      setNewMsg("");
    } catch {
      toast.error(t.failedToSendMsg);
    } finally {
      setSending(false);
    }
  };

  if (!user) return null;

  return (
    <>
    {pendingRatings.length > 0 && (
      <RatingModal
        pending={pendingRatings[0]}
        onDismiss={() => setPendingRatings((prev) => prev.slice(1))}
        onSubmitted={() => setPendingRatings((prev) => prev.slice(1))}
      />
    )}
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t.messagesTitle}</h1>

      {conversations.length === 0 ? (
        <div className="card p-12 text-center text-gray-400">
          <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{t.noConversations}</p>
          <p className="text-sm mt-1">{t.noConversationsHint}</p>
        </div>
      ) : (
        <div className="card overflow-hidden flex h-[600px]">
          {/* Conversation list */}
          <div className="w-72 border-r border-gray-200 overflow-y-auto shrink-0">
            {conversations.map((conv) => {
              const other = user.id === conv.buyer_id ? conv.seller : conv.buyer;
              const lastMsg = conv.messages[conv.messages.length - 1];
              return (
                <button
                  key={conv.id}
                  onClick={() => openConversation(conv)}
                  className={`w-full text-left p-4 border-b border-gray-100 hover:bg-gray-50 transition-colors ${active?.id === conv.id ? "bg-ocean-50 border-ocean-100" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-ocean-100 text-ocean-600 flex items-center justify-center font-semibold text-sm shrink-0">
                      {other?.full_name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-gray-900 truncate">{other?.full_name ?? t.unknownUser}</span>
                        {conv.unread_count > 0 && (
                          <span className="ml-2 min-w-[18px] h-[18px] rounded-full bg-ocean-600 text-white text-xs flex items-center justify-center px-1">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 truncate mt-0.5">{conv.listing?.title ?? t.listingLabel}</div>
                      {lastMsg && (
                        <div className="text-xs text-gray-400 truncate mt-0.5">{lastMsg.body}</div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Chat panel */}
          {active ? (
            <div className="flex-1 flex flex-col min-w-0">
              {/* Chat header */}
              <div className="p-4 border-b border-gray-200 bg-gray-50 shrink-0">
                {active.listing ? (
                  <div className="flex items-center gap-2 min-w-0">
                    <Link to={`/listings/${active.listing.id}`} className="font-semibold text-gray-900 text-sm truncate hover:text-ocean-600 hover:underline">
                      {active.listing.title}
                    </Link>
                    {active.listing.status !== "active" && (() => {
                      const s = active.listing.status;
                      const cls = s === "sold" ? "bg-green-100 text-green-700" : s === "reserved" ? "bg-amber-100 text-amber-700" : s === "expired" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600";
                      const label = s === "sold" ? t.statusSold : s === "reserved" ? t.reserved : s === "expired" ? t.statusExpired : s === "inactive" ? t.statusInactive : s;
                      return <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>;
                    })()}
                  </div>
                ) : (
                  <div className="font-semibold text-gray-900 text-sm truncate">{t.listingLabel}</div>
                )}
                <div className="text-xs text-gray-500">
                  {t.withSeller}{" "}
                  {(() => {
                    const other = user.id === active.buyer_id ? active.seller : active.buyer;
                    return other?.id
                      ? <Link to={`/profile/${other.id}`} className="hover:text-ocean-600 hover:underline">{other.full_name ?? t.sellerLabel}</Link>
                      : <span>{user.id === active.buyer_id ? (active.seller?.full_name ?? t.sellerLabel) : (active.buyer?.full_name ?? t.buyerLabel)}</span>;
                  })()}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {active.messages.map((msg) => {
                  const isMine = msg.sender_id === user.id;
                  const other = user.id === active.buyer_id ? active.seller : active.buyer;
                  return (
                    <div key={msg.id} className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
                      {!isMine && (
                        other?.avatar_url
                          ? <img src={other.avatar_url} alt={other.full_name ?? ""} className="w-7 h-7 rounded-full object-cover shrink-0" />
                          : <div className="w-7 h-7 rounded-full bg-ocean-100 text-ocean-600 flex items-center justify-center text-xs font-semibold shrink-0">{(other?.full_name ?? "?")[0].toUpperCase()}</div>
                      )}
                      <div className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${isMine ? "bg-ocean-600 text-white rounded-br-sm" : "bg-gray-100 text-gray-900 rounded-bl-sm"}`}>
                        <p className="whitespace-pre-wrap break-words">{msg.body}</p>
                        <div className={`text-xs mt-1 ${isMine ? "text-ocean-200" : "text-gray-400"}`}>
                          {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true, locale: lang === "es" ? es : undefined })}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <form onSubmit={handleSend} className="p-4 border-t border-gray-200 flex gap-2 shrink-0">
                <input
                  type="text"
                  value={newMsg}
                  onChange={(e) => setNewMsg(e.target.value)}
                  placeholder={t.typeMessage}
                  className="input flex-1 text-sm"
                />
                <button type="submit" disabled={sending || !newMsg.trim()} className="btn-primary px-4">
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              {t.selectConversation}
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
}
