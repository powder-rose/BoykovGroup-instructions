import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";


const router = express.Router();


const __dirname = path.dirname(
  fileURLToPath(import.meta.url)
);


const INSTRUCTIONS_PATH = path.join(
  __dirname,
  "..",
  "data",
  "instructions"
);



router.get("/sitemap.xml", (req, res) => {

  const baseUrl = "https://boykovgroup.ru";


  const urls = [];


  urls.push(`
<url>
  <loc>${baseUrl}/</loc>
  <changefreq>daily</changefreq>
  <priority>1.0</priority>
</url>
`);


  urls.push(`
<url>
  <loc>${baseUrl}/instrukcii-po-ohrane-truda</loc>
  <changefreq>daily</changefreq>
  <priority>0.9</priority>
</url>
`);



  const files = fs.readdirSync(INSTRUCTIONS_PATH)
    .filter(file => file.endsWith(".json"));



  files.forEach(file => {

    const raw = fs.readFileSync(
      path.join(INSTRUCTIONS_PATH, file),
      "utf-8"
    );


    const instruction = JSON.parse(raw);


    urls.push(`
<url>
  <loc>${baseUrl}/instrukciya-po-ohrane-truda/${instruction.id}</loc>
  <changefreq>weekly</changefreq>
  <priority>0.8</priority>
</url>
`);

  });



 const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("")}
</urlset>`;



  res
  .type("application/xml")
  .send(xml.trim());

});



export default router;