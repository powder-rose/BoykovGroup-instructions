export function createInstructionTaxonomySeoSchema(page, { origin }) {
  const siteOrigin = new URL(page.siteUrl || origin).origin;
  const canonical = page.seo.canonicalUrl;
  const graph = [
    {
      '@type': 'WebSite',
      '@id': `${siteOrigin}/#website`,
      url: siteOrigin,
      name: 'БОЙКОВГРУПП',
      inLanguage: 'ru-RU',
    },
    {
      '@type': 'CollectionPage',
      '@id': canonical,
      url: canonical,
      name: page.h1,
      description: page.seo.description,
      inLanguage: 'ru-RU',
      isPartOf: { '@id': `${siteOrigin}/#website` },
    },
  ];
  if (page.breadcrumbs?.length) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: page.breadcrumbs.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: new URL(item.path || page.path, siteOrigin).href,
      })),
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}
