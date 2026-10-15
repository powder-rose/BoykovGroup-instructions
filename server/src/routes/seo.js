import { rankInstructionsByQuery } from '../services/searchService.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { instructionsRepository } from '../services/instructionsRepository.js';
import { renderRichTextContentToHtml } from '../services/richTextContent.js';
import { getRelatedInstructions } from '../services/instructionEditorService.js';
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

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeXml(value = '') {
  return escapeHtml(value);
}

function jsonForHtml(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
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

function getIndexableInstructions(query, repository) {
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

  /*
   * SEO-поиск использует ту же
   * релевантность, что и API.
   */
  if (normalizedQuery) {
    return rankInstructionsByQuery(visible, normalizedQuery, {
      sort: 'relevance',
    });
  }

  return visible.sort((a, b) =>
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

function renderSearchBar(query = '') {
  return `
    <form
      class="SearchBar_wrapper seo-search-form"
      action="/instrukcii-po-ohrane-truda"
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
    </form>`;
}

function renderHeader(query = '') {
  return `
    <header class="Header_header">
      ${renderSearchBar(query)}

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

function renderMainHero({ headingTag = 'h1' } = {}) {
  const openTag = headingTag === 'h1' ? '<h1' : '<div';
  const closeTag = headingTag === 'h1' ? '</h1>' : '</div>';

  return `
    <section class="App_hero">
 <div class="App_heroText">
       <a class="seo-title-link" href="/">
  ${openTag} class="App_title">Инструкции по охране труда${closeTag}
</a>
        <p class="App_subtitle">
          Найдите готовую инструкцию для нужной профессии. База пополняется автоматически каждый день.
        </p>
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

function renderCatalogSeoBody(instructions, query = '') {
  const hasQuery = Boolean(String(query || '').trim());

  const heading = hasQuery ? `Результаты поиска: ${query}` : 'Каталог инструкций по охране труда';

  return `
    <main class="SeoPrerender_catalog">
      ${renderMainHero({ headingTag: 'h1' })}

      <section aria-labelledby="seo-catalog-heading">
        <h2 id="seo-catalog-heading">
          ${escapeHtml(heading)}
        </h2>

        <ul class="SeoPrerender_instructionList">
          ${instructions
            .map(
              instruction => `
                <li>
                  <a href="${escapeHtml(getInstructionPublicPath(instruction))}">
                    ${escapeHtml(instruction.title)}
                  </a>
                </li>`,
            )
            .join('\n')}
        </ul>
      </section>
    </main>`;
}

function renderInstructionSeoBody(instruction, relatedInstructions) {
  const title = String(instruction.title || 'Инструкция по охране труда').trim();
  const webIntro = String(instruction.webIntro || '').trim();
  const document = getInstructionDocument(instruction);
  const outline = getInstructionOutline(document);
  const related = relatedInstructions(instruction);

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
        <a href="/">Главная</a>
        <span aria-hidden="true"> → </span>
        <a href="/instrukcii-po-ohrane-truda">
          Инструкции по охране труда
        </a>
      </nav>

      <article>
        <header data-copy-protected="true">
          <h1>${escapeHtml(title)}</h1>
          ${webIntro ? `<p class="instruction-web-intro">${escapeHtml(webIntro)}</p>` : ''}
        </header>
        <div id="boykov-instruction-pdf-download" class="instruction-pdf-download boykovPdfDownload">
          <button type="button" class="boykovPdfDownload__button"
            data-instruction-pdf-download="${escapeHtml(instruction.id)}">
            <span class="boykovPdfDownload__badge" aria-hidden="true"></span>
            <span class="boykovPdfDownload__text">Скачать PDF</span>
          </button>
          <span class="boykovPdfDownload__status">5 скачиваний на аккаунт за всё время</span>
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

/*
 * Express по умолчанию считает URL со слешем и без него
 * одним маршрутом. Для SEO оставляем единственный вариант
 * без завершающего слеша.
 */
function redirectTrailingSlash(req, res) {
  if (req.path === '/' || !req.path.endsWith('/')) {
    return false;
  }

  const originalUrl = String(req.originalUrl || req.url || '');
  const queryIndex = originalUrl.indexOf('?');

  const pathname = queryIndex === -1 ? originalUrl : originalUrl.slice(0, queryIndex);

  const search = queryIndex === -1 ? '' : originalUrl.slice(queryIndex);

  const target = `${getSiteUrl(req)}${pathname.replace(/\/+$/u, '')}${search}`;

  res.redirect(301, target);

  return true;
}

function renderInstructionsCatalogPage(req, instructions, query, indexPath) {
  const siteUrl = getSiteUrl(req);
  const canonical = `${siteUrl}/instrukcii-po-ohrane-truda`;
  const hasQuery = Boolean(String(query || '').trim());

  const pageTitle = hasQuery
    ? `Поиск инструкций: ${query} | ${BRAND_NAME}`
    : `Инструкции по охране труда | ${BRAND_NAME}`;

  const description =
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
        name: 'Инструкции по охране труда',
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

  const robotsValue = hasQuery ? 'noindex, follow' : 'index, follow, max-image-preview:large';

  const seoHead = `
  <!-- SEO_CATALOG_PRODUCTION_SHELL_V1 -->

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

  <script type="application/ld+json">${jsonForHtml(schema)}</script>
`;

  if (!/<\/head>/iu.test(productionHtml)) {
    throw new Error('[SEO] Production index.html does not contain </head>');
  }

  productionHtml = productionHtml.replace(/<\/head>/iu, () => `${seoHead}\n</head>`);

  productionHtml = injectProductionRoot(productionHtml, renderCatalogSeoBody(instructions, query));

  return productionHtml;
}

function renderInstructionPage(req, instruction, indexPath, relatedInstructions) {
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
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Главная',
            item: `${siteUrl}/`,
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Инструкции по охране труда',
            item: `${siteUrl}/instrukcii-po-ohrane-truda`,
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: title,
            item: canonical,
          },
        ],
      },
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
    renderInstructionSeoBody(instruction, relatedInstructions),
  );

  return productionHtml;
}

function renderNotFoundPage() {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, follow">
  <title>Инструкция не найдена | ${BRAND_NAME}</title>
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

          <h1 class="InstructionModal_title">Инструкция не найдена</h1>
          <p class="InstructionModal_intro">
            Такой инструкции нет в базе или её адрес был изменён.
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
  relatedInstructions = getRelatedInstructions,
} = {}) {
  const router = Router();

  for (const [urlPath, filePath] of PUBLIC_ASSETS) {
    router.get(urlPath, (req, res, next) => {
      if (!fs.existsSync(filePath)) return next();
      return res.sendFile(filePath);
    });
  }

  router.get('/instrukcii-po-ohrane-truda', (req, res, next) => {
    if (redirectTrailingSlash(req, res)) return;

    try {
      const query = String(req.query.q || '').trim();
      const instructions = getIndexableInstructions(query, repository);

      res
        .status(200)
        .set('Cache-Control', 'public, max-age=300')
        .type('html')
        .send(renderInstructionsCatalogPage(req, instructions, query, indexPath));
    } catch (error) {
      next(error);
    }
  });

  router.get('/instrukciya-po-ohrane-truda/:id', (req, res, next) => {
    try {
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
        .send(renderInstructionPage(req, instruction, indexPath, relatedInstructions));
    } catch (error) {
      next(error);
    }
  });

  router.get('/sitemap.xml', (req, res, next) => {
    try {
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
  <url>
    <loc>${escapeXml(`${getSiteUrl(req)}/instrukcii-po-ohrane-truda`)}</loc>
  </url>
${urls}
</urlset>`;

      res.status(200).set('Cache-Control', 'public, max-age=300').type('application/xml').send(xml);
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
