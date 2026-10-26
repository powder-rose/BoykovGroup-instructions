import { getInstructionPublicPath } from '../shared/instructionDocument.js';
import { renderRichTextContentToHtml } from './richTextContent.js';

export function escapeSeoHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function jsonForSeoHtml(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

export function replaceTaxonomySeoHead(html, seo, schema, { styles = '', pagePath = '' } = {}) {
  if (!/<title>[\s\S]*?<\/title>/iu.test(html) || !/<\/head>/iu.test(html)) {
    throw new Error('[SEO] Production index.html does not contain a complete head');
  }
  const productionHtml = html
    .replace(/<title>[\s\S]*?<\/title>/iu, () => `<title>${escapeSeoHtml(seo.title)}</title>`)
    .replace(/<meta\b[^>]*name=["'](?:description|robots|twitter:[^"']+)["'][^>]*>/giu, '')
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/giu, '')
    .replace(/<meta\b[^>]*property=["']og:[^"']+["'][^>]*>/giu, '')
    .replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/giu, '');
  const head = `
    ${styles ? `<style data-taxonomy-page>${styles}</style>` : ''}
    <meta name="description" content="${escapeSeoHtml(seo.description)}">
    <meta name="robots" content="${escapeSeoHtml(seo.robots)}">
    <link rel="canonical" href="${escapeSeoHtml(seo.canonicalUrl)}">
    <meta property="og:type" content="website">
    <meta property="og:locale" content="ru_RU">
    <meta property="og:title" content="${escapeSeoHtml(seo.title)}">
    <meta property="og:description" content="${escapeSeoHtml(seo.description)}">
    <meta property="og:url" content="${escapeSeoHtml(seo.canonicalUrl)}">
    <meta property="og:site_name" content="БОЙКОВГРУПП">
    <script type="application/ld+json" data-taxonomy-seo data-taxonomy-path="${escapeSeoHtml(pagePath)}">${jsonForSeoHtml(schema)}</script>
  `;
  return productionHtml.replace(/<\/head>/iu, () => `${head}\n</head>`);
}

function count(value) {
  return Number(value || 0).toLocaleString('ru-RU');
}

function sectionLinks(sections) {
  if (!sections.length) return '';
  return `<ul class="TaxonomyLandingPage_sectionList">${sections
    .map(
      section =>
        `<li><a class="TaxonomyLandingPage_sectionLink" href="${escapeSeoHtml(section.path)}">${escapeSeoHtml(section.name)} <span class="TaxonomyLandingPage_count">${count(section.count)}</span></a></li>`,
    )
    .join('')}</ul>`;
}

export function renderInstructionTaxonomyNavigation(navigation, { compact = false } = {}) {
  const catalogs = navigation.catalogs || [];
  const tags = navigation.tags || [];
  if (!catalogs.length && !tags.length) return '';
  const html = `<nav class="TaxonomyLandingPage_navigation" aria-label="Каталоги и темы инструкций">
    ${catalogs.length ? `<div class="TaxonomyLandingPage_catalogs">${catalogs.map(catalog => `<section class="TaxonomyLandingPage_catalog"><h2><a class="TaxonomyLandingPage_catalogLink" href="${escapeSeoHtml(catalog.path)}">${escapeSeoHtml(catalog.name)} <span class="TaxonomyLandingPage_count">${count(catalog.count)}</span></a></h2>${sectionLinks(catalog.sections || [])}</section>`).join('')}</div>` : ''}
    ${tags.length ? `<section class="TaxonomyLandingPage_catalog"><h2>Темы инструкций</h2><ul class="TaxonomyLandingPage_tags">${tags.map(tag => `<li><a class="TaxonomyLandingPage_tag" href="${escapeSeoHtml(tag.path)}">${escapeSeoHtml(tag.name)} <span class="TaxonomyLandingPage_count">${count(tag.count)}</span></a></li>`).join('')}</ul></section>` : ''}
  </nav>`;
  return compact
    ? `<details class="TaxonomyLandingPage_directory"><summary>Все разделы и темы</summary>${html}</details>`
    : html;
}

export function renderInstructionTaxonomyRichContent(content, className) {
  const html = renderRichTextContentToHtml(content);
  return html
    ? `<div class="${className}"><div class="RichTextContent_content">${html}</div></div>`
    : '';
}

function pagePath(page, sort) {
  const query = new URLSearchParams();
  if (page.query) query.set('q', page.query);
  if (sort !== 'title') query.set('sort', sort);
  const search = query.toString();
  return `${page.path}${search ? `?${search}` : ''}`;
}

function renderBreadcrumbs(breadcrumbs) {
  return `<nav class="TaxonomyLandingPage_breadcrumbs" aria-label="Хлебные крошки">${breadcrumbs
    .map(
      (item, index) =>
        `${index ? '<span aria-hidden="true">→</span>' : ''}${item.path ? `<a href="${escapeSeoHtml(item.path)}">${escapeSeoHtml(item.name)}</a>` : `<span aria-current="page">${escapeSeoHtml(item.name)}</span>`}`,
    )
    .join('')}</nav>`;
}

function renderInstructionCard(instruction) {
  const tags = instruction.taxonomyDisplay?.tags || [];
  return `<li class="InstructionList_item InstructionList_visible"><div class="InstructionButton_card InstructionButton_normalCard">
    <a class="InstructionButton_clickArea" href="${escapeSeoHtml(getInstructionPublicPath(instruction))}">
      <span class="InstructionButton_index" aria-hidden="true"></span>
      <span class="InstructionButton_body"><span class="InstructionButton_title">${escapeSeoHtml(instruction.title)}</span></span>
      <span class="InstructionButton_arrow" aria-hidden="true">→</span>
    </a>
    ${tags.length ? `<ul class="InstructionButton_tags" aria-label="Теги инструкции">${tags.map(tag => `<li class="InstructionButton_tagItem"><a class="InstructionButton_tag" href="/instrukcii-po-ohrane-truda?tag=${escapeSeoHtml(encodeURIComponent(tag.id))}">${escapeSeoHtml(tag.label)}</a></li>`).join('')}</ul>` : ''}
  </div></li>`;
}

function renderPagination(page) {
  if (page.totalPages < 2) return '';
  return `<nav class="InstructionListPagination_pagination" aria-label="Страницы инструкций">
    ${page.previousPath ? `<a class="InstructionListPagination_arrow TaxonomyLandingPage_controlLink" rel="prev" href="${escapeSeoHtml(page.previousPath)}">←</a>` : ''}
    ${page.pagination.map(item => `<a class="InstructionListPagination_page TaxonomyLandingPage_controlLink${item.page === page.page ? ' InstructionListPagination_active' : ''}" href="${escapeSeoHtml(item.path)}"${item.page === page.page ? ' aria-current="page"' : ''}>${item.page}</a>`).join('')}
    ${page.nextPath ? `<a class="InstructionListPagination_arrow TaxonomyLandingPage_controlLink" rel="next" href="${escapeSeoHtml(page.nextPath)}">→</a>` : ''}
  </nav>`;
}

export function renderInstructionTaxonomyPageBody(
  page,
  { renderHeader, renderCategoryNav, renderHero },
) {
  return `<div class="App_page">
    ${renderHeader(page.query, { action: page.path, sort: page.sort })}
    ${renderCategoryNav()}
    ${renderHero({ heading: page.h1, subtitle: '' })}
    <main class="InstructionsCatalog_content">
      ${renderBreadcrumbs(page.breadcrumbs)}
      ${renderInstructionTaxonomyRichContent(page.introContent, 'TaxonomyLandingPage_intro')}
      ${page.sections.length ? `<nav class="TaxonomyLandingPage_navigation" aria-label="Разделы каталога"><section class="TaxonomyLandingPage_catalog"><h2>Разделы каталога</h2>${sectionLinks(page.sections)}</section></nav>` : ''}
      <div class="InstructionsCatalog_toolbar"><span class="App_count">${page.query ? 'Найдено инструкций' : 'Всего инструкций'}: ${count(page.total)}</span></div>
      <nav class="InstructionSort_root" aria-label="Сортировка инструкций"><div class="InstructionSort_buttons">
        <a class="InstructionSort_button TaxonomyLandingPage_controlLink${page.sort === 'title' ? ' InstructionSort_active' : ''}" href="${escapeSeoHtml(pagePath(page, 'title'))}">По алфавиту</a>
        <a class="InstructionSort_button TaxonomyLandingPage_controlLink${page.sort === 'newest' ? ' InstructionSort_active' : ''}" href="${escapeSeoHtml(pagePath(page, 'newest'))}">Сначала новые</a>
      </div></nav>
      ${page.items.length ? `<ul class="InstructionList_list">${page.items.map(renderInstructionCard).join('')}</ul>` : '<p class="TaxonomyLandingPage_empty">Инструкции не найдены.</p>'}
      ${renderPagination(page)}
      ${renderInstructionTaxonomyRichContent(page.seoContent, 'TaxonomyLandingPage_seoText')}
    </main>
  </div>`;
}
