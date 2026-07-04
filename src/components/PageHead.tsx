import { Helmet } from "react-helmet-async";

const BASE_URL = "https://biblia.atalaias.online";

type JsonLd = Record<string, unknown> | Record<string, unknown>[];

export interface Breadcrumb {
  name: string;
  path: string;
}

interface PageHeadProps {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article";
  noindex?: boolean;
  /** Estruturado (Article, FAQPage, etc). Pode ser um objeto ou array. */
  jsonLd?: JsonLd;
  /** Se informado, gera automaticamente BreadcrumbList. */
  breadcrumbs?: Breadcrumb[];
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
  jsonLd,
  breadcrumbs,
}: PageHeadProps) {
  const url = `${BASE_URL}${path}`;
  const ogImage = image || `${BASE_URL}/og-image-wa.jpg`;

  const schemas: Record<string, unknown>[] = [];
  if (jsonLd) {
    if (Array.isArray(jsonLd)) schemas.push(...jsonLd);
    else schemas.push(jsonLd);
  }
  if (breadcrumbs && breadcrumbs.length > 0) {
    schemas.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbs.map((b, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: b.name,
        item: `${BASE_URL}${b.path}`,
      })),
    });
  }

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

      {schemas.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}