import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { slugify } from '../utils/slug.js';
import { normalizeArticleContent } from './articleContent.js';
import { ArticleError } from './articleErrors.js';

const DEFAULT_FILE = fileURLToPath(new URL('../data/articles.json', import.meta.url));
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;

function metadataText(value, name, maximum, { required = false } = {}) {
  if (value === undefined || value === null) {
    value = '';
  }

  if (typeof value !== 'string' || value.length > maximum) {
    throw new ArticleError(`${name}: допустимо не больше ${maximum} символов`);
  }

  const result = value.trim().replace(/\s+/gu, ' ');

  if (required && !result) {
    throw new ArticleError(`Заполните поле «${name}»`);
  }

  return result;
}

function normalizeArticleInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new ArticleError('Некорректные данные статьи');
  }

  const title = metadataText(input.title, 'Заголовок', 200, { required: true });
  const slug = metadataText(input.slug, 'Адрес', 160).toLowerCase() || slugify(title);

  if (!SLUG_PATTERN.test(slug) || slug.length > 160) {
    throw new ArticleError(
      'Адрес статьи должен содержать латинские буквы, цифры и одиночные дефисы',
    );
  }

  const status = input.status ?? 'draft';

  if (!['draft', 'published'].includes(status)) {
    throw new ArticleError('Неизвестный статус статьи');
  }

  const content = normalizeArticleContent(input.content);
  const seoTitle = metadataText(input.seoTitle, 'SEO-заголовок', 200);
  const seoDescription = metadataText(input.seoDescription, 'SEO-описание', 400);

  function hasText(node) {
    return (
      (node.type === 'text' && node.text.trim().length > 0) ||
      node.type === 'instruction' ||
      (node.content ?? []).some(hasText)
    );
  }

  if (status === 'published' && (!seoTitle || !seoDescription || !hasText(content))) {
    throw new ArticleError('Для публикации заполните SEO-заголовок, SEO-описание и текст статьи');
  }

  return {
    title,
    slug,
    excerpt: metadataText(input.excerpt, 'Краткое описание', 600),
    seoTitle,
    seoDescription,
    status,
    content,
  };
}

function assertRevision(article, revision) {
  if (!Number.isInteger(revision) || revision < 1) {
    throw new ArticleError('Передайте номер сохранённой версии статьи', {
      code: 'ARTICLE_REVISION_REQUIRED',
    });
  }

  if (revision !== article.revision) {
    throw new ArticleError('Статья уже изменена. Обновите страницу перед сохранением.', {
      status: 409,
      code: 'ARTICLE_REVISION_CONFLICT',
    });
  }
}

function assertUniqueSlug(items, slug, currentId) {
  if (items.some(article => article.slug === slug && article.id !== currentId)) {
    throw new ArticleError('Статья с таким адресом уже существует', {
      status: 409,
      code: 'ARTICLE_SLUG_CONFLICT',
    });
  }
}

function articleNotFound() {
  return new ArticleError('Статья не найдена', { status: 404, code: 'ARTICLE_NOT_FOUND' });
}

export function toArticleSummary(article) {
  const { content: _content, ...summary } = article;

  return summary;
}

export function createArticlesRepository({ filePath = DEFAULT_FILE } = {}) {
  function read() {
    let contents;

    try {
      contents = fs.readFileSync(filePath, 'utf8');
    } catch (cause) {
      if (cause.code === 'ENOENT') {
        return [];
      }

      throw new ArticleError('Не удалось прочитать статьи', {
        status: 500,
        code: 'ARTICLE_STORAGE_ERROR',
        cause,
      });
    }

    try {
      const data = JSON.parse(contents.replace(/^\uFEFF/u, ''));

      if (data?.version !== 1 || !Array.isArray(data.items)) {
        throw new Error('Invalid article storage format');
      }

      const ids = new Set();
      const slugs = new Set();

      for (const article of data.items) {
        if (
          !article ||
          typeof article.id !== 'string' ||
          ids.has(article.id) ||
          slugs.has(article.slug) ||
          !Number.isInteger(article.revision) ||
          article.revision < 1 ||
          !Number.isFinite(Date.parse(article.createdAt)) ||
          !Number.isFinite(Date.parse(article.updatedAt)) ||
          (article.status === 'published' && article.publishedAt === null) ||
          (article.publishedAt !== null && !Number.isFinite(Date.parse(article.publishedAt)))
        ) {
          throw new Error('Invalid article storage record');
        }

        normalizeArticleInput(article);
        ids.add(article.id);
        slugs.add(article.slug);
      }

      return data.items;
    } catch (cause) {
      throw new ArticleError('Хранилище статей повреждено. Сохранение остановлено.', {
        status: 500,
        code: 'ARTICLE_STORAGE_ERROR',
        cause,
      });
    }
  }

  function write(items) {
    const directory = path.dirname(filePath);
    const temporary = path.join(directory, `.${path.basename(filePath)}.${randomUUID()}.tmp`);

    try {
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(temporary, `${JSON.stringify({ version: 1, items }, null, 2)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
        flush: true,
      });
      fs.renameSync(temporary, filePath);
    } catch (cause) {
      try {
        fs.rmSync(temporary, { force: true });
      } catch (cleanupError) {
        console.error('[Articles] Failed to remove unfinished write:', cleanupError.message);
      }

      throw new ArticleError('Не удалось сохранить статьи', {
        status: 500,
        code: 'ARTICLE_STORAGE_ERROR',
        cause,
      });
    }
  }

  const repository = {
    list({ publishedOnly = false } = {}) {
      return read()
        .filter(article => !publishedOnly || article.status === 'published')
        .sort((left, right) => {
          const leftDate = publishedOnly ? left.publishedAt : left.updatedAt;
          const rightDate = publishedOnly ? right.publishedAt : right.updatedAt;

          return rightDate.localeCompare(leftDate) || left.id.localeCompare(right.id);
        });
    },

    listPublished() {
      return repository.list({ publishedOnly: true });
    },

    getById(id) {
      return read().find(article => article.id === id) ?? null;
    },

    getPublishedBySlug(slug) {
      return (
        read().find(article => article.slug === slug && article.status === 'published') ?? null
      );
    },

    create(input) {
      const values = normalizeArticleInput(input);
      const items = read();

      assertUniqueSlug(items, values.slug);

      const now = new Date().toISOString();
      const article = {
        id: randomUUID(),
        ...values,
        createdAt: now,
        updatedAt: now,
        publishedAt: values.status === 'published' ? now : null,
        revision: 1,
      };

      write([...items, article]);

      return structuredClone(article);
    },

    update(id, input, { revision } = {}) {
      const items = read();
      const index = items.findIndex(article => article.id === id);

      if (index < 0) {
        throw articleNotFound();
      }

      const existing = items[index];

      assertRevision(existing, revision);

      const values = normalizeArticleInput(input);

      assertUniqueSlug(items, values.slug, id);

      const now = new Date().toISOString();
      const article = {
        id: existing.id,
        ...values,
        createdAt: existing.createdAt,
        updatedAt: now,
        publishedAt: existing.publishedAt ?? (values.status === 'published' ? now : null),
        revision: existing.revision + 1,
      };

      items[index] = article;
      write(items);

      return structuredClone(article);
    },

    remove(id, { revision } = {}) {
      const items = read();
      const existing = items.find(article => article.id === id);

      if (!existing) {
        throw articleNotFound();
      }

      assertRevision(existing, revision);
      write(items.filter(article => article.id !== id));
    },
  };

  return repository;
}

export const articlesRepository = createArticlesRepository();

export function listPublishedArticles() {
  return articlesRepository.listPublished();
}

export function getPublishedArticleBySlug(slug) {
  return articlesRepository.getPublishedBySlug(slug);
}
