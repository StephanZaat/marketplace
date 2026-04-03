import React, { ReactNode } from "react";
import Header from "./Header";
import Footer from "./Footer";
import SEO from "./SEO";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <SEO />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
