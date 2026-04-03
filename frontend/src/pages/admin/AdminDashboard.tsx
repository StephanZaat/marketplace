import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users, List, Flag, ShoppingBag } from "lucide-react";
import AdminHeader from "../../components/AdminHeader";
import adminApi from "../../adminApi";

interface Stats {
  total_users: number;
  active_users: number;
  total_listings: number;
  active_listings: number;
  sold_listings: number;
  inactive_listings: number;
  total_reports: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    adminApi.get("/admin/stats").then((res) => setStats(res.data));
  }, []);

  const cards = stats
    ? [
        {
          label: "Users",
          value: stats.total_users,
          sub: `${stats.active_users} active`,
          icon: Users,
          to: "/admin/users",
          color: "bg-blue-50 text-blue-600",
        },
        {
          label: "Listings",
          value: stats.total_listings,
          sub: `${stats.active_listings} active · ${stats.sold_listings} sold`,
          icon: List,
          to: "/admin/listings",
          color: "bg-green-50 text-green-600",
        },
        {
          label: "Inactive",
          value: stats.inactive_listings,
          sub: "soft-deleted listings",
          icon: ShoppingBag,
          to: "/admin/listings?status=inactive",
          color: "bg-gray-50 text-gray-600",
        },
        {
          label: "Reports",
          value: stats.total_reports,
          sub: "pending review",
          icon: Flag,
          to: "/admin/reports",
          color: stats.total_reports > 0 ? "bg-red-50 text-red-600" : "bg-gray-50 text-gray-600",
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>
        {!stats ? (
          <p className="text-gray-500">Loading…</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {cards.map(({ label, value, sub, icon: Icon, to, color }) => (
              <Link
                key={label}
                to={to}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className={`inline-flex p-2 rounded-lg ${color} mb-3`}>
                  <Icon size={20} />
                </div>
                <div className="text-3xl font-bold text-gray-900">{value}</div>
                <div className="text-sm font-medium text-gray-700 mt-0.5">{label}</div>
                <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
