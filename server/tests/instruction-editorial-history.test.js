import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { InstructionsRepository } from '../src/services/instructionsRepository.js';
import {
  rollbackInstruction,
  saveInstructionSnapshot,
} from '../src/services/instructionHistoryService.js';

const oldSeoDate = '2020-01-01T00:00:00.000Z';
const oldContentDate = '2021-01-01T00:00:00.000Z';
const snapshotDate = '2019-01-01T00:00:00.000Z';
const richText = text => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

function fixture(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'boykovdocs-editorial-history-'));
  const repository = new InstructionsRepository(path.join(directory, 'instructions'));
  const historyRoot = path.join(directory, 'history');
  const current = {
    id: `editorial-history-${randomUUID()}`,
    slug: 'editorial-instruction',
    title: 'Инструкция электромонтёра',
    instructionContent: richText('Действующий основной документ'),
    webIntro: 'Действующее вводное описание',
    explanationContent: richText('Разъяснения'),
    seoTitle: 'SEO-заголовок',
    seoDescription: 'Описание инструкции и применения',
    revision: 3,
    editorialMeta: {
      seoReady: true,
      seoUpdatedAt: oldSeoDate,
      contentUpdatedAt: oldContentDate,
      seoAuthor: 'Текущий SEO-автор',
      contentAuthor: 'Текущий автор текста',
    },
  };
  repository.save(current);
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return { repository, historyRoot, current };
}

test('rollback of main text keeps current SEO date/readiness and timestamps only reverted content', t => {
  const { repository, historyRoot, current } = fixture(t);
  const snapshot = {
    ...current,
    instructionContent: richText('Предыдущий основной документ'),
    editorialMeta: { seoReady: true, seoUpdatedAt: snapshotDate, contentUpdatedAt: snapshotDate },
  };
  saveInstructionSnapshot(snapshot, { historyRoot });
  const restored = rollbackInstruction(current.id, { repository, historyRoot });
  assert.deepEqual(restored.instructionContent, snapshot.instructionContent);
  assert.deepEqual(restored.editorialMeta, {
    seoReady: true,
    seoUpdatedAt: oldSeoDate,
    contentUpdatedAt: restored.updatedAt,
    seoAuthor: null,
    contentAuthor: null,
  });
  assert.deepEqual(repository.getById(current.id).editorialMeta, restored.editorialMeta);
});

test('rollback restores snapshot readiness and SEO fields without replacing the current content date', t => {
  const { repository, historyRoot, current } = fixture(t);
  const snapshot = {
    ...current,
    webIntro: 'Предыдущее вводное описание',
    editorialMeta: { seoReady: false, seoUpdatedAt: snapshotDate, contentUpdatedAt: snapshotDate },
  };
  saveInstructionSnapshot(snapshot, { historyRoot });
  const restored = rollbackInstruction(current.id, { repository, historyRoot });
  assert.equal(restored.webIntro, snapshot.webIntro);
  assert.deepEqual(restored.editorialMeta, {
    seoReady: false,
    seoUpdatedAt: restored.updatedAt,
    contentUpdatedAt: oldContentDate,
    seoAuthor: null,
    contentAuthor: null,
  });
});

test('rollback of unchanged categories preserves current clocks even if snapshot clocks are older', t => {
  const { repository, historyRoot, current } = fixture(t);
  saveInstructionSnapshot(
    {
      ...current,
      version: '1.0',
      editorialMeta: {
        ...current.editorialMeta,
        seoUpdatedAt: snapshotDate,
        contentUpdatedAt: snapshotDate,
      },
    },
    { historyRoot },
  );
  const restored = rollbackInstruction(current.id, { repository, historyRoot });
  assert.deepEqual(restored.editorialMeta, current.editorialMeta);
  assert.equal(restored.revision, current.revision + 1);
});

test('rollback restores historical author credits without pretending either category was edited', t => {
  const { repository, historyRoot, current } = fixture(t);
  const historicalAuthors = { seoAuthor: 'Первый SEO-автор', contentAuthor: 'Первый автор текста' };
  saveInstructionSnapshot(
    { ...current, editorialMeta: { ...current.editorialMeta, ...historicalAuthors } },
    { historyRoot },
  );
  const restored = rollbackInstruction(current.id, { repository, historyRoot });
  assert.deepEqual(restored.editorialMeta, { ...current.editorialMeta, ...historicalAuthors });
});
