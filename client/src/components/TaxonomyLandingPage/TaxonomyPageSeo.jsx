import { useEffect } from 'react';
import SEO from '../SEO/SEO.jsx';
import { applyPendingTaxonomyPolicy } from '../../lib/pageMetadata.js';
import { createInstructionTaxonomySeoSchema } from '../../../../server/src/shared/instructionTaxonomySeo.js';

export default function TaxonomyPageSeo({ page, robots }) {
  return (
    <SEO
      title={page.seo.title}
      description={page.seo.description}
      canonical={page.seo.canonicalUrl}
      pagePath={page.path}
      robots={robots || page.seo.robots}
      jsonLd={createInstructionTaxonomySeoSchema(page, {
        origin: page.siteUrl || window.location.origin,
      })}
    />
  );
}

export function TaxonomyPendingSeo({ failed }) {
  useEffect(() => applyPendingTaxonomyPolicy({ failed }), [failed]);
  return null;
}
