import { Fragment, useId } from 'react';

import InstructionPdfDownload from '../InstructionPdfDownload/InstructionPdfDownload.jsx';

import styles from './ArticleContent.module.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function safeHref(value) {
  if (typeof value !== 'string' || value !== value.trim() || /\s|\\/.test(value)) {
    return null;
  }

  if (/^(?:https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(value)) {
    return value;
  }

  return null;
}

function renderText(node, key) {
  let result = typeof node.text === 'string' ? node.text : '';

  for (const mark of Array.isArray(node.marks) ? node.marks : []) {
    switch (mark.type) {
      case 'bold':
        result = <strong>{result}</strong>;
        break;
      case 'italic':
        result = <em>{result}</em>;
        break;
      case 'strike':
        result = <s>{result}</s>;
        break;
      case 'underline':
        result = <u>{result}</u>;
        break;
      case 'code':
        result = <code>{result}</code>;
        break;
      case 'link': {
        const href = safeHref(mark.attrs?.href);
        const target = ['_blank', '_self'].includes(mark.attrs?.target)
          ? mark.attrs.target
          : undefined;
        const title = typeof mark.attrs?.title === 'string' ? mark.attrs.title : undefined;

        if (href) {
          result = (
            <a href={href} target={target} title={title} rel="noopener noreferrer">
              {result}
            </a>
          );
        }

        break;
      }
      default:
        break;
    }
  }

  return <Fragment key={key}>{result}</Fragment>;
}

function tableSpan(value) {
  return Number.isInteger(value) && value > 0 && value <= 100 ? value : 1;
}

function InstructionBlock({ attrs, slug, preview, nodeKey }) {
  const title = typeof attrs?.title === 'string' ? attrs.title : 'Инструкция';
  const text = typeof attrs?.text === 'string' ? attrs.text : '';
  const instructionId = typeof attrs?.id === 'string' ? attrs.id : '';
  const titleId = `article-instruction-${nodeKey}-title`;

  return (
    <section className={styles.instruction} aria-labelledby={titleId}>
      <div className={styles.instructionHeading}>
        <span className={styles.instructionLabel}>Инструкция</span>
        <h2 id={titleId}>{title}</h2>
      </div>

      <div className={styles.instructionText}>{text}</div>

      <div className={styles.instructionDownload}>
        {preview ? (
          <>
            <button className={styles.previewButton} type="button" disabled>
              Скачать PDF
            </button>
            <p>После публикации скачивание доступно зарегистрированным пользователям.</p>
          </>
        ) : (
          <>
            <InstructionPdfDownload
              id={`article-instruction-${nodeKey}-download`}
              instructionId={instructionId}
              downloadUrl={`${API_BASE_URL}/api/articles/${encodeURIComponent(slug)}/instructions/${encodeURIComponent(instructionId)}/pdf`}
            />
            <p>Для скачивания войдите в аккаунт с подтверждённым e-mail.</p>
          </>
        )}
      </div>
    </section>
  );
}

function renderNode(node, key, context, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 30) {
    return null;
  }

  if (node.type === 'text') {
    return renderText(node, key);
  }

  if (node.type === 'instruction') {
    return <InstructionBlock key={key} nodeKey={key} attrs={node.attrs} {...context} />;
  }

  const children = (Array.isArray(node.content) ? node.content : []).map((child, index) =>
    renderNode(child, `${key}-${index}`, context, depth + 1),
  );

  switch (node.type) {
    case 'doc':
      return <Fragment key={key}>{children}</Fragment>;
    case 'paragraph':
      return <p key={key}>{children.length ? children : <br />}</p>;
    case 'heading':
      return node.attrs?.level === 3 ? (
        <h3 key={key}>{children}</h3>
      ) : (
        <h2 key={key}>{children}</h2>
      );
    case 'bulletList':
      return <ul key={key}>{children}</ul>;
    case 'orderedList':
      return (
        <ol key={key} start={Number.isInteger(node.attrs?.start) ? node.attrs.start : 1}>
          {children}
        </ol>
      );
    case 'listItem':
      return <li key={key}>{children}</li>;
    case 'blockquote':
      return <blockquote key={key}>{children}</blockquote>;
    case 'hardBreak':
      return <br key={key} />;
    case 'horizontalRule':
      return <hr key={key} />;
    case 'table':
      return (
        <div key={key} className={styles.tableScroll}>
          <table>
            <tbody>{children}</tbody>
          </table>
        </div>
      );
    case 'tableRow':
      return <tr key={key}>{children}</tr>;
    case 'tableCell':
      return (
        <td
          key={key}
          colSpan={tableSpan(node.attrs?.colspan)}
          rowSpan={tableSpan(node.attrs?.rowspan)}
        >
          {children}
        </td>
      );
    case 'tableHeader':
      return (
        <th
          key={key}
          colSpan={tableSpan(node.attrs?.colspan)}
          rowSpan={tableSpan(node.attrs?.rowspan)}
        >
          {children}
        </th>
      );
    default:
      return null;
  }
}

export default function ArticleContent({ content, slug = '', preview = false }) {
  const contentId = useId();

  return <div className={styles.content}>{renderNode(content, contentId, { slug, preview })}</div>;
}
