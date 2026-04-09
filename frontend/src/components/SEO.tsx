import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  canonical?: string;
  jsonLd?: Record<string, unknown>;
}

const SITE_ORIGIN = "https://marketplace.aw";

const defaults = {
  title: "Marketplace.aw — Buy & Sell Locally in Aruba",
  description:
    "The local marketplace for Aruba. Buy and sell products, services, and more.",
  image: "/og-image.jpg",
};

export default function SEO({ title, description, image, url, canonical, jsonLd }: SEOProps) {
  const t = title ? `${title} | Marketplace.aw` : defaults.title;
  const d = description || defaults.description;
  const img = image || defaults.image;
  const path = canonical
    ?? (typeof window !== "undefined" ? window.location.pathname : "/");
  const canonicalUrl = path.startsWith("http") ? path : `${SITE_ORIGIN}${path}`;
  const ogUrl = url ?? canonicalUrl;

  return (
    <Helmet>
      <title>{t}</title>
      <meta name="description" content={d} />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:title" content={t} />
      <meta property="og:description" content={d} />
      <meta property="og:image" content={img} />
      <meta property="og:type" content="website" />
      <meta property="og:url" content={ogUrl} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={t} />
      <meta name="twitter:description" content={d} />
      <meta name="twitter:image" content={img} />
      <link rel="alternate" hrefLang="en" href={canonicalUrl} />
      <link rel="alternate" hrefLang="es" href={canonicalUrl} />
      <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />
      {jsonLd && (
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      )}
    </Helmet>
  );
}
