export function getInstructionBreadcrumbs(instruction) {
  const breadcrumbs = instruction?.taxonomyNavigation?.breadcrumbs;
  if (Array.isArray(breadcrumbs) && breadcrumbs.length) return breadcrumbs;

  return [
    { name: 'Главная', path: '/' },
    { name: 'Инструкции по охране труда', path: '/instrukcii-po-ohrane-truda' },
    { name: instruction?.title || 'Инструкция по охране труда', path: null },
  ];
}

export function getInstructionBreadcrumbSchema(instruction, { siteUrl, canonical }) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: getInstructionBreadcrumbs(instruction).map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: new URL(item.path || canonical, siteUrl).href,
    })),
  };
}
