import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, List, Users, Flag, MessageSquare, Shield, LogOut } from "lucide-react";
import { useAdminAuth } from "../contexts/AdminAuthContext";

const navItems = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/listings", label: "Listings", icon: List },
  { to: "/admin/users", label: "Users", icon: Users },
  { to: "/admin/reports", label: "Reports", icon: Flag },
  { to: "/admin/messages", label: "Messages", icon: MessageSquare },
  { to: "/admin/security", label: "Security", icon: Shield },
];

export default function AdminHeader() {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/admin/login");
  }

  return (
    <header className="bg-gray-900 text-white">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <span className="font-bold text-sm tracking-wide text-white/80 uppercase">
            Marketplace.aw Admin
          </span>
          <nav className="flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors ${
                    isActive
                      ? "bg-white/15 text-white"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  }`
                }
              >
                <Icon size={14} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 text-sm text-white/60">
          <span>{admin?.username}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 text-white/50 hover:text-white transition-colors"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
