import { useEffect } from 'react';

import { serializeJsonLd } from '../../lib/jsonLd.js';

export default function ArticleSeo({ title, description, path, article, noindex = false }) {
  useEffect(() => {
    const cleanups = [];
    const previousTitle = document.title;
    const canonical = new URL(path, window.location.origin).href;

    document.title = title;

    function updateTag(selector, tagName, attributes, content) {
      const existing = document.head.querySelector(selector);
      const element = existing || document.createElement(tagName);
      const previousAttributes = Object.fromEntries(
        Object.keys(attributes).map(name => [name, element.getAttribute(name)]),
      );
      const previousContent = element.textContent;

      for (const [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, value);
      }

      if (content !== undefined) {
        element.textContent = content;
      }

      if (!existing) {
        document.head.appendChild(element);
      }

      cleanups.push(() => {
        if (!existing) {
          element.remove();
          return;
        }

        for (const [name, value] of Object.entries(previousAttributes)) {
          if (value === null) {
            element.removeAttribute(name);
          } else {
            element.setAttribute(name, value);
          }
        }

        if (content !== undefined) {
          element.textContent = previousContent;
        }
      });
    }

    updateTag('link[rel="canonical"]', 'link', { rel: 'canonical', href: canonical });

    for (const [name, content] of [
      ['description', description],
      ['robots', noindex ? 'noindex, follow' : 'index, follow'],
    ]) {
      updateTag(`meta[name="${name}"]`, 'meta', { name, content });
    }

    for (const [property, content] of [
      ['og:title', title],
      ['og:description', description],
      ['og:url', canonical],
      ['og:type', article ? 'article' : 'website'],
    ]) {
      updateTag(`meta[property="${property}"]`, 'meta', { property, content });
    }

    const schema = noindex
      ? null
      : article
        ? {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: article.title,
            description,
            datePublished: article.publishedAt,
            dateModified: article.updatedAt,
            mainEntityOfPage: canonical,
            url: canonical,
            inLanguage: 'ru-RU',
            publisher: {
              '@type': 'Organization',
              name: 'БОЙКОВГРУПП',
              url: window.location.origin,
            },
          }
        : {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            url: canonical,
            name: title,
            description,
            inLanguage: 'ru-RU',
          };

    updateTag(
      'script[data-article-seo]',
      'script',
      { type: 'application/ld+json', 'data-article-seo': '' },
      schema ? serializeJsonLd(schema) : '',
    );

    return () => {
      document.title = previousTitle;

      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }, [title, description, path, article, noindex]);

  return null;
}
