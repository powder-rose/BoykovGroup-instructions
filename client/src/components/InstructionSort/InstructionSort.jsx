import styles from './InstructionSort.module.css';

function getCurrentMode() {
  const params = new URLSearchParams(window.location.search);

  return params.get('sort') === 'popular' ? 'popular' : 'newest';
}

export default function InstructionSort({ compact = false }) {
  const currentMode = getCurrentMode();

  function chooseMode(mode) {
    if (mode === currentMode) {
      return;
    }

    const url = new URL(window.location.href);

    if (mode === 'popular') {
      url.searchParams.set('sort', 'popular');
    } else {
      url.searchParams.delete('sort');
    }
    url.searchParams.delete('page');

    window.location.assign(url.pathname + url.search + url.hash);
  }

  return (
    <div
      className={compact ? styles.compact : styles.root}
      role="group"
      aria-label="Сортировка инструкций"
    >
      <div className={styles.buttons}>
        <button
          type="button"
          className={[styles.button, currentMode === 'newest' ? styles.active : '']
            .filter(Boolean)
            .join(' ')}
          aria-pressed={currentMode === 'newest'}
          onClick={() => chooseMode('newest')}
        >
          Сначала новые
        </button>

        <button
          type="button"
          className={[styles.button, currentMode === 'popular' ? styles.active : '']
            .filter(Boolean)
            .join(' ')}
          aria-pressed={currentMode === 'popular'}
          onClick={() => chooseMode('popular')}
        >
          Популярные
        </button>
      </div>
    </div>
  );
}
