const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "src", "data", "instructions");

function fix(text) {
  try {
    return Buffer.from(text, "latin1").toString("utf8");
  } catch {
    return text;
  }
}

for (const file of fs.readdirSync(dir)) {
  if (!file.endsWith(".json")) continue;

  const full = path.join(dir, file);

  let raw = fs.readFileSync(full, "utf8");

  if (raw.includes("Р")) {
    const fixed = fix(raw);

    fs.writeFileSync(
      full,
      fixed,
      { encoding: "utf8" }
    );

    console.log("Исправлен:", file);
  }
}

console.log("Готово");