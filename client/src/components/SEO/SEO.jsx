import { useEffect } from 'react';
import { serializeJsonLd } from '../../lib/jsonLd.js';
import { applyPageMetadata } from '../../lib/pageMetadata.js';

export default function SEO({
  title,
  description,
  noindex = false,
  canonical,
  robots,
  jsonLd,
  pagePath,
}) {
  const canonicalUrl = new URL(canonical || '/', window.location.origin).href;
  const enhancedMetadata = Boolean(canonical || robots || jsonLd);
  const robotsValue = robots || (noindex ? 'noindex, nofollow' : 'index, follow');
  const serializedSchema = jsonLd ? serializeJsonLd(jsonLd) : null;

  useEffect(
    () =>
      applyPageMetadata({
        title,
        description,
        canonicalUrl,
        robotsValue,
        serializedSchema,
        enhancedMetadata,
        pagePath,
      }),
    [title, description, canonicalUrl, robotsValue, serializedSchema, enhancedMetadata, pagePath],
  );

  return null;
}
