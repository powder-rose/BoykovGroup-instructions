import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';

import InstructionStickyHeader from '../InstructionStickyHeader/InstructionStickyHeader.jsx';
import Breadcrumbs from '../Breadcrumbs/Breadcrumbs.jsx';
import RelatedInstructions from '../RelatedInstructions/RelatedInstructions.jsx';
import InstructionPdfDownload from '../InstructionPdfDownload/InstructionPdfDownload.jsx';
import RichTextContent from '../RichTextContent/RichTextContent.jsx';
import InstructionCopyGuard from '../InstructionCopyGuard/InstructionCopyGuard.jsx';
import InstructionArticleMeta from './InstructionArticleMeta.jsx';
import InstructionTaxonomy from './InstructionTaxonomy.jsx';
import InstructionTableOfContents from './InstructionTableOfContents.jsx';
import InstructionSeo from './InstructionSeo.jsx';
import useInstructionPage from './hooks/useInstructionPage.js';
import {
  getInstructionDocument,
  getInstructionOutline,
} from '../../../../server/src/shared/instructionDocument.js';

import styles from './InstructionPage.module.css';

const EditInstructionModal = lazy(() => import('../EditInstructionModal/EditInstructionModal.jsx'));

export default function InstructionPage() {
  const {
    instruction,
    relatedInstructions,
    loading,
    error,
    notFound,
    retryLoad,
    editOpen,
    setEditOpen,
    isAdmin,
    viewStats,
    applyPublishedInstruction,
  } = useInstructionPage();
  const instructionDocument = instruction ? getInstructionDocument(instruction) : null;
  const outline = instructionDocument ? getInstructionOutline(instructionDocument) : [];

  return (
    <div className={styles.page}>
      <InstructionSeo
        instruction={instruction}
        noindex={Boolean(
          notFound ||
          error ||
          ['draft', 'noindex'].includes(String(instruction?.seoStatus || '').toLowerCase()),
        )}
      />
      <InstructionStickyHeader />

      <main className={styles.content}>
        <Link to="/instrukcii-po-ohrane-truda" className={styles.back}>
          ← Все инструкции
        </Link>

        {loading && <p role="status">Загрузка инструкции…</p>}

        {notFound && (
          <div className={styles.state}>
            <h1>Инструкция не найдена</h1>
            <p>Возможно, она ещё не опубликована или была удалена.</p>
            <Link to="/instrukcii-po-ohrane-truda">Перейти к каталогу инструкций</Link>
          </div>
        )}

        {error && (
          <div className={styles.state} role="alert">
            <h1>Не удалось загрузить инструкцию</h1>
            <p>Проверьте соединение и попробуйте ещё раз.</p>
            <button type="button" onClick={retryLoad}>
              Повторить загрузку
            </button>
          </div>
        )}

        {instruction && (
          <article>
            <Breadcrumbs instruction={instruction} />
            <InstructionCopyGuard allowCopy={isAdmin}>
              <h1 className={styles.title}>{instruction.title}</h1>
              <InstructionTaxonomy
                taxonomy={instruction.taxonomyDisplay}
                navigation={instruction.taxonomyNavigation}
              />
              {instruction.webIntro && <p className={styles.intro}>{instruction.webIntro}</p>}
            </InstructionCopyGuard>

            <div className={styles.instructionDocument}>
              <div className={styles.documentToolbar}>
                <InstructionArticleMeta
                  instruction={instruction}
                  isAdmin={isAdmin}
                  viewStats={viewStats}
                  onEdit={() => setEditOpen(true)}
                />
                <div className={styles.documentDownload}>
                  <InstructionPdfDownload instructionId={instruction.id} />
                </div>
              </div>
              <InstructionCopyGuard allowCopy={isAdmin}>
                <InstructionTableOfContents items={outline} />
                <RichTextContent
                  content={instructionDocument}
                  headingIdPrefix="instruction-section"
                />
              </InstructionCopyGuard>
            </div>

            {instruction.explanationContent && (
              <InstructionCopyGuard
                as="section"
                allowCopy={isAdmin}
                className={styles.explanation}
                aria-label="Пояснения к инструкции"
              >
                <RichTextContent content={instruction.explanationContent} />
              </InstructionCopyGuard>
            )}

            <RelatedInstructions currentId={instruction.id} instructions={relatedInstructions} />
          </article>
        )}
      </main>

      {editOpen && instruction && (
        <Suspense
          fallback={
            <p className={styles.editorLoading} role="status">
              Загрузка редактора…
            </p>
          }
        >
          <EditInstructionModal
            instruction={instruction}
            onClose={() => setEditOpen(false)}
            onSaved={applyPublishedInstruction}
          />
        </Suspense>
      )}
    </div>
  );
}
