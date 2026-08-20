import Fuse from "fuse.js";
import { instructionsRepository } from "./instructionsRepository.js";

const FUSE_OPTIONS = {
  includeScore: true,
  threshold: 0.4, // допускаем опечатки/неточные формулировки запроса
  ignoreLocation: true,
  keys: [
    { name: "title", weight: 0.6 },
    { name: "profession", weight: 0.35 },
    { name: "intro", weight: 0.05 },
  ],
};

/**
 * Поиск инструкций «на сервере»: клиент присылает текст запроса,
 * весь поиск (нечёткое сопоставление по названию/профессии) выполняется
 * здесь, клиент получает уже готовый и отсортированный список.
 */
function toSummary(instruction) {
  return {
    id: instruction.id,
    title: instruction.title,
    profession: instruction.profession,
    source: instruction.source,
    createdAt: instruction.createdAt,
  };
}

export function searchInstructions(query, { page = 1, pageSize = 6 } = {}) {
  const all = instructionsRepository.getAll();
  let matched;

  const trimmed = (query ?? "").trim();
  if (!trimmed) {
    matched = [...all].sort((a, b) => a.title.localeCompare(b.title, "ru"));
  } else {
    const fuse = new Fuse(all, FUSE_OPTIONS);
    matched = fuse.search(trimmed).map((r) => r.item);
  }

  const total = matched.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  const items = matched.slice(start, start + pageSize).map(toSummary);

  return {
    items,
    page: safePage,
    pageSize,
    total,
    totalPages,
    query: trimmed,
  };
}