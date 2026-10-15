import { useEffect, useReducer } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { TableKit } from '@tiptap/extension-table';

import RichTextEditorToolbar from './RichTextEditorToolbar.jsx';
import './RichTextEditor.css';

export default function RichTextEditor({
  value,
  onChange,
  disabled = false,
  label = 'Текст инструкции',
}) {
  const [, redraw] = useReducer(current => current + 1, 0);
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
    ],
    content: value,
    editable: !disabled,
    editorProps: { attributes: { 'aria-label': label, role: 'textbox', 'aria-multiline': 'true' } },
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

  if (!editor) return null;
  return (
    <div className="rich-text-editor-shell">
      <RichTextEditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
