export function applyPendingTaxonomyPolicy({ failed = false } = {}, pageDocument = document) {
  const existing = pageDocument.head.querySelector('meta[name="robots"]');
  const marker = pageDocument.head.querySelector('script[data-taxonomy-seo]');
  const knownRoot = marker?.getAttribute('data-taxonomy-path') === '/instrukcii-po-ohrane-truda';
  if (existing && knownRoot && !failed) return () => {};
  if (marker && !knownRoot) marker.remove();
  const element = existing || pageDocument.createElement('meta');
  const previous = element.getAttribute('content');
  element.setAttribute('name', 'robots');
  element.setAttribute('content', 'noindex, follow');
  if (!existing) pageDocument.head.append(element);
  return () => {
    if (!existing) element.remove();
    else if (previous === null) element.removeAttribute('content');
    else element.setAttribute('content', previous);
  };
}

export function applyPageMetadata(
  { title, description, canonicalUrl, robotsValue, serializedSchema, enhancedMetadata, pagePath },
  pageDocument = document,
) {
  const cleanups = [];
  const previousTitle = pageDocument.title;
  pageDocument.title = title;

  function update(selector, tag, attributes, { restore = false } = {}) {
    const existing = pageDocument.head.querySelector(selector);
    const element = existing || pageDocument.createElement(tag);
    const previous = Object.fromEntries(
      Object.keys(attributes).map(key => [key, element.getAttribute(key)]),
    );
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    if (!existing) pageDocument.head.append(element);
    cleanups.push(() => {
      if (!existing || !restore) element.remove();
      else
        for (const [key, value] of Object.entries(previous)) {
          if (value === null) element.removeAttribute(key);
          else element.setAttribute(key, value);
        }
    });
  }

  update('link[rel="canonical"]', 'link', { rel: 'canonical', href: canonicalUrl });
  update(
    'meta[name="description"]',
    'meta',
    { name: 'description', content: description },
    { restore: true },
  );
  update('meta[name="robots"]', 'meta', { name: 'robots', content: robotsValue });
  for (const [property, content] of enhancedMetadata
    ? [
        ['og:title', title],
        ['og:description', description],
        ['og:url', canonicalUrl],
        ['og:type', 'website'],
      ]
    : [])
    update(`meta[property="${property}"]`, 'meta', { property, content });

  const schema = pageDocument.head.querySelector('script[data-taxonomy-seo]');
  if (serializedSchema) {
    const element = schema || pageDocument.createElement('script');
    element.setAttribute('type', 'application/ld+json');
    element.setAttribute('data-taxonomy-seo', '');
    if (pagePath) element.setAttribute('data-taxonomy-path', pagePath);
    element.textContent = serializedSchema;
    if (!schema) pageDocument.head.append(element);
  } else schema?.remove();

  return () => {
    pageDocument.title = previousTitle;
    for (const cleanup of cleanups) cleanup();
    pageDocument.head.querySelector('script[data-taxonomy-seo]')?.remove();
  };
}
