import React, { ReactNode, Suspense } from "react";
import Header from "./Header";
import Footer from "./Footer";
import SEO from "./SEO";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <SEO />
      <Header />
      {/* Route chunks load lazily; keep header/footer up while they do. */}
      <main className="flex-1"><Suspense fallback={null}>{children}</Suspense></main>
      <Footer />
    </div>
  );
}
