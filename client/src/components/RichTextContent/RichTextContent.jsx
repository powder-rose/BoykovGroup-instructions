import { Fragment, useId } from 'react';

import styles from './RichTextContent.module.css';

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

function renderNode(node, key, context, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 30) {
    return null;
  }

  if (node.type === 'text') {
    return renderText(node, key);
  }

  const headingId =
    node.type === 'heading' && context.headingIdPrefix
      ? `${context.headingIdPrefix}-${++context.headingNumber}`
      : undefined;

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
        <h3 key={key} id={headingId}>
          {children}
        </h3>
      ) : (
        <h2 key={key} id={headingId}>
          {children}
        </h2>
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

export default function RichTextContent({ content, headingIdPrefix = '' }) {
  const contentId = useId();

  return (
    <div className={styles.content}>
      {renderNode(content, contentId, { headingIdPrefix, headingNumber: 0 })}
    </div>
  );
}
