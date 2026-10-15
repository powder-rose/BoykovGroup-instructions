import { Node, mergeAttributes } from '@tiptap/core';
import { NodeViewWrapper, ReactNodeViewRenderer } from '@tiptap/react';
import { Fragment, Slice } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';

function copyInstructionIds(fragment) {
  const nodes = [];
  fragment.forEach(node => {
    if (node.isText) {
      nodes.push(node);
      return;
    }
    nodes.push(
      node.type.create(
        node.type.name === 'instruction' ? { ...node.attrs, id: crypto.randomUUID() } : node.attrs,
        copyInstructionIds(node.content),
        node.marks,
      ),
    );
  });
  return Fragment.fromArray(nodes);
}

function InstructionNodeView({ node, editor, getPos, deleteNode, extension, selected }) {
  return (
    <NodeViewWrapper
      className={`article-editor-instruction${selected ? ' is-selected' : ''}`}
      contentEditable={false}
    >
      <div className="article-editor-instruction__head">
        <span>Инструкция</span>
        {editor.isEditable && (
          <div className="article-editor-instruction__actions">
            <button
              type="button"
              onClick={() => extension.options.onEditInstruction(node.attrs, getPos())}
            >
              Изменить инструкцию
            </button>
            <button type="button" onClick={deleteNode} aria-label="Удалить блок инструкции">
              Удалить
            </button>
          </div>
        )}
      </div>
      <h3>{node.attrs.title}</h3>
      <div className="article-editor-instruction__text">{node.attrs.text}</div>
      <div className="article-editor-instruction__download">
        Скачать инструкцию в PDF
        <small>На сайте скачивание доступно зарегистрированным пользователям.</small>
      </div>
    </NodeViewWrapper>
  );
}

export const InstructionNode = Node.create({
  name: 'instruction',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addOptions() {
    return { onEditInstruction: () => {} };
  },

  addAttributes() {
    return {
      id: { default: null },
      title: { default: '' },
      text: { default: '' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'section[data-article-instruction]',
        getAttrs: element => ({
          id: element.getAttribute('data-instruction-id'),
          title: element.getAttribute('data-instruction-title') || '',
          text: element.getAttribute('data-instruction-text') || '',
        }),
      },
    ];
  },

  renderHTML({ node }) {
    return [
      'section',
      mergeAttributes({
        'data-article-instruction': '',
        'data-instruction-id': node.attrs.id,
        'data-instruction-title': node.attrs.title,
        'data-instruction-text': node.attrs.text,
      }),
      ['h3', {}, node.attrs.title],
      ['p', {}, node.attrs.text],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(InstructionNodeView);
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          transformPasted: slice =>
            new Slice(copyInstructionIds(slice.content), slice.openStart, slice.openEnd),
        },
      }),
    ];
  },
});
