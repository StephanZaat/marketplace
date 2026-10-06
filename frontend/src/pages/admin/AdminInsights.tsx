import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import adminApi from "../../adminApi";

type Measure = "signups" | "listings" | "conversations" | "messages";

interface Insights {
  weeks: ({ week: string } & Record<Measure, number>)[];
  totals: { users: number; active_listings: number; sellers: number; conversations: number; views: number };
  last30: { signups: number; listings: number; messages: number };
  prev30: { signups: number; listings: number; messages: number };
  top_listings: { id: string; title: string; views: number; favorites: number }[];
  top_categories: { name: string; count: number }[];
  signup_countries: { country: string; count: number }[];
  listing_countries: { country: string; count: number }[];
}

const MEASURES: { key: Measure; label: string }[] = [
  { key: "signups", label: "Sign-ups" },
  { key: "listings", label: "New listings" },
  { key: "conversations", label: "Conversations started" },
  { key: "messages", label: "Messages sent" },
];

const fmtWeek = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short" });

function Delta({ now, prev }: { now: number; prev: number }) {
  const diff = now - prev;
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs text-gray-500">
      <Icon size={13} /> {diff > 0 ? "+" : ""}{diff} vs previous 30 days
    </span>
  );
}

function StatTile({ label, value, sub }: { label: string; value: number; sub?: React.ReactNode }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-3xl font-extrabold text-gray-900 mt-1">{value.toLocaleString()}</div>
      {sub && <div className="mt-1">{sub}</div>}
    </div>
  );
}

/** One measure per chart (small multiples): different scales never share an axis. */
function WeeklyBars({ label, data, measure }: { label: string; data: Insights["weeks"]; measure: Measure }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((w) => w[measure]));
  const total = data.reduce((s, w) => s + w[measure], 0);
  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold text-gray-900">{label}</h3>
        <span className="text-sm text-gray-500">{total} in {data.length} weeks</span>
      </div>
      <div className="relative flex">
        <div className="flex flex-col justify-between text-[11px] text-gray-400 pr-2 h-32 text-right w-6">
          <span>{max}</span><span>0</span>
        </div>
        <div className="relative flex-1 h-32 border-b border-gray-200 flex items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
          {data.map((w, i) => (
            <div
              key={w.week}
              className="flex-1 h-full flex items-end justify-center cursor-default"
              onMouseEnter={() => setHover(i)}
            >
              <div
                className={`w-full max-w-6 rounded-t ${hover === i ? "bg-ocean-700" : "bg-ocean-600"}`}
                style={{ height: `${(w[measure] / max) * 100}%`, minHeight: w[measure] ? 2 : 0 }}
              />
            </div>
          ))}
          {hover !== null && (
            <div
              className="absolute -top-2 -translate-y-full -translate-x-1/2 bg-gray-900 text-white text-xs rounded-md px-2 py-1 whitespace-nowrap pointer-events-none"
              style={{ left: `${((hover + 0.5) / data.length) * 100}%` }}
            >
              Week of {fmtWeek(data[hover].week)}: <strong>{data[hover][measure]}</strong>
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-between text-[11px] text-gray-400 mt-1 pl-8">
        <span>{fmtWeek(data[0].week)}</span><span>this week</span>
      </div>
    </div>
  );
}

function HBars({ title, rows, empty }: { title: string; rows: { label: string; count: number }[]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="card p-5">
      <h3 className="font-semibold text-gray-900 mb-3">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-gray-400">{empty}</p> : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.label} className="grid grid-cols-[8rem_1fr] items-center gap-3 text-sm" title={`${r.label}: ${r.count}`}>
              <span className="truncate text-gray-700">{r.label}</span>
              <span className="flex items-center gap-2">
                <span className="h-4 rounded-r bg-ocean-600" style={{ width: `${(r.count / max) * 85}%`, minWidth: 2 }} />
                <span className="text-gray-600 tabular-nums">{r.count}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function AdminInsights() {
  const [data, setData] = useState<Insights | null>(null);
  const [weeks, setWeeks] = useState(12);
  const [asTable, setAsTable] = useState(false);

  useEffect(() => {
    adminApi.get<Insights>("/admin/insights", { params: { weeks } }).then((r) => setData(r.data));
  }, [weeks]);

  return (
    <AdminLayout>
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <h1 className="text-2xl font-extrabold text-gray-900 flex-1">Insights</h1>
        <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} className="input text-sm py-1.5 w-auto">
          <option value={8}>Last 8 weeks</option>
          <option value={12}>Last 12 weeks</option>
          <option value={26}>Last 26 weeks</option>
          <option value={52}>Last 52 weeks</option>
        </select>
        <button onClick={() => setAsTable((v) => !v)} className="btn-secondary text-sm py-1.5">
          {asTable ? "Show charts" : "Show as table"}
        </button>
      </div>

      {!data ? <p className="text-gray-400">Loading…</p> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            <StatTile label="Sign-ups (30 days)" value={data.last30.signups} sub={<Delta now={data.last30.signups} prev={data.prev30.signups} />} />
            <StatTile label="New listings (30 days)" value={data.last30.listings} sub={<Delta now={data.last30.listings} prev={data.prev30.listings} />} />
            <StatTile label="Messages (30 days)" value={data.last30.messages} sub={<Delta now={data.last30.messages} prev={data.prev30.messages} />} />
            <StatTile label="Live listings" value={data.totals.active_listings} sub={<span className="text-xs text-gray-500">from {data.totals.sellers} sellers</span>} />
            <StatTile label="Listing views (all time)" value={data.totals.views} sub={<span className="text-xs text-gray-500">{data.totals.users} active users</span>} />
          </div>

          {asTable ? (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-gray-600 font-medium">Week of</th>
                    {MEASURES.map((m) => <th key={m.key} className="text-right px-4 py-2.5 text-gray-600 font-medium">{m.label}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.weeks.map((w) => (
                    <tr key={w.week}>
                      <td className="px-4 py-2 text-gray-700">{fmtWeek(w.week)}</td>
                      {MEASURES.map((m) => <td key={m.key} className="px-4 py-2 text-right tabular-nums text-gray-700">{w[m.key]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {MEASURES.map((m) => <WeeklyBars key={m.key} label={m.label} data={data.weeks} measure={m.key} />)}
            </div>
          )}

          <div className="grid lg:grid-cols-3 gap-4">
            <div className="card overflow-hidden lg:col-span-1">
              <h3 className="font-semibold text-gray-900 px-5 pt-5 pb-3">Most viewed listings</h3>
              {data.top_listings.length === 0 ? <p className="px-5 pb-5 text-sm text-gray-400">No live listings yet.</p> : (
                <table className="w-full text-sm">
                  <thead className="text-gray-500 text-xs">
                    <tr><th className="text-left px-5 pb-2 font-medium">Listing</th><th className="text-right pb-2 font-medium">Views</th><th className="text-right px-5 pb-2 font-medium">Saves</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.top_listings.map((l) => (
                      <tr key={l.id}>
                        <td className="px-5 py-2 max-w-0 w-full"><Link to={`/admin/listings/${l.id}`} className="block truncate text-gray-800 hover:text-ocean-700">{l.title}</Link></td>
                        <td className="py-2 text-right tabular-nums text-gray-700">{l.views}</td>
                        <td className="px-5 py-2 text-right tabular-nums text-gray-700">{l.favorites}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <HBars title="Live listings by category" rows={data.top_categories.map((c) => ({ label: c.name, count: c.count }))} empty="No live listings yet." />
            <HBars
              title="Sign-ups by country"
              rows={data.signup_countries.map((c) => ({ label: c.country, count: c.count }))}
              empty="Tracked for sign-ups from now on."
            />
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
