import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AdminLayout from "../../components/AdminLayout";
import adminApi from "../../adminApi";
import { ColumnChart, Delta, HBars, StatTile, fmtDay } from "./charts";

interface Summary { visitors: number; pageviews: number; pages_per_visitor: number }
interface Named { name: string; count: number }

interface Traffic {
  days: number;
  current: Summary;
  previous: Summary;
  live: number;
  series: { date: string; visitors: number; pageviews: number }[];
  top_pages: { path: string; title: string | null; pageviews: number; visitors: number }[];
  sources: Named[];
  countries: Named[];
  devices: Named[];
  os: Named[];
}

const rows = (xs: Named[]) => xs.map((x) => ({ label: x.name, count: x.count }));

export default function AdminVisitors() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<Traffic | null>(null);
  const [asTable, setAsTable] = useState(false);

  useEffect(() => {
    setData(null);
    adminApi.get<Traffic>("/admin/traffic", { params: { days } }).then((r) => setData(r.data));
  }, [days]);

  const vs = `vs previous ${days} days`;

  return (
    <AdminLayout>
      <div className="flex items-center gap-3 mb-1 flex-wrap">
        <h1 className="text-2xl font-extrabold text-gray-900 flex-1">Visitors</h1>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="input text-sm py-1.5 w-auto">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={365}>Last 12 months</option>
        </select>
        <button onClick={() => setAsTable((v) => !v)} className="btn-secondary text-sm py-1.5">
          {asTable ? "Show charts" : "Show as table"}
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        Counted by the site itself: no cookies, no IP addresses stored. Bots, admin pages and your own browsing
        (while logged in to admin) are left out. Visitors are counted per day, Aruba time.
      </p>

      {!data ? <p className="text-gray-400">Loading…</p> : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatTile label="Visitors" value={data.current.visitors} sub={<Delta now={data.current.visitors} prev={data.previous.visitors} unit={vs} />} />
            <StatTile label="Page views" value={data.current.pageviews} sub={<Delta now={data.current.pageviews} prev={data.previous.pageviews} unit={vs} />} />
            <StatTile label="Pages per visitor" value={data.current.pages_per_visitor} sub={<Delta now={data.current.pages_per_visitor} prev={data.previous.pages_per_visitor} unit={vs} />} />
            <StatTile label="On the site now" value={data.live} sub={<span className="text-xs text-gray-500">visitors in the last 30 minutes</span>} />
          </div>

          {asTable ? (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-gray-600 font-medium">Day</th>
                    <th className="text-right px-4 py-2.5 text-gray-600 font-medium">Visitors</th>
                    <th className="text-right px-4 py-2.5 text-gray-600 font-medium">Page views</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {[...data.series].reverse().map((d) => (
                    <tr key={d.date}>
                      <td className="px-4 py-2 text-gray-700">{fmtDay(d.date)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-700">{d.visitors}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-gray-700">{d.pageviews}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              <ColumnChart
                title="Visitors per day"
                data={data.series.map((d) => ({ key: d.date, label: fmtDay(d.date), value: d.visitors }))}
                lastLabel="today"
              />
              <ColumnChart
                title="Page views per day"
                data={data.series.map((d) => ({ key: d.date, label: fmtDay(d.date), value: d.pageviews }))}
                lastLabel="today"
              />
            </div>
          )}

          <div className="card overflow-hidden">
            <h3 className="font-semibold text-gray-900 px-5 pt-5 pb-3">Top pages</h3>
            {data.top_pages.length === 0 ? <p className="px-5 pb-5 text-sm text-gray-400">No visits recorded yet.</p> : (
              <table className="w-full text-sm">
                <thead className="text-gray-500 text-xs">
                  <tr>
                    <th className="text-left px-5 pb-2 font-medium">Page</th>
                    <th className="text-right pb-2 font-medium">Visitors</th>
                    <th className="text-right px-5 pb-2 font-medium">Views</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.top_pages.map((p) => (
                    <tr key={p.path}>
                      <td className="px-5 py-2 max-w-0 w-full">
                        {p.title ? (
                          <Link to={`/admin/listings/${p.path.split("/")[2]}`} className="block truncate text-gray-800 hover:text-ocean-700">
                            {p.title} <span className="text-gray-400">{p.path}</span>
                          </Link>
                        ) : (
                          <span className="block truncate text-gray-800">{p.path}</span>
                        )}
                      </td>
                      <td className="py-2 text-right tabular-nums text-gray-700">{p.visitors}</td>
                      <td className="px-5 py-2 text-right tabular-nums text-gray-700">{p.pageviews}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="grid lg:grid-cols-2 xl:grid-cols-4 gap-4">
            <HBars title="Where visitors come from" rows={rows(data.sources)} empty="No visits yet." />
            <HBars title="Countries" rows={rows(data.countries)} empty="No visits yet." />
            <HBars title="Devices" rows={rows(data.devices)} empty="No visits yet." />
            <HBars title="Operating systems" rows={rows(data.os)} empty="No visits yet." />
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
