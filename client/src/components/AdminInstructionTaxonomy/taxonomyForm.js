export const TAXONOMY_GROUPS = [
  { kind: 'root', label: 'Общий каталог' },
  { kind: 'catalog', label: 'Каталоги' },
  { kind: 'section', label: 'Разделы' },
  { kind: 'tag', label: 'Теги' },
];

const COLLECTIONS = { catalog: 'catalogs', section: 'sections', tag: 'tags' };
const EDITABLE_FIELDS = [
  'name',
  'slug',
  'parentCode',
  'h1',
  'seoTitle',
  'seoDescription',
  'introContent',
  'seoContent',
  'canonicalUrl',
  'status',
  'indexingEnabled',
  'sortOrder',
];

export function entitiesFor(registry, kind) {
  if (!registry) return [];
  return kind === 'root' ? [registry.root] : registry[COLLECTIONS[kind]] || [];
}

export function entityToForm(entity) {
  return Object.fromEntries(
    ['code', ...EDITABLE_FIELDS].map(field => [
      field,
      field === 'sortOrder' ? String(entity.sortOrder) : structuredClone(entity[field]),
    ]),
  );
}

export function newEntityForm(kind, registry) {
  return {
    code: '',
    name: '',
    slug: '',
    parentCode: kind === 'section' ? registry.catalogs[0]?.code || '' : 'ROOT',
    h1: '',
    seoTitle: '',
    seoDescription: '',
    introContent: { type: 'doc', content: [] },
    seoContent: { type: 'doc', content: [] },
    canonicalUrl: '',
    status: 'draft',
    indexingEnabled: false,
    sortOrder: '0',
  };
}

export function formToInput(form, creating) {
  return Object.fromEntries(
    [...(creating ? ['code'] : []), ...EDITABLE_FIELDS].map(field => [
      field,
      field === 'sortOrder' ? Number(form.sortOrder) : form[field],
    ]),
  );
}

export function validateTaxonomyForm(form) {
  if (!/^[A-Z][A-Z0-9_-]{1,63}$/u.test(form.code)) {
    return 'Код: от 2 до 64 символов — заглавные латинские буквы, цифры, дефис или подчёркивание. Первый символ — буква.';
  }
  if (!form.name.trim()) return 'Заполните название.';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(form.slug)) {
    return 'URL: строчные латинские буквы и цифры, слова разделяются дефисом.';
  }
  if (!/^\d+$/u.test(form.sortOrder) || !Number.isSafeInteger(Number(form.sortOrder))) {
    return 'Порядок сортировки должен быть целым неотрицательным числом.';
  }
  return '';
}

export function entityPath(registry, kind, form) {
  const root = '/instrukcii-po-ohrane-truda';
  if (kind === 'root') return root;
  if (!form.slug) return '';
  if (kind === 'tag') return `${root}/temy/${form.slug}/`;
  if (kind === 'catalog') return `${root}/${form.slug}/`;
  const catalog = registry.catalogs.find(item => item.code === form.parentCode);
  return catalog ? `${root}/${catalog.slug}/${form.slug}/` : '';
}
