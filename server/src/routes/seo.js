import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Router } from "express";
import { instructionsRepository } from "../services/instructionsRepository.js";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../../..");
const CLIENT_SRC_DIR = path.join(PROJECT_ROOT, "client", "src");
const CLIENT_PUBLIC_DIR = path.join(PROJECT_ROOT, "client", "public");

const BRAND_NAME = "БОЙКОВГРУПП";
const COMPANY_SITE_URL =
  String(process.env.COMPANY_SITE_URL || "https://boykovgroup.ru").trim().replace(/\/+$/, "");

/**
 * CSS Modules на React-странице компилируются в уникальные классы.
 * Для серверной SEO-страницы читаем те же исходные CSS-файлы и даём
 * классам собственный стабильный префикс, чтобы стили разных модулей
 * не конфликтовали между собой.
 */
function prefixCssModuleClasses(css, prefix) {
  return String(css || "").replace(
    /\.([A-Za-z_][A-Za-z0-9_-]*)/g,
    (_, className) => `.${prefix}_${className}`
  );
}

function readTextIfExists(filePath) {
  try {
    if (!fs.existsSync(filePath)) return "";
    return fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    console.warn(`[SEO] Не удалось прочитать ${filePath}: ${error.message}`);
    return "";
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

      if (
        entry.isFile() &&
        entry.name.endsWith(".css") &&
        !entry.name.endsWith(".module.css")
      ) {
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
      "[SEO] В client/src не найдены глобальные CSS-файлы. " +
        "SEO-страница загрузится, но без глобальных design tokens."
    );
    return "";
  }

  return cssFiles
    .map((filePath) => `/* ${path.relative(PROJECT_ROOT, filePath)} */\n${readTextIfExists(filePath)}`)
    .join("\n\n");
}

const CSS_MODULES = [
  ["App", path.join(CLIENT_SRC_DIR, "App.module.css")],
  ["Header", path.join(CLIENT_SRC_DIR, "components", "Header", "Header.module.css")],
  ["SearchBar", path.join(CLIENT_SRC_DIR, "components", "SearchBar", "SearchBar.module.css")],
  ["AuthControl", path.join(CLIENT_SRC_DIR, "components", "AuthControl", "AuthControl.module.css")],
  ["SiteLinkButton", path.join(CLIENT_SRC_DIR, "components", "SiteLinkButton", "SiteLinkButton.module.css")],
  ["CategoryNav", path.join(CLIENT_SRC_DIR, "components", "CategoryNav", "CategoryNav.module.css")],
  ["HeroPortrait", path.join(CLIENT_SRC_DIR, "components", "HeroPortrait", "HeroPortrait.module.css")],
  ["InstructionList", path.join(CLIENT_SRC_DIR, "components", "InstructionList", "InstructionList.module.css")],
  ["InstructionButton", path.join(CLIENT_SRC_DIR, "components", "InstructionButton", "InstructionButton.module.css")],
  ["InstructionModal", path.join(CLIENT_SRC_DIR, "components", "InstructionModal", "InstructionModal.module.css")],
];

function loadClientModuleCss() {
  return CSS_MODULES.map(([prefix, filePath]) => {
    const css = readTextIfExists(filePath);
    if (!css) return "";
    return `/* ${path.relative(PROJECT_ROOT, filePath)} */\n${prefixCssModuleClasses(css, prefix)}`;
  })
    .filter(Boolean)
    .join("\n\n");
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

const EXACT_SITE_CSS = [
  loadGlobalClientCss(),
  loadClientModuleCss(),
  SEO_LAYOUT_CSS,
].join("\n\n");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeXml(value = "") {
  return escapeHtml(value);
}

function jsonForHtml(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

function getSiteUrl(req) {
  const configured = String(process.env.SITE_URL || "").trim().replace(/\/+$/, "");
  if (configured) return configured;
  return `${req.protocol}://${req.get("host")}`;
}

function getInstructionUrl(req, instruction) {
  return `${getSiteUrl(req)}/instructions/${encodeURIComponent(instruction.id)}`;
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

function getIndexableInstructions(query = "") {
  const result = instructionsRepository.getAll();
  const instructions = Array.isArray(result)
    ? result
    : Array.isArray(result?.items)
      ? result.items
      : [];

  const normalizedQuery = String(query || "").trim().toLocaleLowerCase("ru");

  return instructions
    .filter((instruction) => instruction && instruction.id && instruction.title)
    .filter(
      (instruction) =>
        !["draft", "noindex"].includes(
          String(instruction.seoStatus || "").toLowerCase()
        )
    )
    .filter((instruction) => {
      if (!normalizedQuery) return true;

      return [
        instruction.title,
        instruction.profession,
        instruction.id,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLocaleLowerCase("ru").includes(normalizedQuery)
        );
    })
    .sort((a, b) =>
      String(a.title).localeCompare(String(b.title), "ru", {
        sensitivity: "base",
      })
    );
}

function makeDescription(instruction) {
  const title = String(instruction.title || "").trim();
  const profession = String(instruction.profession || "").trim();

  const source = profession
    ? `${title}. Требования охраны труда, порядок безопасного выполнения работ и действия работника в аварийных ситуациях.`
    : `${title}. Полный текст инструкции по охране труда.`;

  return source.length <= 165
    ? source
    : `${source.slice(0, 162).trimEnd()}вЂ¦`;
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

function renderSearchBar(query = "") {
  return `
    <form
      class="SearchBar_wrapper seo-search-form"
      action="/instructions/"
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

function renderHeader(query = "") {
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
    { label: "Охрана труда" },
    { label: "Пожарная безопасность" },
    { label: "Роспотребнадзор" },
    { divider: true },
    { label: "ГО и ЧС" },
    { label: "Антитеррористическая безопасность" },
    { label: "РРЅС‹Рµ СѓСЃР»СѓРіРё" },
  ];

  return `
    <nav class="CategoryNav_nav" aria-label="Разделы услуг">
      ${items
        .map((item, idx) => {
          if (item.divider) {
            return `<span class="CategoryNav_divider" aria-hidden="true"></span>`;
          }

          return `
            <a
              href="#"
              class="CategoryNav_link"
              onclick="return false;"
            >${escapeHtml(item.label)}</a>`;
        })
        .join("")}
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

function renderMainHero({ headingTag = "h1" } = {}) {
  const openTag = headingTag === "h1" ? "<h1" : "<div";
  const closeTag = headingTag === "h1" ? "</h1>" : "</div>";

  return `
    <section class="App_hero">
 <div class="App_heroText">
       <a class="seo-title-link" href="/">
  ${openTag} class="App_title">РРЅСЃС‚СЂСѓРєС†РёРё РїРѕ РѕС…СЂР°РЅРµ С‚СЂСѓРґР°${closeTag}
</a>
        <p class="App_subtitle">
          Найдите готовую инструкцию для нужной профессии. База пополняется автоматически каждый день.
        </p>
      </div>
      ${renderHeroPortrait()}
    </section>`;
}

function renderInstructionCards(instructions) {
  return instructions
    .map(
      (instruction) => `
        <li>
          <div class="InstructionButton_card">
            <a
              class="InstructionButton_clickArea"
              href="/instructions/${encodeURIComponent(instruction.id)}"
            >
              <span class="InstructionButton_index" aria-hidden="true"></span>

              <span class="InstructionButton_body">
                <span class="InstructionButton_title">
                  ${escapeHtml(instruction.title)}
                </span>
              </span>

              <span class="InstructionButton_arrow" aria-hidden="true">в†’</span>
            </a>
          </div>
        </li>`
    )
    .join("\n");
}

function renderSections(instruction) {
  if (!Array.isArray(instruction.sections)) return "";

  return instruction.sections
    .map((section, index) => {
      const number = section.number ?? index + 1;
      const heading =
        section.heading ||
        section.title ||
        section.name ||
        `Раздел ${number}`;

      const paragraphs = Array.isArray(section.paragraphs)
        ? section.paragraphs
        : Array.isArray(section.items)
          ? section.items
          : [];

      return `
        <section class="InstructionModal_section">
          <h2 class="InstructionModal_sectionHeading">
            ${escapeHtml(number)}. ${escapeHtml(heading)}
          </h2>
          ${paragraphs
            .map(
              (paragraph) => `
                <p class="InstructionModal_paragraph">
                  ${escapeHtml(
                    typeof paragraph === "string"
                      ? paragraph
                      : paragraph?.text ?? paragraph?.content ?? ""
                  )}
                </p>`
            )
            .join("")}
        </section>`;
    })
    .join("\n");
}

function renderHtmlHead({
  title,
  description,
  canonical,
  schema,
  robots = "index, follow, max-image-preview:large",
  ogType = "website",
}) {
  return `
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>

<link
  href="https://fonts.googleapis.com/css2?family=Comfortaa:wght@400;500;600;700&display=swap"
  rel="stylesheet"
/>

  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="${escapeHtml(robots)}">
  <link rel="canonical" href="${escapeHtml(canonical)}">

  <meta property="og:type" content="${escapeHtml(ogType)}">
  <meta property="og:locale" content="ru_RU">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${escapeHtml(canonical)}">
  <meta property="og:site_name" content="${BRAND_NAME}">

  <script type="application/ld+json">${jsonForHtml(schema)}</script>

  <style>${EXACT_SITE_CSS}</style>
</head>`;
}

function renderInstructionsCatalogPage(req, instructions, query = "") {
  const siteUrl = getSiteUrl(req);
  const canonical = `${siteUrl}/instructions/`;
  const hasQuery = Boolean(String(query || "").trim());

  const pageTitle = hasQuery
    ? `Поиск инструкций: ${query} | ${BRAND_NAME}`
    : `РРЅСЃС‚СЂСѓРєС†РёРё РїРѕ РѕС…СЂР°РЅРµ С‚СЂСѓРґР° | ${BRAND_NAME}`;

  const description =
    "Каталог инструкций по охране труда для работников различных профессий и видов работ.";

  const itemList = {
    "@type": "ItemList",
    "@id": `${canonical}#itemlist`,
    numberOfItems: instructions.length,
    itemListElement: instructions.map((instruction, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: instruction.title,
      url: getInstructionUrl(req, instruction),
    })),
  };

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: BRAND_NAME,
        inLanguage: "ru-RU",
      },
      {
        "@type": "CollectionPage",
        "@id": canonical,
        url: canonical,
        name: "РРЅСЃС‚СЂСѓРєС†РёРё РїРѕ РѕС…СЂР°РЅРµ С‚СЂСѓРґР°",
        description,
        inLanguage: "ru-RU",
        isPartOf: {
          "@id": `${siteUrl}/#website`,
        },
        mainEntity: {
          "@id": `${canonical}#itemlist`,
        },
      },
      itemList,
    ],
  };

  return `<!doctype html>
<html lang="ru">
${renderHtmlHead({
  title: pageTitle,
  description,
  canonical,
  schema,
  robots: hasQuery ? "noindex, follow" : "index, follow, max-image-preview:large",
})}
<body>
  <div class="App_page">
    ${renderHeader(query)}
    ${renderCategoryNav()}
    ${renderMainHero({ headingTag: "h1" })}

    <main>
      <div class="App_resultsHead">
        <span class="App_count">найдено: ${instructions.length}</span>
      </div>

      ${
        instructions.length
          ? `<ul class="InstructionList_list">${renderInstructionCards(instructions)}</ul>`
          : `<p class="seo-empty-query">По вашему запросу инструкции не найдены.</p>`
      }
    </main>
  </div>
</body>
</html>`;
}

function renderInstructionPage(req, instruction) {
  const siteUrl = getSiteUrl(req);
  const canonical = getInstructionUrl(req, instruction);
  const title = String(
    instruction.title || "РРЅСЃС‚СЂСѓРєС†РёСЏ РїРѕ РѕС…СЂР°РЅРµ С‚СЂСѓРґР°"
  ).trim();
  const description = makeDescription(instruction);
  const modified = getDateModified(instruction);

  const articleSchema = {
    "@type": "Article",
    "@id": `${canonical}#article`,
    headline: title,
    description,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": canonical,
    },
    publisher: {
      "@type": "Organization",
      name: BRAND_NAME,
      url: siteUrl,
    },
  };

  if (instruction.createdAt) {
    articleSchema.datePublished = instruction.createdAt;
  }

  if (modified) {
    articleSchema.dateModified = modified;
  }

  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: BRAND_NAME,
        inLanguage: "ru-RU",
      },
      {
        "@type": "WebPage",
        "@id": canonical,
        url: canonical,
        name: title,
        description,
        inLanguage: "ru-RU",
        isPartOf: {
          "@id": `${siteUrl}/#website`,
        },
      },
      articleSchema,
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: "Главная",
            item: `${siteUrl}/`,
          },
          {
            "@type": "ListItem",
            position: 2,
            name: "РРЅСЃС‚СЂСѓРєС†РёРё РїРѕ РѕС…СЂР°РЅРµ С‚СЂСѓРґР°",
            item: `${siteUrl}/instructions/`,
          },
          {
            "@type": "ListItem",
            position: 3,
            name: title,
            item: canonical,
          },
        ],
      },
    ],
  };

  return `<!doctype html>
<html lang="ru">
${renderHtmlHead({
  title: `${title} | ${BRAND_NAME}`,
  description,
  canonical,
  schema,
  ogType: "article",
})}
<body>
  <div class="App_page">
    ${renderHeader("")}
    ${renderCategoryNav()}

    <!-- Визуально тот же hero, что на главной. H1 оставляем самой инструкции ниже. -->
    ${renderMainHero({ headingTag: "div" })}

    <main>
      <div class="App_resultsHead">
        <span class="App_count">инструкция</span>
      </div>

      <div class="seo-article-wrap">
        <article class="InstructionModal_modal">
          <a
            class="InstructionModal_close"
            href="/instructions/"
            aria-label="Закрыть и вернуться к списку инструкций"
          >Г—</a>

          <h1 class="InstructionModal_title">${escapeHtml(title)}</h1>

          ${
            instruction.intro
              ? `<p class="InstructionModal_intro">${escapeHtml(instruction.intro)}</p>`
              : ""
          }

          ${renderSections(instruction)}
        </article>
      </div>
    </main>
  </div>
</body>
</html>`;
}

function renderNotFoundPage(req) {
  const siteUrl = getSiteUrl(req);

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, follow">
  <title>РРЅСЃС‚СЂСѓРєС†РёСЏ РЅРµ РЅР°Р№РґРµРЅР° | ${BRAND_NAME}</title>
  <style>${EXACT_SITE_CSS}</style>
</head>
<body>
  <div class="App_page">
    ${renderHeader("")}
    ${renderCategoryNav()}
    ${renderMainHero({ headingTag: "div" })}

    <main>
      <div class="seo-article-wrap">
        <article class="InstructionModal_modal">
          <a
            class="InstructionModal_close"
            href="/instructions/"
            aria-label="Вернуться к списку инструкций"
          >Г—</a>

          <h1 class="InstructionModal_title">РРЅСЃС‚СЂСѓРєС†РёСЏ РЅРµ РЅР°Р№РґРµРЅР°</h1>
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
  ["/brand/logo-icon.png", path.join(CLIENT_PUBLIC_DIR, "brand", "logo-icon.png")],
  ["/team/nikolay-boykov.webp", path.join(CLIENT_PUBLIC_DIR, "team", "nikolay-boykov.webp")],
  ["/team/nikolay-boykov.png", path.join(CLIENT_PUBLIC_DIR, "team", "nikolay-boykov.png")],
]);

for (const [urlPath, filePath] of PUBLIC_ASSETS) {
  router.get(urlPath, (req, res, next) => {
    if (!fs.existsSync(filePath)) return next();
    return res.sendFile(filePath);
  });
}

router.get("/instructions/", (req, res, next) => {
  try {
    const query = String(req.query.q || "").trim();
    const instructions = getIndexableInstructions(query);

    res
      .status(200)
      .set("Cache-Control", "public, max-age=300")
      .type("html")
      .send(renderInstructionsCatalogPage(req, instructions, query));
  } catch (error) {
    next(error);
  }
});

router.get("/instructions/:id", (req, res, next) => {
  try {
    const instruction = instructionsRepository.getById(req.params.id);

    if (!instruction) {
      return res
        .status(404)
        .type("html")
        .send(renderNotFoundPage(req));
    }

    res
      .status(200)
      .set("Cache-Control", "public, max-age=300")
      .type("html")
      .send(renderInstructionPage(req, instruction));
  } catch (error) {
    next(error);
  }
});

router.get("/sitemap.xml", (req, res, next) => {
  try {
    const instructions = getIndexableInstructions();

    const urls = instructions
      .map((instruction) => {
        const loc = getInstructionUrl(req, instruction);
        const modified = getDateModified(instruction);

        return [
          "  <url>",
          `    <loc>${escapeXml(loc)}</loc>`,
          modified
            ? `    <lastmod>${escapeXml(String(modified).slice(0, 10))}</lastmod>`
            : "",
          "  </url>",
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${escapeXml(`${getSiteUrl(req)}/`)}</loc>
  </url>
  <url>
    <loc>${escapeXml(`${getSiteUrl(req)}/instructions/`)}</loc>
  </url>
${urls}
</urlset>`;

    res
      .status(200)
      .set("Cache-Control", "public, max-age=300")
      .type("application/xml")
      .send(xml);
  } catch (error) {
    next(error);
  }
});

router.get("/robots.txt", (req, res) => {
  const content = `User-agent: *
Allow: /

Disallow: /api/

Sitemap: ${getSiteUrl(req)}/sitemap.xml
`;

  res
    .status(200)
    .set("Cache-Control", "public, max-age=3600")
    .type("text/plain")
    .send(content);
});

export default router;
