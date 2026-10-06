import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, List, Users, Flag, MessageSquare, Shield, LogOut, BarChart3, FolderTree, ExternalLink,
} from "lucide-react";
import { useAdminAuth } from "../contexts/AdminAuthContext";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/insights", label: "Insights", icon: BarChart3 },
  { to: "/admin/listings", label: "Listings", icon: List },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/categories", label: "Categories", icon: FolderTree },
  { to: "/admin/reports", label: "Reports", icon: Flag },
  { to: "/admin/messages", label: "Messages", icon: MessageSquare },
  { to: "/admin/security", label: "Security", icon: Shield },
];

// Mirrors the public site header (white, ocean/sand logo) so admin feels part of it.
export default function AdminHeader() {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/admin/login");
  }

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          <Link to="/admin" className="flex items-center shrink-0 gap-1.5 group">
            <span className="text-xl leading-none">🇦🇼</span>
            <span className="font-extrabold text-xl">
              <span className="text-ocean-700 group-hover:text-ocean-600 transition-colors">Marketplace</span>
              <span className="text-sand-500">.aw</span>
            </span>
            <span className="ml-1 text-[11px] font-semibold uppercase tracking-wider bg-ocean-50 text-ocean-700 border border-ocean-200 rounded-full px-2 py-0.5">
              Admin
            </span>
          </Link>
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <a href="/" target="_blank" rel="noreferrer" className="hidden sm:flex items-center gap-1 hover:text-ocean-700">
              View site <ExternalLink size={13} />
            </a>
            <span className="hidden sm:inline text-gray-700 font-medium">{admin?.username}</span>
            <button onClick={handleLogout} className="flex items-center gap-1 hover:text-ocean-700 transition-colors">
              <LogOut size={15} /> Logout
            </button>
          </div>
        </div>
        <nav className="flex items-center gap-1 -mb-px overflow-x-auto scrollbar-none">
          {navItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? "border-ocean-600 text-ocean-700"
                    : "border-transparent text-gray-500 hover:text-ocean-700 hover:border-ocean-200"
                }`
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  );
}
