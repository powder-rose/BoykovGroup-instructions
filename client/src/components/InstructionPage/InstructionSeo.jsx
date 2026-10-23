import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { getInstructionPath } from '../../lib/instructionLinks.js';
import { getInstructionSeo } from '../../../../server/src/shared/instructionDocument.js';
import { getInstructionBreadcrumbSchema } from '../../../../server/src/shared/instructionBreadcrumbs.js';

import { serializeJsonLd } from '../../lib/jsonLd.js';

export default function InstructionSeo({ instruction, noindex = false }) {
  const location = useLocation();
  const path = instruction ? getInstructionPath(instruction) : location.pathname;
  const metadata = getInstructionSeo(instruction || {});
  const title = instruction
    ? metadata.title
    : noindex
      ? 'Инструкция недоступна | БОЙКОВГРУПП'
      : 'Инструкции по охране труда | БОЙКОВГРУПП';
  const description = instruction ? metadata.description : 'Инструкции по охране труда.';
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
        if (!existing || selector === 'script[data-instruction-seo]') {
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
      ['og:type', instruction ? 'article' : 'website'],
    ]) {
      updateTag(`meta[property="${property}"]`, 'meta', { property, content });
    }

    const schema =
      instruction && !noindex
        ? {
            '@context': 'https://schema.org',
            '@graph': [
              {
                '@type': 'Article',
                headline: instruction.title,
                description,
                datePublished: instruction.publishedAt || instruction.createdAt,
                dateModified: instruction.updatedAt,
                mainEntityOfPage: canonical,
                url: canonical,
                inLanguage: 'ru-RU',
                publisher: {
                  '@type': 'Organization',
                  name: 'БОЙКОВГРУПП',
                  url: window.location.origin,
                },
              },
              getInstructionBreadcrumbSchema(instruction, {
                siteUrl: window.location.origin,
                canonical,
              }),
            ],
          }
        : null;

    updateTag(
      'script[data-instruction-seo]',
      'script',
      { type: 'application/ld+json', 'data-instruction-seo': '' },
      schema ? serializeJsonLd(schema) : '',
    );

    return () => {
      document.title = previousTitle;

      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }, [title, description, path, instruction, noindex]);

  return null;
}
