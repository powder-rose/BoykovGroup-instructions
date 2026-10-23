import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  createInstructionEditorService,
  getRelatedInstructions,
} from '../src/services/instructionEditorService.js';
import { InstructionsRepository } from '../src/services/instructionsRepository.js';
import { createInstructionTaxonomyRegistryRepository } from '../src/services/instructionTaxonomyRegistryRepository.js';
import { rankInstructionsByQuery } from '../src/services/searchService.js';

function richText(text) {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  };
}

function editorInput(overrides = {}) {
  return {
    title: 'Инструкция по охране труда для электромонтёра',
    slug: 'elektromonter-manual',
    webIntro: 'На странице доступен полный текст и PDF после подтверждения e-mail.',
    instructionContent: richText('УТВЕРЖДАЮ. Полный текст инструкции. Приложение А.'),
    explanationContent: richText('Пояснение после инструкции: как утвердить документ.'),
    seoTitle: 'Инструкция электромонтёра — полный текст и PDF',
    seoDescription: 'Полный текст инструкции для электромонтёра и пояснения по её применению.',
    status: 'draft',
    ...overrides,
  };
}

function createInput(overrides = {}) {
  return editorInput({
    taxonomyPatch: {
      category: { mode: 'manual', id: 'W01' },
      tags: { mode: 'manual', ids: [] },
      registryRevision: 0,
    },
    ...overrides,
  });
}

function fixture(t, options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-instruction-editor-'));
  const repository = new InstructionsRepository(path.join(directory, 'published'));
  const draftsDirectory = path.join(directory, 'drafts');
  const snapshots = [];
  const serviceOptions = {
    repository,
    draftsDirectory,
    taxonomyRepository: createInstructionTaxonomyRegistryRepository({
      filePath: path.join(directory, 'taxonomy.json'),
    }),
    saveSnapshot: instruction => snapshots.push(structuredClone(instruction)),
    ...options,
  };
  const service = createInstructionEditorService(serviceOptions);

  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  return { repository, service, directory, draftsDirectory, snapshots, serviceOptions };
}

test('new instruction draft persists separately and cannot satisfy public or paid lookups', t => {
  const { repository, service, serviceOptions } = fixture(t);
  const saved = service.save(null, createInput());
  const { instruction } = saved;

  assert.ok(instruction.id);
  assert.equal(instruction.status, 'draft');
  assert.equal(saved.hasDraft, true);
  assert.equal(saved.hasPublishedVersion, false);
  assert.equal(repository.getAll().length, 0);
  assert.equal(repository.getById(instruction.id), null);
  assert.equal(repository.getBySlug(instruction.slug), null);

  assert.ok(instruction.professionKey);
  assert.equal(repository.findByProfessionKey(instruction.professionKey), null);

  const reloaded = createInstructionEditorService(serviceOptions).get(instruction.id);

  assert.deepEqual(reloaded.instruction, instruction);
  assert.equal(service.list().length, 1);
  assert.equal(service.list()[0].id, instruction.id);
});

test('blank new slug is generated from the title and blank edits retain the existing URL', t => {
  const { service } = fixture(t);
  const created = service.save(
    null,
    createInput({ title: 'Инструкция электрика', slug: '   ' }),
  ).instruction;

  assert.equal(created.slug, 'instruktsiya-elektrika');

  const edited = service.save(
    created.id,
    editorInput({
      title: 'Обновлённое название',
      slug: '',
      revision: created.revision,
    }),
  ).instruction;

  assert.equal(edited.slug, created.slug);
});

test('blank slug preserves an old instruction ID as the published URL', t => {
  const { repository, service } = fixture(t);
  const legacy = {
    id: 'legacy_Instruction-X7',
    title: 'Старая инструкция электрика',
    intro: 'Исходное вступление.',
    sections: [{ number: 1, heading: 'Требования', paragraphs: ['1.1. Проверить инструмент.'] }],
  };

  repository.save(legacy);

  const result = service.save(
    legacy.id,
    editorInput({
      status: 'published',
      slug: '  ',
      revision: 0,
    }),
  );

  assert.equal(result.instruction.slug, legacy.id);
  assert.equal(result.publicSlug, legacy.id);
  assert.equal(repository.getBySlug(legacy.id).id, legacy.id);
});

test('publication keeps the stable ID and complete manual document without import conversion', t => {
  const { repository, service } = fixture(t);
  const draft = service.save(null, createInput()).instruction;
  const table = {
    type: 'table',
    content: [
      {
        type: 'tableRow',
        content: ['Оборудование', 'Проверка'].map(text => ({
          type: 'tableHeader',
          content: richText(text).content,
        })),
      },
      {
        type: 'tableRow',
        content: ['Лестница', 'Осмотр перед работой'].map(text => ({
          type: 'tableCell',
          content: richText(text).content,
        })),
      },
    ],
  };
  const input = editorInput({
    status: 'published',
    revision: draft.revision,
    instructionContent: {
      type: 'doc',
      content: [
        ...richText('УТВЕРЖДАЮ. Подпись руководителя.').content,
        table,
        ...richText('Приложение А. Полный текст приложения.').content,
      ],
    },
  });
  const result = service.save(draft.id, input);
  const published = repository.getById(draft.id);

  assert.equal(result.instruction.id, draft.id);
  assert.equal(result.hasPublishedVersion, true);
  assert.equal(result.hasDraft, false);
  assert.equal(result.publicSlug, input.slug);
  assert.equal(repository.getBySlug(input.slug).id, draft.id);
  assert.equal(published.webIntro, input.webIntro);
  assert.deepEqual(published.explanationContent, input.explanationContent);
  assert.equal(published.instructionContent.content[1].type, 'table');
  assert.ok(JSON.stringify(published.instructionContent).includes('Полный текст приложения.'));
  assert.ok(result.instruction.revision > draft.revision);
});

test('saving draft edits leaves the live JSON, public slug and paid lookup unchanged', t => {
  const { repository, service, snapshots } = fixture(t);
  const published = service.save(null, createInput({ status: 'published' })).instruction;
  const before = structuredClone(repository.getById(published.id));
  const filePath = path.join(repository.dir, `${published.id}.json`);
  const diskBefore = fs.readFileSync(filePath, 'utf8');
  const draft = service.save(
    published.id,
    editorInput({
      revision: published.revision,
      slug: 'unpublished-new-slug',
      title: 'Ещё не опубликованное изменение',
      instructionContent: richText('Черновой текст, который посетитель не должен увидеть.'),
    }),
  );

  assert.equal(draft.hasDraft, true);
  assert.equal(draft.hasPublishedVersion, true);
  assert.equal(draft.publicSlug, before.slug);
  assert.deepEqual(repository.getById(published.id), before);
  assert.equal(fs.readFileSync(filePath, 'utf8'), diskBefore);
  assert.equal(repository.getBySlug('unpublished-new-slug'), null);
  assert.equal(repository.getBySlug(before.slug).title, before.title);

  assert.ok(before.professionKey);
  assert.deepEqual(repository.findByProfessionKey(before.professionKey), before);

  assert.equal(snapshots.length, 0);
});

test('stale or missing revisions cannot overwrite, delete, discard or unpublish newer edits', t => {
  const { repository, service } = fixture(t);
  const published = service.save(null, createInput({ status: 'published' })).instruction;
  const draft = service.save(
    published.id,
    editorInput({ revision: published.revision, title: 'Свежая редакция' }),
  ).instruction;

  for (const revision of [undefined, published.revision]) {
    for (const action of [
      () => service.save(published.id, editorInput({ revision, title: 'Устаревшая редакция' })),
      () => service.remove(published.id, { revision }),
      () => service.discardDraft(published.id, { revision }),
      () => service.unpublish(published.id, { revision }),
    ]) {
      assert.throws(action, error => [400, 409].includes(error.status));
    }
  }

  assert.equal(service.get(published.id).instruction.title, draft.title);
  assert.equal(repository.getById(published.id).title, published.title);
});

test('discarding draft restores the published editor view without reverting live content', t => {
  const { repository, service, serviceOptions } = fixture(t);
  const published = service.save(null, createInput({ status: 'published' })).instruction;
  const draft = service.save(
    published.id,
    editorInput({ revision: published.revision, title: 'Удаляемый черновик' }),
  ).instruction;

  service.discardDraft(published.id, { revision: draft.revision });

  const result = createInstructionEditorService(serviceOptions).get(published.id);

  assert.equal(result.hasDraft, false);
  assert.equal(result.hasPublishedVersion, true);
  assert.equal(result.instruction.title, published.title);
  assert.equal(repository.getById(published.id).title, published.title);
  assert.ok(result.instruction.revision > draft.revision);

  for (const revision of [published.revision, draft.revision]) {
    assert.throws(() => service.save(published.id, editorInput({ revision })), { status: 409 });
  }
});

test('unpublishing retains the latest draft while removing all public lookup results', t => {
  const { repository, service } = fixture(t);
  const published = service.save(null, createInput({ status: 'published' })).instruction;
  const draft = service.save(
    published.id,
    editorInput({ revision: published.revision, title: 'Сохранённая рабочая редакция' }),
  ).instruction;
  const result = service.unpublish(published.id, { revision: draft.revision });

  assert.equal(result.hasDraft, true);
  assert.equal(result.hasPublishedVersion, false);
  assert.equal(result.instruction.title, draft.title);
  assert.equal(result.instruction.status, 'draft');
  assert.equal(repository.getById(published.id), null);
  assert.equal(repository.getBySlug(published.slug), null);
  assert.equal(repository.getAll().length, 0);
});

test('republishing a withdrawn instruction retains its first publication date and advances its version', t => {
  const { repository, service } = fixture(t);
  const published = {
    ...editorInput({ status: 'published' }),
    id: 'previously-published-instruction',
    createdAt: '2026-01-02T00:00:00.000Z',
    publishedAt: '2026-01-03T00:00:00.000Z',
    updatedAt: '2026-02-04T00:00:00.000Z',
    version: '2.4',
    revision: 7,
  };

  repository.save(published);

  const draft = service.unpublish(published.id, { revision: published.revision }).instruction;
  const result = service.save(published.id, { ...draft, status: 'published' });

  assert.equal(result.hasDraft, false);
  assert.equal(result.hasPublishedVersion, true);
  assert.equal(result.instruction.publishedAt, published.publishedAt);
  assert.equal(result.instruction.createdAt, published.createdAt);
  assert.equal(result.instruction.version, '2.5');
  assert.ok(result.instruction.revision > draft.revision);
  assert.equal(repository.getById(published.id).publishedAt, published.publishedAt);
});

test('published slugs, historical slugs, stable IDs and other drafts cannot be hijacked', t => {
  const { repository, service } = fixture(t);
  const first = service.save(null, createInput({ status: 'published' })).instruction;
  const renamed = service.save(
    first.id,
    editorInput({ status: 'published', revision: first.revision, slug: 'renamed-manual' }),
  ).instruction;

  assert.equal(repository.getBySlug(first.slug).id, first.id);
  assert.equal(repository.getBySlug(first.id).id, first.id);
  assert.equal(repository.getBySlug(renamed.slug).id, first.id);

  const separateDraft = service.save(
    null,
    createInput({ slug: 'reserved-draft-slug' }),
  ).instruction;

  for (const slug of [first.slug, first.id, renamed.slug, separateDraft.slug]) {
    assert.throws(() => service.save(null, createInput({ slug })), { status: 409 });
  }
});

test('generated IDs cannot overwrite another instruction slug or alias in the repository', t => {
  const { repository } = fixture(t);
  const existing = {
    id: 'published-stable-id',
    slug: 'reserved-current-slug',
    slugAliases: ['reserved-old-slug'],
    title: 'Опубликованная инструкция',
    status: 'published',
  };

  repository.save(existing);

  const cacheBefore = structuredClone(repository.getAll());
  const filePath = path.join(repository.dir, `${existing.id}.json`);
  const diskBefore = fs.readFileSync(filePath, 'utf8');
  const filesBefore = fs.readdirSync(repository.dir);

  for (const id of [existing.slug, ...existing.slugAliases]) {
    assert.throws(
      () =>
        repository.save({
          id,
          title: 'Новая автоматически сгенерированная инструкция',
          source: 'generated',
        }),
      {
        status: 409,
        code: 'INSTRUCTION_SLUG_CONFLICT',
      },
    );
    assert.equal(repository.getById(id), null);
    assert.equal(repository.getBySlug(id).id, existing.id);
    assert.deepEqual(repository.getAll(), cacheBefore);
    assert.equal(fs.readFileSync(filePath, 'utf8'), diskBefore);
    assert.deepEqual(fs.readdirSync(repository.dir), filesBefore);
  }
});

test('related instructions match a meaningful profession token despite editorial title additions', t => {
  const { repository } = fixture(t);
  const main = {
    id: 'decorated-electrician',
    title: 'Инструкция по охране труда для электромонтера — проверка редактора',
    profession: 'электромонтера — проверка редактора',
  };
  const related = {
    id: 'equipment-electrician',
    title: 'Инструкция по охране труда для электромонтера оборудования',
    profession: 'электромонтер оборудования',
  };
  const unrelated = {
    id: 'accountant',
    title: 'Инструкция по охране труда для бухгалтера',
    profession: 'бухгалтер',
  };

  for (const instruction of [main, related, unrelated]) {
    repository.save(instruction);
  }

  const result = getRelatedInstructions(main, { repository });

  assert.deepEqual(
    result.map(item => item.id),
    [related.id],
  );
  assert.deepEqual(
    rankInstructionsByQuery([related, unrelated], main.profession, {
      sort: 'relevance',
    }),
    [],
  );
});

test('legacy records without editorial fields remain published and editable without losing metadata', t => {
  const { repository, service, snapshots } = fixture(t);
  const legacy = {
    id: 'legacy_Nanoid-X9w',
    title: 'Инструкция по охране труда для электромонтёра',
    profession: 'Электромонтёр',
    professionKey: 'электромонтер',
    source: 'generated',
    version: '1.2',
    intro: 'Документное вступление старой инструкции.',
    sections: [
      {
        number: 1,
        heading: 'Общие требования',
        paragraphs: ['1.1. Допускаются обученные работники.'],
      },
    ],
    createdAt: '2026-01-01T00:00:00.000Z',
  };

  repository.save(legacy);

  const editor = service.get(legacy.id);

  assert.equal(editor.hasDraft, false);
  assert.equal(editor.hasPublishedVersion, true);
  assert.equal(editor.instruction.revision, 0);
  assert.equal(editor.instruction.slug, legacy.id);
  assert.ok(JSON.stringify(editor.instruction.instructionContent).includes(legacy.intro));
  assert.ok(
    JSON.stringify(editor.instruction.instructionContent).includes(
      legacy.sections[0].paragraphs[0],
    ),
  );
  assert.equal(repository.getBySlug(legacy.id).id, legacy.id);
  assert.equal(repository.findByProfessionKey(legacy.professionKey).id, legacy.id);

  service.save(legacy.id, {
    ...editor.instruction,
    status: 'published',
    title: 'Отредактированная старая инструкция',
    seoTitle: 'Обновлённая инструкция',
    seoDescription: 'Описание обновлённой инструкции.',
  });

  const updated = repository.getById(legacy.id);

  assert.equal(updated.createdAt, legacy.createdAt);
  assert.equal(updated.professionKey, legacy.professionKey);
  assert.equal(updated.version, '1.3');
  assert.equal(snapshots.length, 1);
  assert.deepEqual(snapshots[0], legacy);
});

test('invalid slug or malformed rich text is rejected before any persisted draft or publication changes', t => {
  const { repository, service } = fixture(t);
  const published = service.save(null, createInput({ status: 'published' })).instruction;
  const invalidDocuments = [
    { type: 'doc', content: [{ type: 'script', content: [] }] },
    {
      type: 'doc',
      content: [{ type: 'instruction', attrs: { id: 'nested_document', text: 'Forbidden' } }],
    },
    {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Link',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
          ],
        },
      ],
    },
  ];

  for (const changes of [
    { slug: '../escape' },
    { slug: 'https://example.org/' },
    { webIntro: 'x'.repeat(2001) },
    ...invalidDocuments.map(instructionContent => ({ instructionContent })),
    ...invalidDocuments.map(explanationContent => ({ explanationContent })),
  ]) {
    assert.throws(
      () => service.save(published.id, editorInput({ revision: published.revision, ...changes })),
      { status: 400 },
    );
  }

  assert.equal(service.get(published.id).hasDraft, false);
  assert.equal(repository.getById(published.id).revision, published.revision);
});

test('failed draft rename preserves both the previous draft and published file', t => {
  const { repository, service, draftsDirectory } = fixture(t);
  const published = service.save(null, createInput({ status: 'published' })).instruction;
  const draft = service.save(
    published.id,
    editorInput({ revision: published.revision, title: 'Сохранённый черновик' }),
  ).instruction;
  const originalRename = fs.renameSync;

  const rename = t.mock.method(fs, 'renameSync', (from, to) => {
    if (String(to).startsWith(`${draftsDirectory}${path.sep}`)) {
      throw Object.assign(new Error('simulated draft disk failure'), { code: 'ENOSPC' });
    }

    return originalRename(from, to);
  });

  assert.throws(() =>
    service.save(published.id, editorInput({ revision: draft.revision, title: 'Не записано' })),
  );
  rename.mock.restore();

  assert.equal(service.get(published.id).instruction.title, draft.title);
  assert.equal(repository.getById(published.id).title, published.title);
  assert.ok(fs.readdirSync(draftsDirectory).every(file => file.endsWith('.json')));
});

test('failed publish retains the last public file and the editable draft for retry', t => {
  const { repository, service } = fixture(t);
  const published = service.save(null, createInput({ status: 'published' })).instruction;
  const draft = service.save(
    published.id,
    editorInput({ revision: published.revision, title: 'Ожидает публикации' }),
  ).instruction;
  const filePath = path.join(repository.dir, `${published.id}.json`);
  const diskBefore = fs.readFileSync(filePath, 'utf8');
  const originalRename = fs.renameSync;
  const rename = t.mock.method(fs, 'renameSync', (from, to) => {
    if (to === filePath) {
      throw Object.assign(new Error('simulated publish disk failure'), { code: 'ENOSPC' });
    }

    return originalRename(from, to);
  });

  assert.throws(() => service.save(published.id, { ...draft, status: 'published' }));
  rename.mock.restore();

  assert.equal(fs.readFileSync(filePath, 'utf8'), diskBefore);
  assert.equal(repository.getById(published.id).title, published.title);
  assert.equal(service.get(published.id).instruction.title, draft.title);
  assert.equal(service.get(published.id).hasDraft, true);
});

test('failed unpublish draft write leaves the published document available', t => {
  const { repository, service, draftsDirectory } = fixture(t);
  const published = service.save(null, createInput({ status: 'published' })).instruction;
  const originalRename = fs.renameSync;
  const rename = t.mock.method(fs, 'renameSync', (from, to) => {
    if (String(to).startsWith(`${draftsDirectory}${path.sep}`)) {
      throw Object.assign(new Error('simulated unpublish disk failure'), { code: 'ENOSPC' });
    }

    return originalRename(from, to);
  });

  assert.throws(() => service.unpublish(published.id, { revision: published.revision }), {
    status: 500,
  });
  rename.mock.restore();

  assert.equal(repository.getBySlug(published.slug).title, published.title);
  assert.equal(service.get(published.id).hasPublishedVersion, true);
  assert.equal(service.get(published.id).hasDraft, false);
});

test('deleting an instruction removes published and draft copies without touching another instruction', t => {
  const { repository, service } = fixture(t);
  const published = service.save(null, createInput({ status: 'published' })).instruction;
  const other = service.save(
    null,
    createInput({ status: 'published', slug: 'other-instruction' }),
  ).instruction;
  const draft = service.save(
    published.id,
    editorInput({ revision: published.revision }),
  ).instruction;

  service.remove(published.id, { revision: draft.revision });

  assert.throws(() => service.get(published.id), { status: 404 });
  assert.equal(repository.getById(published.id), null);
  assert.equal(repository.getBySlug(published.slug), null);
  assert.equal(service.list().length, 1);
  assert.equal(repository.getById(other.id).title, other.title);
});

test('failed published-file removal preserves the latest draft and live document', t => {
  const { repository, service, serviceOptions } = fixture(t);
  const published = service.save(null, createInput({ status: 'published' })).instruction;
  const draft = service.save(
    published.id,
    editorInput({
      title: 'Рабочий черновик, который нельзя потерять',
      revision: published.revision,
    }),
  ).instruction;
  const remove = t.mock.method(repository, 'remove', () => {
    throw Object.assign(new Error('simulated published unlink failure'), { code: 'EACCES' });
  });

  assert.throws(
    () => service.remove(published.id, { revision: draft.revision }),
    /simulated published unlink failure/u,
  );
  remove.mock.restore();

  const reloaded = createInstructionEditorService(serviceOptions).get(published.id);

  assert.equal(reloaded.hasDraft, true);
  assert.equal(reloaded.hasPublishedVersion, true);
  assert.deepEqual(reloaded.instruction, draft);
  assert.equal(repository.getById(published.id).title, published.title);
});
