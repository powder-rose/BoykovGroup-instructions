import { useEffect, useId, useRef, useState } from 'react';
import { nextTagOptionIndex, searchCatalogTags } from './catalogTagSearch.js';
import styles from './CatalogTaxonomyFilters.module.css';

export default function CatalogOptionPicker({
  options,
  selectedId,
  onChange,
  disabled = false,
  label,
  placeholder,
  clearLabel,
  showLabel,
  hideLabel,
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const inputId = useId();
  const listId = useId();
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const rootRef = useRef(null);
  const selected = options.find(item => item.id === selectedId);
  const matches = searchCatalogTags(options, query);
  const activeOption = open && highlighted >= 0 ? matches[highlighted] : null;

  useEffect(() => {
    if (!open) return undefined;

    function closeOnOutsidePress(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery('');
        setHighlighted(-1);
      }
    }

    document.addEventListener('pointerdown', closeOnOutsidePress);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePress);
  }, [open]);

  useEffect(() => {
    if (open && highlighted >= 0) {
      listRef.current?.children[highlighted]?.scrollIntoView({ block: 'nearest' });
    }
  }, [open, highlighted]);

  function close() {
    setOpen(false);
    setQuery('');
    setHighlighted(-1);
  }

  function choose(option) {
    onChange(option.id);
    close();
  }

  function handleKeyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      if (!open) {
        setQuery('');
        setOpen(true);
        setHighlighted(nextTagOptionIndex(-1, options.length, direction));
      } else {
        setHighlighted(index => nextTagOptionIndex(index, matches.length, direction));
      }
      return;
    }

    if (event.key === 'Enter' && open) {
      const option = activeOption || (matches.length === 1 ? matches[0] : null);
      if (option) {
        event.preventDefault();
        choose(option);
      }
    }
  }

  function toggleOptions() {
    if (open) {
      close();
      return;
    }
    inputRef.current?.focus();
    setQuery('');
    setHighlighted(-1);
    setOpen(true);
  }

  return (
    <div className={styles.field}>
      <label htmlFor={inputId}>{label}</label>
      <div
        className={styles.tagPicker}
        ref={rootRef}
        onKeyDown={event => {
          if (event.key === 'Tab') close();
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            close();
          }
        }}
      >
        <div className={styles.tagInputWrap}>
          <input
            id={inputId}
            ref={inputRef}
            className={
              selectedId ? `${styles.tagInput} ${styles.tagInputSelected}` : styles.tagInput
            }
            type="text"
            disabled={disabled}
            role="combobox"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={activeOption ? `${listId}-${activeOption.id}` : undefined}
            aria-haspopup="listbox"
            placeholder={placeholder}
            value={open ? query : (selected?.label ?? '')}
            onFocus={event => {
              setQuery(selected?.label ?? '');
              setHighlighted(-1);
              setOpen(true);
              event.currentTarget.select();
            }}
            onChange={event => {
              setQuery(event.target.value);
              setHighlighted(-1);
              setOpen(true);
            }}
            onKeyDown={handleKeyDown}
          />
          <div className={styles.tagActions}>
            {selectedId && (
              <button
                type="button"
                className={styles.tagAction}
                aria-label={clearLabel}
                disabled={disabled}
                onClick={() => {
                  onChange('');
                  close();
                }}
              >
                ×
              </button>
            )}
            <button
              type="button"
              className={styles.tagAction}
              aria-label={open ? hideLabel : showLabel}
              disabled={disabled}
              aria-expanded={open}
              aria-controls={listId}
              onClick={toggleOptions}
            >
              <span className={styles.tagChevron} aria-hidden="true" />
            </button>
          </div>
        </div>
        {open && (
          <ul className={styles.tagOptions} id={listId} ref={listRef} role="listbox">
            {matches.length ? (
              matches.map((item, index) => (
                <li
                  id={`${listId}-${item.id}`}
                  key={item.id}
                  role="option"
                  aria-selected={item.id === selectedId}
                  className={styles.tagOption}
                  data-active={index === highlighted}
                  onClick={() => choose(item)}
                >
                  <span>{item.label}</span>
                  <span className={styles.tagCount}>{item.count}</span>
                </li>
              ))
            ) : (
              <li className={styles.tagEmpty} role="presentation">
                Ничего не найдено
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
