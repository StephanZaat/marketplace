import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, ExternalLink, Trash2, ShieldX } from "lucide-react";
import AdminHeader from "../../components/AdminHeader";
import adminApi from "../../adminApi";
import toast from "react-hot-toast";

interface ReportedListing {
  id: string;
  title: string;
  status: string;
  images: string[];
}

interface AdminReport {
  id: number;
  reason: string;
  details: string | null;
  created_at: string;
  listing: ReportedListing | null;
  reporter_name: string | null;
}

export default function AdminReports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<AdminReport[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const page = Number(searchParams.get("page") || 1);
  const limit = 25;

  const load = useCallback(() => {
    setLoading(true);
    adminApi
      .get("/admin/reports", { params: { page, limit } })
      .then((res) => {
        setItems(res.data.items);
        setTotal(res.data.total);
      })
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => {
    load();
  }, [load]);

  function setPage(p: number) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(p));
    setSearchParams(next);
  }

  async function dismiss(id: number) {
    try {
      await adminApi.delete(`/admin/reports/${id}`);
      setItems((prev) => prev.filter((r) => r.id !== id));
      setTotal((t) => t - 1);
      toast.success("Report dismissed");
    } catch {
      toast.error("Failed to dismiss report");
    }
  }

  async function takeAction(id: number) {
    try {
      await adminApi.post(`/admin/reports/${id}/action`);
      setItems((prev) => prev.filter((r) => r.id !== id));
      setTotal((t) => t - 1);
      toast.success("Listing deactivated and report dismissed");
    } catch {
      toast.error("Failed to take action");
    }
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Reports
            {total > 0 && (
              <span className="ml-2 text-lg font-normal text-red-400">({total} pending)</span>
            )}
          </h1>
        </div>

        {loading ? (
          <p className="text-gray-400">Loading…</p>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
            No pending reports
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((report) => (
              <div
                key={report.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex gap-4"
              >
                {/* Listing thumbnail */}
                {report.listing?.images?.[0] ? (
                  <img
                    src={report.listing.images[0]}
                    alt=""
                    className="w-20 h-20 rounded-lg object-cover shrink-0"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-lg bg-gray-100 shrink-0" />
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-900 line-clamp-1">
                          {report.listing?.title ?? "Deleted listing"}
                        </span>
                        {report.listing && (
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded-full ${
                              report.listing.status === "active"
                                ? "bg-green-100 text-green-700"
                                : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {report.listing.status}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        <span className="font-medium text-gray-700">{report.reason}</span>
                        {report.details && <span className="ml-2">— {report.details}</span>}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        Reported by {report.reporter_name ?? "anonymous"} ·{" "}
                        {new Date(report.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {report.listing && (
                        <Link
                          to={`/listings/${report.listing.id}`}
                          target="_blank"
                          className="text-gray-400 hover:text-gray-700"
                          title="View listing"
                        >
                          <ExternalLink size={15} />
                        </Link>
                      )}
                      <button
                        onClick={() => dismiss(report.id)}
                        title="Dismiss report"
                        className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                      >
                        <Trash2 size={13} />
                        Dismiss
                      </button>
                      {report.listing && report.listing.status !== "inactive" && (
                        <button
                          onClick={() => takeAction(report.id)}
                          title="Deactivate listing"
                          className="flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 transition-colors"
                        >
                          <ShieldX size={13} />
                          Deactivate
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
            <span>
              Page {page} of {totalPages}
            </span>
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
