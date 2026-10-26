export function updateInstructionFilterParams(current, updates) {
  const next = new URLSearchParams(current);
  if (Object.hasOwn(updates, 'catalog')) {
    next.delete('category');
    next.delete('tag');
  } else if (Object.hasOwn(updates, 'category')) {
    next.delete('tag');
  }
  for (const [key, value] of Object.entries(updates)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  next.delete('page');
  return next;
}
