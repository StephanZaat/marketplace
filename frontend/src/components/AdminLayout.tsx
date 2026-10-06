import React, { ReactNode } from "react";
import AdminHeader from "./AdminHeader";

const WIDTHS = { wide: "max-w-7xl", narrow: "max-w-2xl" } as const;

export default function AdminLayout({ children, width = "wide" }: { children: ReactNode; width?: keyof typeof WIDTHS }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <AdminHeader />
      <main className={`${WIDTHS[width]} mx-auto px-4 sm:px-6 lg:px-8 py-8`}>{children}</main>
    </div>
  );
}
