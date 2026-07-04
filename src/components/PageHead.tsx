import { Helmet } from "react-helmet-async";

const BASE_URL = "https://biblia.atalaias.online";

interface PageHeadProps {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article";
  noindex?: boolean;
}

/**
 * Meta tags por rota. Sobrescreve title/description/canonical/og:*
 * definidos em index.html para crawlers que executam JS (Googlebot).
 */
export default function PageHead({
  title,
  description,
  path,
  image,
  type = "website",
  noindex = false,
}: PageHeadProps) {
  const url = `${BASE_URL}${path}`;
  const ogImage = image || `${BASE_URL}/og-image-wa.jpg`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}

      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={ogImage} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
}