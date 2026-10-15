export default function RichTextEditorToolbar({ editor }) {
  function editLink() {
    if (editor.state.selection.empty && !editor.isActive('link')) {
      window.alert('Сначала выделите текст для ссылки.');
      return;
    }
    const href = window.prompt(
      'Адрес ссылки (оставьте пустым, чтобы удалить)',
      editor.getAttributes('link').href || '',
    );
    if (href === null) return;
    if (!href.trim()) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    if (!/^(?:https?:\/\/|mailto:|tel:|\/(?!\/)|#)/i.test(href.trim())) {
      window.alert('Используйте https://, http://, mailto:, tel: или внутренний адрес /…');
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run();
  }

  const buttons = [
    {
      label: 'B',
      title: 'Полужирный',
      active: editor.isActive('bold'),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: 'I',
      title: 'Курсив',
      active: editor.isActive('italic'),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: 'U',
      title: 'Подчёркнутый',
      active: editor.isActive('underline'),
      run: () => editor.chain().focus().toggleUnderline().run(),
    },
    {
      label: 'H2',
      title: 'Заголовок второго уровня',
      active: editor.isActive('heading', { level: 2 }),
      run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: 'H3',
      title: 'Заголовок третьего уровня',
      active: editor.isActive('heading', { level: 3 }),
      run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      label: '• Список',
      title: 'Маркированный список',
      active: editor.isActive('bulletList'),
      run: () => editor.chain().focus().toggleBulletList().run(),
    },
    {
      label: '1. Список',
      title: 'Нумерованный список',
      active: editor.isActive('orderedList'),
      run: () => editor.chain().focus().toggleOrderedList().run(),
    },
    {
      label: 'Ссылка',
      title: 'Добавить или изменить ссылку',
      active: editor.isActive('link'),
      run: editLink,
    },
    {
      label: 'Врезка',
      title: 'Выделенный блок',
      active: editor.isActive('blockquote'),
      run: () => editor.chain().focus().toggleBlockquote().run(),
    },
    {
      label: 'Таблица',
      title: 'Вставить таблицу 3 × 3',
      active: editor.isActive('table'),
      run: () =>
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      label: 'Tx',
      title: 'Очистить форматирование',
      run: () => editor.chain().focus().clearNodes().unsetAllMarks().run(),
    },
    {
      label: '↶',
      title: 'Отменить',
      disabled: !editor.can().undo(),
      run: () => editor.chain().focus().undo().run(),
    },
    {
      label: '↷',
      title: 'Повторить',
      disabled: !editor.can().redo(),
      run: () => editor.chain().focus().redo().run(),
    },
  ];

  return (
    <div
      className="rich-text-editor-toolbar"
      role="toolbar"
      aria-label="Оформление текста"
      onMouseDown={event => {
        // Keep the editor selection while a formatting button receives a click.
        if (event.button === 0 && event.target.closest('button')) event.preventDefault();
      }}
    >
      {buttons.map(button => (
        <button
          key={button.title}
          type="button"
          title={button.title}
          aria-label={button.title}
          aria-pressed={button.active}
          disabled={button.disabled || !editor.isEditable}
          className={button.active ? 'is-active' : ''}
          onClick={button.run}
        >
          {button.label}
        </button>
      ))}
      {editor.isActive('table') && (
        <div className="rich-text-editor-toolbar__table">
          <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()}>
            + строка
          </button>
          <button type="button" onClick={() => editor.chain().focus().deleteRow().run()}>
            − строка
          </button>
          <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()}>
            + столбец
          </button>
          <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()}>
            − столбец
          </button>
          <button type="button" onClick={() => editor.chain().focus().deleteTable().run()}>
            Удалить таблицу
          </button>
        </div>
      )}
    </div>
  );
}
