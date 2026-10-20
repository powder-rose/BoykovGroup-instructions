function normalize(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLocaleLowerCase('ru-RU')
    .replaceAll('ё', 'е');
}

export function searchCatalogTags(tags, query) {
  const search = normalize(query).trim();
  if (!search) return tags;
  return tags.filter(tag => normalize(tag.label).includes(search));
}

export function nextTagOptionIndex(current, count, direction) {
  if (count === 0) return -1;
  if (current < 0) return direction > 0 ? 0 : count - 1;
  return (current + direction + count) % count;
}
