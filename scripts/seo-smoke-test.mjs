const [baseUrlArg, instructionIdArg] = process.argv.slice(2);

if (!baseUrlArg || !instructionIdArg) {
  console.error(
    "Usage: node scripts/seo-smoke-test.mjs https://example.ru instruction-id"
  );
  process.exit(1);
}

const baseUrl = baseUrlArg.replace(/\/+$/, "");
const instructionId = encodeURIComponent(instructionIdArg);

async function get(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "follow",
    headers: {
      "user-agent": "BoykovGroup-SEO-Smoke-Test/1.0",
    },
  });

  const text = await response.text();
  return { response, text };
}

function check(condition, message) {
  if (!condition) {
    console.error(`❌ ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${message}`);
  }
}

console.log(`Testing ${baseUrl}\n`);

const robots = await get("/robots.txt");
check(robots.response.ok, "/robots.txt responds with 2xx");
check(
  robots.text.includes("Sitemap:"),
  "/robots.txt contains Sitemap directive"
);

const sitemap = await get("/sitemap.xml");
check(sitemap.response.ok, "/sitemap.xml responds with 2xx");
check(
  sitemap.text.includes("<urlset"),
  "/sitemap.xml contains <urlset>"
);

const instructionPath = `/instructions/${instructionId}`;
const page = await get(instructionPath);

check(page.response.ok, `${instructionPath} responds with 2xx`);
check(/<title>[^<]+<\/title>/i.test(page.text), "instruction has <title>");
check(
  /<meta[^>]+name=["']description["'][^>]+content=["'][^"']+/i.test(page.text) ||
    /<meta[^>]+content=["'][^"']+["'][^>]+name=["']description["']/i.test(page.text),
  "instruction has meta description"
);
check(
  /<link[^>]+rel=["']canonical["'][^>]+href=["'][^"']+/i.test(page.text) ||
    /<link[^>]+href=["'][^"']+["'][^>]+rel=["']canonical["']/i.test(page.text),
  "instruction has canonical"
);
check(/<h1[^>]*>[\s\S]*?<\/h1>/i.test(page.text), "instruction has <h1>");
check(
  page.text.includes('application/ld+json'),
  "instruction has JSON-LD structured data"
);

// A rough signal that this is a real server-rendered content page, not only a shell.
const visibleText = page.text
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim();

check(
  visibleText.length > 500,
  "instruction contains substantial HTML-visible text"
);

if (!process.exitCode) {
  console.log("\nSEO smoke-test passed.");
}
