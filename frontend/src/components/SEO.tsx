import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
}

const defaults = {
  title: "Marketplace.aw — Buy & Sell Locally in Aruba",
  description:
    "The local marketplace for Aruba. Buy and sell products, services, and more.",
  image: "/og-image.png",
};

export default function SEO({ title, description, image, url }: SEOProps) {
  const t = title ? `${title} | Marketplace.aw` : defaults.title;
  const d = description || defaults.description;
  const img = image || defaults.image;

  return (
    <Helmet>
      <title>{t}</title>
      <meta name="description" content={d} />
      <meta property="og:title" content={t} />
      <meta property="og:description" content={d} />
      <meta property="og:image" content={img} />
      <meta property="og:type" content="website" />
      {url && <meta property="og:url" content={url} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={t} />
      <meta name="twitter:description" content={d} />
      <meta name="twitter:image" content={img} />
    </Helmet>
  );
}
