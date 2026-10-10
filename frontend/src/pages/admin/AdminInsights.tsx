import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import adminApi from "../../adminApi";
import { ColumnChart, Delta, HBars, StatTile, fmtDay } from "./charts";

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
                      <td className="px-4 py-2 text-gray-700">{fmtDay(w.week)}</td>
                      {MEASURES.map((m) => <td key={m.key} className="px-4 py-2 text-right tabular-nums text-gray-700">{w[m.key]}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {MEASURES.map((m) => (
                <ColumnChart
                  key={m.key}
                  title={m.label}
                  subtitle={`${data.weeks.reduce((s, w) => s + w[m.key], 0)} in ${data.weeks.length} weeks`}
                  data={data.weeks.map((w) => ({ key: w.week, label: `Week of ${fmtDay(w.week)}`, value: w[m.key] }))}
                  lastLabel="this week"
                />
              ))}
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
