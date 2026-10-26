import { rankInstructionsByQuery } from '../services/searchService.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { instructionsRepository } from '../services/instructionsRepository.js';
import { renderRichTextContentToHtml } from '../services/richTextContent.js';
import { getRelatedInstructions } from '../services/instructionEditorService.js';
import { getInstructionTaxonomyDisplay } from '../services/instructionTaxonomyDisplayService.js';
import { getInstructionTaxonomyAssignmentCatalog } from '../services/instructionTaxonomyAssignmentCatalog.js';
import {
  createInstructionTaxonomyPublicService,
  normalizeInstructionTaxonomyPublicOrigin,
} from '../services/instructionTaxonomyPublicService.js';
import { createInstructionTaxonomySeoSchema } from '../shared/instructionTaxonomySeo.js';
import {
  getInstructionBreadcrumbs,
  getInstructionBreadcrumbSchema,
} from '../shared/instructionBreadcrumbs.js';
import {
  escapeSeoHtml as escapeHtml,
  jsonForSeoHtml as jsonForHtml,
  renderInstructionTaxonomyNavigation,
  renderInstructionTaxonomyPageBody,
  renderInstructionTaxonomyRichContent,
  replaceTaxonomySeoHead,
} from '../services/instructionTaxonomySeoRenderer.js';
import {
  filterInstructionsByTaxonomy,
  validateInstructionTaxonomyFilters,
} from '../services/instructionTaxonomyFilterService.js';
import {
  getInstructionDocument,
  getInstructionOutline,
  getInstructionPublicPath,
  getInstructionSeo,
} from '../shared/instructionDocument.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../../..');
const CLIENT_SRC_DIR = path.join(PROJECT_ROOT, 'client', 'src');
const CLIENT_PUBLIC_DIR = path.join(PROJECT_ROOT, 'client', 'public');

const BRAND_NAME = 'БОЙКОВГРУПП';

const INSTRUCTION_REDIRECTS = new Map([
  ['sistemnyy-administrator', 'instruktsiya-po-ohrane-truda-dlya-sistemnogo-administratora-CfhwZb'],
]);
const COMPANY_SITE_URL = String(process.env.COMPANY_SITE_URL || 'https://boykovgroup.ru')
  .trim()
  .replace(/\/+$/, '');

/**
 * CSS Modules на React-странице компилируются в уникальные классы.
 * Для серверной SEO-страницы читаем те же исходные CSS-файлы и даём
 * классам собственный стабильный префикс, чтобы стили разных модулей
 * не конфликтовали между собой.
 */
function prefixCssModuleClasses(css, prefix) {
  return String(css || '').replace(
    /\.([A-Za-z_][A-Za-z0-9_-]*)/g,
    (_, className) => `.${prefix}_${className}`,
  );
}

function readTextIfExists(filePath) {
  try {
    if (!fs.existsSync(filePath)) return '';
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.warn(`[SEO] Не удалось прочитать ${filePath}: ${error.message}`);
    return '';
  }
}

function walkCssFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const result = [];
  const stack = [dir];

  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (entry.isFile() && entry.name.endsWith('.css') && !entry.name.endsWith('.module.css')) {
        result.push(fullPath);
      }
    }
  }

  return result.sort();
}

/**
 * Берём реальные глобальные стили приложения.
 * Не задаём фирменные цвета/шрифты вручную.
 */
function loadGlobalClientCss() {
  const cssFiles = walkCssFiles(CLIENT_SRC_DIR);

  if (!cssFiles.length) {
    console.warn(
      '[SEO] В client/src не найдены глобальные CSS-файлы. ' +
        'SEO-страница загрузится, но без глобальных design tokens.',
    );
    return '';
  }

  return cssFiles
    .map(
      filePath => `/* ${path.relative(PROJECT_ROOT, filePath)} */\n${readTextIfExists(filePath)}`,
    )
    .join('\n\n');
}

const CSS_MODULES = [
  ['App', path.join(CLIENT_SRC_DIR, 'App.module.css')],
  ['Header', path.join(CLIENT_SRC_DIR, 'components', 'Header', 'Header.module.css')],
  ['SearchBar', path.join(CLIENT_SRC_DIR, 'components', 'SearchBar', 'SearchBar.module.css')],
  ['AuthControl', path.join(CLIENT_SRC_DIR, 'components', 'AuthControl', 'AuthControl.module.css')],
  [
    'SiteLinkButton',
    path.join(CLIENT_SRC_DIR, 'components', 'SiteLinkButton', 'SiteLinkButton.module.css'),
  ],
  ['CategoryNav', path.join(CLIENT_SRC_DIR, 'components', 'CategoryNav', 'CategoryNav.module.css')],
  [
    'HeroPortrait',
    path.join(CLIENT_SRC_DIR, 'components', 'HeroPortrait', 'HeroPortrait.module.css'),
  ],
  [
    'InstructionList',
    path.join(CLIENT_SRC_DIR, 'components', 'InstructionList', 'InstructionList.module.css'),
  ],
  [
    'InstructionButton',
    path.join(CLIENT_SRC_DIR, 'components', 'InstructionButton', 'InstructionButton.module.css'),
  ],
  [
    'InstructionModal',
    path.join(CLIENT_SRC_DIR, 'components', 'InstructionModal', 'InstructionModal.module.css'),
  ],
  [
    'InstructionTaxonomy',
    path.join(CLIENT_SRC_DIR, 'components', 'InstructionPage', 'InstructionTaxonomy.module.css'),
  ],
  [
    'InstructionsCatalog',
    path.join(CLIENT_SRC_DIR, 'components', 'InstructionCatalog', 'InstructionsCatalog.module.css'),
  ],
  [
    'InstructionSort',
    path.join(CLIENT_SRC_DIR, 'components', 'InstructionSort', 'InstructionSort.module.css'),
  ],
  [
    'InstructionListPagination',
    path.join(
      CLIENT_SRC_DIR,
      'components',
      'InstructionList',
      'InstructionListPagination.module.css',
    ),
  ],
  [
    'RichTextContent',
    path.join(CLIENT_SRC_DIR, 'components', 'RichTextContent', 'RichTextContent.module.css'),
  ],
  [
    'TaxonomyLandingPage',
    path.join(
      CLIENT_SRC_DIR,
      'components',
      'TaxonomyLandingPage',
      'TaxonomyLandingPage.module.css',
    ),
  ],
];

function loadClientModuleCss() {
  return CSS_MODULES.map(([prefix, filePath]) => {
    const css = readTextIfExists(filePath);
    if (!css) return '';
    return `/* ${path.relative(PROJECT_ROOT, filePath)} */\n${prefixCssModuleClasses(css, prefix)}`;
  })
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Здесь только технические поправки, необходимые потому что на SEO-странице
 * React-компоненты заменены семантическим HTML (<a>, <form>).
 * Визуальный дизайн этих элементов остаётся из оригинальных CSS Modules.
 */
const SEO_LAYOUT_CSS = String.raw`

body,
body *,
h1,
h2,
h3,
p,
span,
a,
button,
input {
  font-family: "Comfortaa", sans-serif !important;
}

  .seo-login-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
  }

  .seo-search-form {
    margin: 0;
  }

.seo-title-link {
  color: inherit;
  text-decoration: none;
}

.seo-title-link .App_title {
  color: var(--color-text);
}

  .InstructionButton_clickArea {
    text-decoration: none;
    box-sizing: border-box;
  }

  .InstructionModal_close {
    text-decoration: none;
  }

  .seo-article-wrap {
    display: flex;
    justify-content: center;
    width: 100%;
  }

  .seo-article-wrap .InstructionModal_modal {
    max-width: 760px;
  }

  .seo-empty-query {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 14px;
  }

  @media (max-width: 720px) {
    .seo-article-wrap .InstructionModal_modal {
      padding: 36px 22px 42px;
    }
  }
`;

const EXACT_SITE_CSS = [loadGlobalClientCss(), loadClientModuleCss(), SEO_LAYOUT_CSS].join('\n\n');

const INSTRUCTION_TAXONOMY_SEO_CSS = prefixCssModuleClasses(
  readTextIfExists(
    path.join(CLIENT_SRC_DIR, 'components', 'InstructionPage', 'InstructionTaxonomy.module.css'),
  ),
  'InstructionTaxonomy',
);

const COPY_PROTECTION_CSS = `
  [data-copy-protected="true"],
  [data-copy-protected="true"] * {
    -webkit-user-select: none;
    user-select: none;
  }

  [data-copy-protected="true"] input,
  [data-copy-protected="true"] textarea,
  [data-copy-protected="true"] select,
  [data-copy-protected="true"] [contenteditable]:not([contenteditable="false"]),
  [data-copy-protected="true"] [contenteditable]:not([contenteditable="false"]) * {
    -webkit-user-select: text;
    user-select: text;
  }
`;

function escapeXml(value = '') {
  return escapeHtml(value);
}

function getSiteUrl(req) {
  const configured = String(process.env.SITE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  if (configured) return configured;
  return `${req.protocol}://${req.get('host')}`;
}

function getInstructionUrl(req, instruction) {
  return `${getSiteUrl(req)}${getInstructionPublicPath(instruction)}`;
}

function getDateModified(instruction) {
  return (
    instruction.updatedAt ||
    instruction.modifiedAt ||
    instruction.createdAt ||
    instruction.generatedAt ||
    instruction.uploadedAt ||
    null
  );
}

function getIndexableInstructions(query, repository, filters = {}, options = {}) {
  const result = repository.getAll();

  const instructions = Array.isArray(result)
    ? result
    : Array.isArray(result?.items)
      ? result.items
      : [];

  const normalizedQuery = String(query || '').trim();

  const visible = instructions
    .filter(instruction => instruction && instruction.id && instruction.title)
    .filter(instruction => String(instruction.status || '').toLowerCase() !== 'draft')
    .filter(
      instruction =>
        !['draft', 'noindex'].includes(String(instruction.seoStatus || '').toLowerCase()),
    );

  const filtered =
    filters.category || filters.tag || filters.catalogId
      ? filterInstructionsByTaxonomy(visible, filters, options)
      : visible;

  /*
   * SEO-поиск использует ту же
   * релевантность, что и API.
   */
  if (normalizedQuery) {
    return rankInstructionsByQuery(filtered, normalizedQuery, {
      sort: 'relevance',
    });
  }

  return filtered.sort((a, b) =>
    String(a.title).localeCompare(String(b.title), 'ru', {
      sensitivity: 'base',
    }),
  );
}

function renderSiteLinkButton() {
  return `
    <a
      class="SiteLinkButton_button"
      href="${escapeHtml(COMPANY_SITE_URL)}"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Перейти на сайт boykovgroup.ru"
    >
      <img
        class="SiteLinkButton_badge"
        src="/brand/logo-icon.png"
        alt=""
        width="46"
        height="46"
      />
      <span class="SiteLinkButton_text">
        <span class="SiteLinkButton_title">БОЙКОВГРУПП</span>
        <span class="SiteLinkButton_subtitle">ООО «Спецконс»</span>
      </span>
    </a>`;
}

function renderSearchBar(query = '', { action = '/instrukcii-po-ohrane-truda', sort } = {}) {
  return `
    <form
      class="SearchBar_wrapper seo-search-form"
      action="${escapeHtml(action)}"
      method="get"
      role="search"
    >
      <svg
        class="SearchBar_icon"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"></circle>
        <line
          x1="16.5"
          y1="16.5"
          x2="21"
          y2="21"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        ></line>
      </svg>

      <input
        class="SearchBar_input"
        type="text"
        name="q"
        placeholder="Поиск инструкций..."
        value="${escapeHtml(query)}"
        aria-label="Поиск инструкций по охране труда"
      />
      ${sort === 'newest' ? '<input type="hidden" name="sort" value="newest">' : ''}
    </form>`;
}

function renderHeader(query = '', options) {
  return `
    <header class="Header_header">
      ${renderSearchBar(query, options)}

      <div class="Header_actions">
        <a class="AuthControl_loginBtn seo-login-link" href="/">
          войти
        </a>
        ${renderSiteLinkButton()}
      </div>
    </header>`;
}

function renderCategoryNav() {
  const items = [
    { label: 'Охрана труда' },
    { label: 'Пожарная безопасность' },
    { label: 'Роспотребнадзор' },
    { divider: true },
    { label: 'ГО и ЧС' },
    { label: 'Паспорт Безопасности', href: 'https://pasport-bezopasnosty.ru/' },
    { label: 'ные услуги' },
  ];

  return `
    <nav class="CategoryNav_nav" aria-label="Разделы услуг">
      ${items
        .map(item => {
          if (item.divider) {
            return `<span class="CategoryNav_divider" aria-hidden="true"></span>`;
          }

          return `
            <a
              href="${escapeHtml(item.href || '#')}"
              class="CategoryNav_link"
              ${item.href ? '' : 'onclick="return false;"'}
            >${escapeHtml(item.label)}</a>`;
        })
        .join('')}
    </nav>`;
}

function renderHeroPortrait() {
  return `
    <figure class="HeroPortrait_wrap">
      <div class="HeroPortrait_photoCircle">
        <picture>
          <source srcset="/team/nikolay-boykov.webp" type="image/webp" />
          <img
            class="HeroPortrait_photo"
            src="/team/nikolay-boykov.png"
            alt="Николай Бойков — генеральный директор ООО «Спецконс»"
            width="370"
            height="368"
          />
        </picture>
      </div>

      <figcaption class="HeroPortrait_info">
        <span class="HeroPortrait_name">Николай Бойков</span>
        <span class="HeroPortrait_role">
          Генеральный директор
          <br />
          ООО «Спецконс»
        </span>
      </figcaption>
    </figure>`;
}

function renderMainHero({
  headingTag = 'h1',
  heading = 'Инструкции по охране труда',
  subtitle = 'Найдите готовую инструкцию для нужной профессии. База пополняется автоматически каждый день.',
} = {}) {
  const openTag = headingTag === 'h1' ? '<h1' : '<div';
  const closeTag = headingTag === 'h1' ? '</h1>' : '</div>';

  return `
    <section class="App_hero">
 <div class="App_heroText">
       <a class="seo-title-link" href="/">
  ${openTag} class="App_title">${escapeHtml(heading)}${closeTag}
</a>
        ${subtitle ? `<p class="App_subtitle">${escapeHtml(subtitle)}</p>` : ''}
      </div>
      ${renderHeroPortrait()}
    </section>`;
}

/*
 * HTML, который поисковый робот получает до выполнения React.
 * После запуска React createRoot заменяет эту разметку приложением.
 */
function injectProductionRoot(productionHtml, content) {
  const rootPattern = /<div\b[^>]*\bid=["']root["'][^>]*>[\s\S]*?<\/div>/iu;

  if (!rootPattern.test(productionHtml)) {
    throw new Error('[SEO] Production index.html does not contain replaceable #root');
  }

  return productionHtml.replace(rootPattern, () => `<div id="root">${content}</div>`);
}

function renderTaxonomyTags(tags) {
  return tags
    .map(
      tag =>
        `<a class="InstructionTaxonomy_tag" href="${escapeHtml(tag.path || `/instrukcii-po-ohrane-truda?tag=${encodeURIComponent(tag.id)}`)}">${escapeHtml(tag.label)}</a>`,
    )
    .join('');
}

function renderCatalogInstruction(instruction, options) {
  const tags = getInstructionTaxonomyDisplay(instruction, options)?.tags || [];

  return `
    <li>
      <a href="${escapeHtml(getInstructionPublicPath(instruction))}">
        ${escapeHtml(instruction.title)}
      </a>
      ${tags.length ? `<div class="InstructionTaxonomy_root" aria-label="Теги инструкции">${renderTaxonomyTags(tags)}</div>` : ''}
    </li>`;
}

function renderCatalogSeoBody(instructions, query = '', options = {}) {
  const hasQuery = Boolean(String(query || '').trim());

  const heading = hasQuery ? `Результаты поиска: ${query}` : 'Каталог инструкций по охране труда';

  return `
    <main class="SeoPrerender_catalog">
      ${renderMainHero(options.navigation?.root ? { heading: options.navigation.root.h1, subtitle: '' } : {})}
      ${options.navigation?.root ? renderInstructionTaxonomyRichContent(options.navigation.root.introContent, 'TaxonomyLandingPage_intro') : ''}
      ${options.navigation ? renderInstructionTaxonomyNavigation(options.navigation, { compact: true }) : ''}

      <section aria-labelledby="seo-catalog-heading">
        <h2 id="seo-catalog-heading">
          ${escapeHtml(heading)}
        </h2>

        <ul class="SeoPrerender_instructionList">
          ${instructions.map(instruction => renderCatalogInstruction(instruction, options)).join('\n')}
        </ul>
      </section>
      ${options.navigation?.root ? renderInstructionTaxonomyRichContent(options.navigation.root.seoContent, 'TaxonomyLandingPage_seoText') : ''}
    </main>`;
}

function renderInstructionSeoBody(instruction, relatedInstructions, options) {
  const title = String(instruction.title || 'Инструкция по охране труда').trim();
  const webIntro = String(instruction.webIntro || '').trim();
  const document = getInstructionDocument(instruction);
  const outline = getInstructionOutline(document);
  const related = relatedInstructions(instruction, options);
  const taxonomy =
    instruction.taxonomyNavigation || getInstructionTaxonomyDisplay(instruction, options);
  const taxonomyHtml =
    taxonomy && (taxonomy.category || taxonomy.tags.length)
      ? `<div class="InstructionTaxonomy_root" aria-label="Раздел и теги инструкции">
        ${taxonomy.category ? `<a class="InstructionTaxonomy_category" href="${escapeHtml(taxonomy.category.path || `/instrukcii-po-ohrane-truda?category=${encodeURIComponent(taxonomy.category.id)}`)}">Раздел: ${escapeHtml(taxonomy.category.label)}</a>` : ''}
        ${taxonomy.tags.length ? `<div class="InstructionTaxonomy_tags" aria-label="Теги инструкции">${renderTaxonomyTags(taxonomy.tags)}</div>` : ''}
      </div>`
      : '';

  const contents = outline.length
    ? `<nav class="instruction-outline" aria-label="Содержание инструкции">
        <h2>Содержание инструкции</h2>
        <ol>${outline
          .map(
            item =>
              `<li data-level="${item.level}"><a href="#${escapeHtml(item.id)}">${escapeHtml(item.label)}</a></li>`,
          )
          .join('')}</ol>
      </nav>`
    : '';

  const explanation = instruction.explanationContent
    ? `<div class="instruction-explanation" data-copy-protected="true">${renderRichTextContentToHtml(instruction.explanationContent, { headingIdPrefix: 'explanation-section' })}</div>`
    : '';

  const relatedLinks = related.length
    ? `<aside class="instruction-related" aria-label="Похожие инструкции">
        <h2>Похожие инструкции</h2>
        <ul>${related
          .map(
            item =>
              `<li><a href="${escapeHtml(getInstructionPublicPath(item))}">${escapeHtml(item.title)}</a></li>`,
          )
          .join('')}</ul>
      </aside>`
    : '';

  return `
    <main class="SeoPrerender_instruction">
      <nav aria-label="Хлебные крошки">
        ${getInstructionBreadcrumbs(instruction)
          .map(
            (item, index) =>
              `${index ? '<span aria-hidden="true"> → </span>' : ''}${item.path ? `<a href="${escapeHtml(item.path)}">${escapeHtml(item.name)}</a>` : `<span aria-current="page">${escapeHtml(item.name)}</span>`}`,
          )
          .join('')}
      </nav>

      <article>
        <header data-copy-protected="true">
          <h1>${escapeHtml(title)}</h1>
          ${taxonomyHtml}
          ${webIntro ? `<p class="instruction-web-intro">${escapeHtml(webIntro)}</p>` : ''}
        </header>
        <div id="boykov-instruction-pdf-download" class="instruction-pdf-download boykovPdfDownload">
          <button type="button" class="boykovPdfDownload__button"
            data-instruction-pdf-download="${escapeHtml(instruction.id)}">
            <span class="boykovPdfDownload__badge" aria-hidden="true"></span>
            <span class="boykovPdfDownload__text">Скачать PDF</span>
          </button>
          <span class="boykovPdfDownload__status">Войдите, чтобы увидеть доступные инструкции</span>
          <noscript>Для скачивания PDF включите JavaScript.</noscript>
        </div>
        <div class="instruction-reading" data-copy-protected="true">
          ${contents}
          <section class="instruction-document" aria-label="Полный текст инструкции">
            ${renderRichTextContentToHtml(document, { headingIdPrefix: 'instruction-section' })}
          </section>
        </div>
        ${explanation}
        ${relatedLinks}
      </article>
    </main>`;
}

function renderInstructionsCatalogPage(
  req,
  instructions,
  query,
  indexPath,
  hasParameters = false,
  { catalog = getInstructionTaxonomyAssignmentCatalog(), navigation, taxonomySiteUrl } = {},
) {
  const siteUrl = navigation?.root ? navigation.root.siteUrl || taxonomySiteUrl : getSiteUrl(req);
  const canonical = navigation?.root?.seo.canonicalUrl || `${siteUrl}/instrukcii-po-ohrane-truda`;
  const hasQuery = Boolean(String(query || '').trim());

  const pageTitle =
    navigation?.root?.seo.title ||
    (hasQuery
      ? `Поиск инструкций: ${query} | ${BRAND_NAME}`
      : `Инструкции по охране труда | ${BRAND_NAME}`);

  const description =
    navigation?.root?.seo.description ??
    'Каталог инструкций по охране труда для работников различных профессий и видов работ.';

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: siteUrl,
        name: BRAND_NAME,
        inLanguage: 'ru-RU',
      },
      {
        '@type': 'CollectionPage',
        '@id': canonical,
        url: canonical,
        name: navigation?.root?.h1 || 'Инструкции по охране труда',
        description,
        inLanguage: 'ru-RU',
        isPartOf: {
          '@id': `${siteUrl}/#website`,
        },
      },
    ],
  };

  /*
   * SEO_CATALOG_PRODUCTION_SHELL_V1
   *
   * Каталог для пользователя отображается
   * настоящим production React-приложением.
   *
   * Сервер подменяет только SEO-данные head.
   */
  let productionHtml = fs.readFileSync(indexPath, 'utf-8');

  if (!/id=["']root["']/iu.test(productionHtml)) {
    throw new Error('[SEO] Production index.html does not contain #root');
  }

  if (!/<title>[\s\S]*?<\/title>/iu.test(productionHtml)) {
    throw new Error('[SEO] Production index.html does not contain <title>');
  }

  /*
   * Title заменяем, а старые SEO-теги
   * удаляем перед добавлением актуальных,
   * чтобы не было дублей.
   */
  productionHtml = productionHtml.replace(
    /<title>[\s\S]*?<\/title>/iu,
    () => `<title>${escapeHtml(pageTitle)}</title>`,
  );

  productionHtml = productionHtml
    .replace(/<meta\b[^>]*name=["']description["'][^>]*>/giu, '')
    .replace(/<meta\b[^>]*name=["']robots["'][^>]*>/giu, '')
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/giu, '')
    .replace(/<meta\b[^>]*property=["']og:type["'][^>]*>/giu, '')
    .replace(/<meta\b[^>]*property=["']og:locale["'][^>]*>/giu, '')
    .replace(/<meta\b[^>]*property=["']og:title["'][^>]*>/giu, '')
    .replace(/<meta\b[^>]*property=["']og:description["'][^>]*>/giu, '')
    .replace(/<meta\b[^>]*property=["']og:url["'][^>]*>/giu, '')
    .replace(/<meta\b[^>]*property=["']og:site_name["'][^>]*>/giu, '')
    .replace(/<meta\b[^>]*name=["']twitter:[^"']+["'][^>]*>/giu, '')
    .replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/giu, '');

  const robotsValue = hasParameters
    ? 'noindex, follow'
    : navigation?.root?.seo.robots || 'index, follow, max-image-preview:large';

  const seoHead = `
  <!-- SEO_CATALOG_PRODUCTION_SHELL_V1 -->

  ${navigation && (navigation.root || navigation.catalogs.length || navigation.tags.length) ? `<style data-taxonomy-page>${EXACT_SITE_CSS}</style>` : ''}

  ${instructions.some(instruction => getInstructionTaxonomyDisplay(instruction, { catalog })?.tags.length) ? `<style data-instruction-taxonomy>${INSTRUCTION_TAXONOMY_SEO_CSS}</style>` : ''}

  <meta
    name="description"
    content="${escapeHtml(description)}"
  >

  <meta
    name="robots"
    content="${escapeHtml(robotsValue)}"
  >

  <link
    rel="canonical"
    href="${escapeHtml(canonical)}"
  >

  <meta
    property="og:type"
    content="website"
  >

  <meta
    property="og:locale"
    content="ru_RU"
  >

  <meta
    property="og:title"
    content="${escapeHtml(pageTitle)}"
  >

  <meta
    property="og:description"
    content="${escapeHtml(description)}"
  >

  <meta
    property="og:url"
    content="${escapeHtml(canonical)}"
  >

  <meta
    property="og:site_name"
    content="${escapeHtml(BRAND_NAME)}"
  >

  <script type="application/ld+json" data-taxonomy-seo data-taxonomy-path="/instrukcii-po-ohrane-truda">${jsonForHtml(schema)}</script>
`;

  if (!/<\/head>/iu.test(productionHtml)) {
    throw new Error('[SEO] Production index.html does not contain </head>');
  }

  productionHtml = productionHtml.replace(/<\/head>/iu, () => `${seoHead}\n</head>`);

  productionHtml = injectProductionRoot(
    productionHtml,
    renderCatalogSeoBody(instructions, query, { catalog, navigation }),
  );

  return productionHtml;
}

function renderInstructionTaxonomyPage(page, indexPath, origin) {
  const productionHtml = fs.readFileSync(indexPath, 'utf8');
  const schema = createInstructionTaxonomySeoSchema(page, { origin });
  return injectProductionRoot(
    replaceTaxonomySeoHead(productionHtml, page.seo, schema, {
      styles: EXACT_SITE_CSS,
      pagePath: page.path,
    }),
    renderInstructionTaxonomyPageBody(page, {
      renderHeader,
      renderCategoryNav,
      renderHero: renderMainHero,
    }),
  );
}

function renderInstructionPage(
  req,
  instruction,
  indexPath,
  relatedInstructions,
  { catalog = getInstructionTaxonomyAssignmentCatalog(), records } = {},
) {
  const siteUrl = getSiteUrl(req);
  const canonical = getInstructionUrl(req, instruction);
  const title = String(instruction.title || 'Инструкция по охране труда').trim();
  const { title: seoTitle, description } = getInstructionSeo(instruction);
  const modified = getDateModified(instruction);

  const seoStatus = String(instruction.seoStatus || '').toLowerCase();

  const robots = ['draft', 'noindex'].includes(seoStatus)
    ? 'noindex, follow'
    : 'index, follow, max-image-preview:large';

  const articleSchema = {
    '@type': 'Article',
    '@id': `${canonical}#article`,
    headline: title,
    description,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonical,
    },
    publisher: {
      '@type': 'Organization',
      name: BRAND_NAME,
      url: siteUrl,
    },
  };

  if (instruction.publishedAt || instruction.createdAt) {
    articleSchema.datePublished = instruction.publishedAt || instruction.createdAt;
  }

  if (modified) {
    articleSchema.dateModified = modified;
  }

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: siteUrl,
        name: BRAND_NAME,
        inLanguage: 'ru-RU',
      },
      {
        '@type': 'WebPage',
        '@id': canonical,
        url: canonical,
        name: title,
        description,
        inLanguage: 'ru-RU',
        isPartOf: {
          '@id': `${siteUrl}/#website`,
        },
      },
      articleSchema,
      getInstructionBreadcrumbSchema(instruction, { siteUrl, canonical }),
    ],
  };

  /*
   * SEO_INSTRUCTION_PRODUCTION_SHELL_V1
   *
   * При прямом открытии или F5
   * используем настоящий production React shell.
   *
   * SEO-метаданные конкретной инструкции
   * остаются серверными.
   */
  let productionHtml = fs.readFileSync(indexPath, 'utf-8');

  if (!/id=["']root["']/iu.test(productionHtml)) {
    throw new Error('[SEO] Production index.html does not contain #root');
  }

  if (!/<title>[\s\S]*?<\/title>/iu.test(productionHtml)) {
    throw new Error('[SEO] Production index.html does not contain title');
  }

  /*
   * Title конкретной инструкции.
   */
  productionHtml = productionHtml.replace(
    /<title>[\s\S]*?<\/title>/iu,
    () => `<title>${escapeHtml(seoTitle)}</title>`,
  );

  /*
   * Убираем SEO-теги главной страницы,
   * чтобы ниже вставить данные инструкции
   * без дублей.
   */
  productionHtml = productionHtml
    .replace(/<meta\b[^>]*name=["']description["'][^>]*>/giu, '')
    .replace(/<meta\b[^>]*name=["']robots["'][^>]*>/giu, '')
    .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/giu, '')
    .replace(/<meta\b[^>]*property=["']og:type["'][^>]*>/giu, '')
    .replace(/<meta\b[^>]*property=["']og:locale["'][^>]*>/giu, '')
    .replace(/<meta\b[^>]*property=["']og:title["'][^>]*>/giu, '')
    .replace(/<meta\b[^>]*property=["']og:description["'][^>]*>/giu, '')
    .replace(/<meta\b[^>]*property=["']og:url["'][^>]*>/giu, '')
    .replace(/<meta\b[^>]*property=["']og:site_name["'][^>]*>/giu, '')
    .replace(/<meta\b[^>]*name=["']twitter:[^"']+["'][^>]*>/giu, '')
    .replace(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/giu, '');

  const seoHead = `
  <!-- SEO_INSTRUCTION_PRODUCTION_SHELL_V1 -->

  <style data-copy-protection>${COPY_PROTECTION_CSS}</style>
  ${getInstructionTaxonomyDisplay(instruction, { catalog }) ? `<style data-instruction-taxonomy>${INSTRUCTION_TAXONOMY_SEO_CSS}</style>` : ''}

  <meta
    name="description"
    content="${escapeHtml(description)}"
  >

  <meta
    name="robots"
    content="${escapeHtml(robots)}"
  >

  <link
    rel="canonical"
    href="${escapeHtml(canonical)}"
  >

  <meta
    property="og:type"
    content="article"
  >

  <meta
    property="og:locale"
    content="ru_RU"
  >

  <meta
    property="og:title"
    content="${escapeHtml(seoTitle)}"
  >

  <meta
    property="og:description"
    content="${escapeHtml(description)}"
  >

  <meta
    property="og:url"
    content="${escapeHtml(canonical)}"
  >

  <meta
    property="og:site_name"
    content="${escapeHtml(BRAND_NAME)}"
  >

  <script type="application/ld+json" data-instruction-seo>${jsonForHtml(schema)}</script>
`;

  if (!/<\/head>/iu.test(productionHtml)) {
    throw new Error('[SEO] Production index.html does not contain </head>');
  }

  productionHtml = productionHtml.replace(/<\/head>/iu, () => `${seoHead}\n</head>`);

  productionHtml = injectProductionRoot(
    productionHtml,
    renderInstructionSeoBody(instruction, relatedInstructions, { catalog, records }),
  );

  return productionHtml;
}

function renderNotFoundPage({
  title = 'Инструкция не найдена',
  description = 'Такой инструкции нет в базе или её адрес был изменён.',
} = {}) {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, follow">
  <title>${escapeHtml(title)} | ${BRAND_NAME}</title>
  <style>${EXACT_SITE_CSS}</style>
  <link rel="stylesheet" href="/assets/instruction-copy-protection.css">
  <script defer src="/assets/instruction-copy-protection.js"></script>
</head>
<body>
  <div class="App_page">
    ${renderHeader('')}
    ${renderCategoryNav()}
    ${renderMainHero({ headingTag: 'div' })}

    <main>
      <div class="seo-article-wrap">
        <article class="InstructionModal_modal">
          <a
            class="InstructionModal_close"
            href="/instrukcii-po-ohrane-truda"
            aria-label="Вернуться к списку инструкций"
          >×</a>

          <h1 class="InstructionModal_title">${escapeHtml(title)}</h1>
          <p class="InstructionModal_intro">
            ${escapeHtml(description)}
          </p>
        </article>
      </div>
    </main>
  </div>
</body>
</html>`;
}

/**
 * Эти три файла уже используются главной страницей.
 * Маршруты нужны, чтобы портрет и реальная кнопка БОЙКОВГРУПП
 * отображались и при прямом открытии Express SEO-страницы на :4000.
 */
const PUBLIC_ASSETS = new Map([
  ['/brand/logo-icon.png', path.join(CLIENT_PUBLIC_DIR, 'brand', 'logo-icon.png')],
  ['/team/nikolay-boykov.webp', path.join(CLIENT_PUBLIC_DIR, 'team', 'nikolay-boykov.webp')],
  ['/team/nikolay-boykov.png', path.join(CLIENT_PUBLIC_DIR, 'team', 'nikolay-boykov.png')],
]);

export function createSeoRouter({
  repository = instructionsRepository,
  indexPath = new URL('../../../public_html/index.html', import.meta.url),
  relatedInstructions = (instruction, options) =>
    getRelatedInstructions(instruction, { repository, ...options }),
  taxonomyService = createInstructionTaxonomyPublicService({ repository }),
  taxonomyOrigin,
} = {}) {
  const router = Router();
  const getTaxonomyOrigin = () =>
    normalizeInstructionTaxonomyPublicOrigin(
      typeof taxonomyOrigin === 'function' ? taxonomyOrigin() : taxonomyOrigin,
    );

  for (const [urlPath, filePath] of PUBLIC_ASSETS) {
    router.get(urlPath, (req, res, next) => {
      if (!fs.existsSync(filePath)) return next();
      return res.sendFile(filePath);
    });
  }

  router.get('/oplata-instrukcii', (req, res, next) => {
    try {
      const html = fs
        .readFileSync(indexPath, 'utf8')
        .replace(/<meta\s+[^>]*name=["']robots["'][^>]*>/giu, '')
        .replace('</head>', '<meta name="robots" content="noindex, nofollow"></head>');
      res
        .set('Cache-Control', 'private, no-store')
        .set('X-Robots-Tag', 'noindex, nofollow')
        .type('html')
        .send(html);
    } catch (error) {
      next(error);
    }
  });

  router.get('/instrukcii-po-ohrane-truda', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    const canonicalPath = '/instrukcii-po-ohrane-truda';
    if (req.path !== canonicalPath) {
      const queryIndex = req.originalUrl.indexOf('?');
      const search = queryIndex < 0 ? '' : req.originalUrl.slice(queryIndex);
      return res.redirect(301, `${getSiteUrl(req)}${canonicalPath}${search}`);
    }

    try {
      const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const snapshot = taxonomyService.snapshot();
      const taxonomySiteUrl = getTaxonomyOrigin();
      const navigation = snapshot.navigation(taxonomySiteUrl);
      const catalog = snapshot.assignmentCatalog || getInstructionTaxonomyAssignmentCatalog();
      let filters;
      try {
        filters = validateInstructionTaxonomyFilters(
          {
            category: req.query.category ?? '',
            tag: req.query.tag ?? '',
            catalogId: req.query.catalog ?? '',
          },
          { catalog },
        );
      } catch {
        return res
          .status(400)
          .set('X-Robots-Tag', 'noindex, nofollow')
          .type('text/plain')
          .send('Некорректные фильтры каталога, раздела или тега');
      }
      const instructions = getIndexableInstructions(query, repository, filters, { catalog });
      const hasParameters = Object.keys(req.query).length > 0;

      return res
        .status(200)
        .set('Cache-Control', 'no-store')
        .set(
          'X-Robots-Tag',
          hasParameters
            ? 'noindex, follow'
            : navigation.root?.seo.robots || 'index, follow, max-image-preview:large',
        )
        .type('html')
        .send(
          renderInstructionsCatalogPage(req, instructions, query, indexPath, hasParameters, {
            catalog,
            navigation,
            taxonomySiteUrl,
          }),
        );
    } catch (error) {
      next(error);
    }
  });

  router.get(/^\/instrukcii-po-ohrane-truda\/.+/iu, (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    try {
      const origin = getTaxonomyOrigin();
      const result = taxonomyService.snapshot().resolve(req.path, req.query, origin);
      if (result.status === 301) return res.redirect(301, result.location);
      if (result.status === 404) {
        return res
          .status(404)
          .set('X-Robots-Tag', 'noindex, nofollow')
          .type('html')
          .send(
            renderNotFoundPage({
              title: 'Страница не найдена',
              description: 'Страница недоступна или её адрес был изменён.',
            }),
          );
      }
      return res
        .status(200)
        .set('X-Robots-Tag', result.page.seo.robots)
        .type('html')
        .send(renderInstructionTaxonomyPage(result.page, indexPath, origin));
    } catch (error) {
      if (error.status === 400) {
        return res
          .status(400)
          .set('X-Robots-Tag', 'noindex, nofollow')
          .type('text/plain')
          .send(error.message);
      }
      next(error);
    }
  });

  router.get('/instrukciya-po-ohrane-truda/:id', (req, res, next) => {
    try {
      const snapshot = taxonomyService.snapshot();
      const redirectId = INSTRUCTION_REDIRECTS.get(req.params.id);
      const instruction = repository.getBySlug(redirectId || req.params.id);
      const queryIndex = req.originalUrl.indexOf('?');
      const query = queryIndex < 0 ? '' : req.originalUrl.slice(queryIndex);

      if (
        redirectId &&
        (!instruction ||
          req.params.id !== (instruction.slug || instruction.id) ||
          req.path.endsWith('/'))
      ) {
        const target = instruction
          ? getInstructionUrl(req, instruction)
          : `${getSiteUrl(req)}/instrukciya-po-ohrane-truda/${encodeURIComponent(redirectId)}`;

        return res.redirect(301, `${target}${query}`);
      }

      if (
        !instruction ||
        String(instruction.status || '').toLowerCase() === 'draft' ||
        String(instruction.seoStatus || '').toLowerCase() === 'draft'
      ) {
        return res.status(404).type('html').send(renderNotFoundPage());
      }

      if (req.params.id !== (instruction.slug || instruction.id) || req.path.endsWith('/')) {
        return res.redirect(301, `${getInstructionUrl(req, instruction)}${query}`);
      }

      res
        .status(200)
        .set('Cache-Control', 'no-store')
        .type('html')
        .send(
          renderInstructionPage(
            req,
            {
              ...instruction,
              taxonomyNavigation: snapshot.instructionNavigation(instruction),
            },
            indexPath,
            relatedInstructions,
            { catalog: snapshot.assignmentCatalog, records: snapshot.references() },
          ),
        );
    } catch (error) {
      next(error);
    }
  });

  router.get('/sitemap.xml', (req, res, next) => {
    try {
      const snapshot = taxonomyService.snapshot();
      const origin = getTaxonomyOrigin();
      const navigation = snapshot.navigation(origin);
      const taxonomyEntries = snapshot
        .sitemap(origin)
        .map(entry =>
          entry.path === '/instrukcii-po-ohrane-truda' && !navigation.root
            ? { ...entry, loc: `${getSiteUrl(req)}${entry.path}` }
            : entry,
        );
      const instructions = getIndexableInstructions('', repository);
      const urls = instructions
        .map(instruction => {
          const loc = getInstructionUrl(req, instruction);
          const modified = getDateModified(instruction);

          return [
            '  <url>',
            `    <loc>${escapeXml(loc)}</loc>`,
            modified ? `    <lastmod>${escapeXml(String(modified).slice(0, 10))}</lastmod>` : '',
            '  </url>',
          ]
            .filter(Boolean)
            .join('\n');
        })
        .join('\n');

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${escapeXml(`${getSiteUrl(req)}/`)}</loc>
  </url>
${taxonomyEntries.map(entry => `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n  </url>`).join('\n')}
${urls}
</urlset>`;

      res.status(200).set('Cache-Control', 'no-store').type('application/xml').send(xml);
    } catch (error) {
      next(error);
    }
  });

  router.get('/robots.txt', (req, res) => {
    const content = `User-agent: *
Allow: /

Disallow: /api/

Sitemap: ${getSiteUrl(req)}/sitemap.xml
`;

    res.status(200).set('Cache-Control', 'public, max-age=3600').type('text/plain').send(content);
  });

  return router;
}

export default createSeoRouter();
