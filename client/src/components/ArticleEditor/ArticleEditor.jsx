import { useEffect, useReducer, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { TableKit } from '@tiptap/extension-table';

import { InstructionNode } from './InstructionNode.jsx';
import InstructionDialog from './InstructionDialog.jsx';
import ArticleEditorToolbar from './ArticleEditorToolbar.jsx';
import './ArticleEditor.css';

export default function ArticleEditor({ value, onChange, disabled = false }) {
  const [, redraw] = useReducer(current => current + 1, 0);
  const [instructionDialog, setInstructionDialog] = useState(null);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: false,
        link: false,
        underline: false,
      }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      Underline,
      TableKit.configure({ table: { resizable: false } }),
      InstructionNode.configure({
        onEditInstruction: (instruction, position) =>
          setInstructionDialog({ instruction, position }),
      }),
    ],
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: { 'aria-label': 'Текст статьи', role: 'textbox', 'aria-multiline': 'true' },
    },
    onTransaction: redraw,
    onUpdate: ({ editor: current }) => onChange(current.getJSON()),
  });

  useEffect(() => {
    editor?.setEditable(!disabled, false);
  }, [editor, disabled]);

  useEffect(() => {
    if (editor && JSON.stringify(value) !== JSON.stringify(editor.getJSON())) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  function saveInstruction(fields) {
    const { instruction, position } = instructionDialog;
    if (instruction) {
      const node = editor.state.doc.nodeAt(position);
      if (!node || node.type.name !== 'instruction' || node.attrs.id !== instruction.id) {
        window.alert('Блок изменился. Откройте его редактирование повторно.');
        setInstructionDialog(null);
        return;
      }
      editor
        .chain()
        .focus()
        .command(({ tr }) => {
          tr.setNodeMarkup(position, undefined, { ...instruction, ...fields });
          return true;
        })
        .run();
    } else {
      editor
        .chain()
        .focus()
        .setTextSelection(position)
        .insertContent([
          { type: 'instruction', attrs: { id: crypto.randomUUID(), ...fields } },
          { type: 'paragraph' },
        ])
        .run();
    }
    setInstructionDialog(null);
  }

  if (!editor) return null;

  return (
    <div className="article-editor-shell">
      <ArticleEditorToolbar
        editor={editor}
        onInsertInstruction={() => setInstructionDialog({ position: editor.state.selection.from })}
      />
      <EditorContent editor={editor} />
      <p className="article-editor-hint">
        Пишите статью и вставляйте инструкции в нужное место. После инструкции можно продолжить
        текст.
      </p>
      {instructionDialog && (
        <InstructionDialog
          instruction={instructionDialog.instruction}
          onCancel={() => setInstructionDialog(null)}
          onSave={saveInstruction}
        />
      )}
    </div>
  );
}
