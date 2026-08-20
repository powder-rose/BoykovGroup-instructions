const TRANSLIT_MAP = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
  я: "ya",
};

/** Транслитерирует и превращает произвольную строку (в т.ч. кириллицу) в URL-slug. */
export function slugify(input) {
  const lower = String(input).toLowerCase();
  let translit = "";
  for (const ch of lower) {
    if (Object.prototype.hasOwnProperty.call(TRANSLIT_MAP, ch)) {
      translit += TRANSLIT_MAP[ch];
    } else {
      translit += ch;
    }
  }
  return translit
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}
