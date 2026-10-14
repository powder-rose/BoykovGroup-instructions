const STANDARD_SECTION_HEADINGS = new Map([
  [1, 'Общие требования охраны труда'],
  [2, 'Требования охраны труда перед началом работы'],
  [3, 'Требования охраны труда во время работы'],
  [4, 'Требования охраны труда в аварийных ситуациях'],
  [5, 'Требования охраны труда по окончании работы'],
]);

function normalizeLine(value = '') {
  return String(value ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/\u00ad/g, '')
    .replace(/^\s*#{1,6}\s*/, '')
    .replace(/^\s*\*{1,2}/, '')
    .replace(/\*{1,2}\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function joinParts(parts = []) {
  let result = '';

  for (const rawPart of parts) {
    const part = normalizeLine(rawPart);

    if (!part) {
      continue;
    }

    if (!result) {
      result = part;
      continue;
    }

    /*
     * Если Word разорвал слово после дефиса:
     *
     * лестницы-
     * стремянки
     *
     * получим:
     *
     * лестницы-стремянки
     */
    if (result.endsWith('-') && /^\p{Ll}/u.test(part)) {
      result += part;
    } else {
      result += ' ' + part;
    }
  }

  return result.replace(/\s+/g, ' ').trim();
}

function isServiceBoundary(line = '') {
  const normalized = normalizeLine(line).toLocaleLowerCase('ru-RU');

  return (
    /^приложение\b/u.test(normalized) ||
    /^лист\s+ознакомления\b/u.test(normalized) ||
    /^лист\s+согласования\b/u.test(normalized) ||
    /^утверждаю\b/u.test(normalized) ||
    /^согласовано\b/u.test(normalized) ||
    /^согласован\b/u.test(normalized) ||
    /^разработал\b/u.test(normalized) ||
    /^разработано\b/u.test(normalized)
  );
}

function cleanPointContent(value = '') {
  let content = normalizeLine(value)
    .replace(/^[,;:]+(?:\s+|$)/u, '')
    .trim();

  if (!content) {
    return null;
  }

  /*
   * Иногда строка для подписи приклеивается
   * extractor-ом к концу нормального пункта:
   *
   * 5.3. Нормальный текст. _______________ //
   *
   * Удаляем только хвост из длинной линии
   * подчёркиваний/дефисов и служебных слэшей.
   * Сам текст пункта не изменяем.
   */
  content = content.replace(/\s+(?:_{4,}|[-—–]{4,})(?:\s*[/\\|]{1,3})?\s*$/u, '').trim();

  if (!content) {
    return null;
  }

  /*
   * Место для подписи:
   *
   * _______________
   * __________ //
   * _____ / _____
   */
  if (/^[\s_—–\-./\\|:;,*()[\]{}]+$/u.test(content)) {
    return null;
  }

  const lower = content.toLocaleLowerCase('ru-RU').trim();

  /*
   * Подписи / даты / ФИО.
   */
  if (
    /^(?:подпись|расшифровка\s+подписи|фио|ф\.?\s*и\.?\s*о\.?|м\.?\s*п\.?)\s*[:._—–\-/\\]*\s*[_./\\—–-]*$/iu.test(
      content,
    )
  ) {
    return null;
  }

  if (/^дата\s*[:._—–\-/\\]*\s*(?:[_./\\—–-]|\d|\s)*$/iu.test(content)) {
    return null;
  }

  const normalized = lower.replace(/^[,;:._\-–—/\\|\s]+/u, '').trim();

  const requisites = [
    'инн',
    'кпп',
    'огрн',
    'огрнип',
    'бик',
    'юридический адрес',
    'фактический адрес',
    'почтовый адрес',
    'расчетный счет',
    'расчётный счёт',
    'корреспондентский счет',
    'корреспондентский счёт',
    'наименование организации',
  ];

  const hits = requisites.filter(item => normalized.includes(item));

  /*
   * Например:
   *
   * ИНН, Юридический адрес:
   */
  if (hits.length >= 2 && normalized.length < 300) {
    return null;
  }

  /*
   * Например:
   *
   * ИНН: 123456
   * КПП: 123456
   * Юридический адрес: ...
   */
  for (const requisite of requisites) {
    if (
      normalized === requisite ||
      normalized.startsWith(requisite + ':') ||
      normalized.startsWith(requisite + ' ')
    ) {
      return null;
    }
  }

  return content;
}

function createSection(number) {
  return {
    number,
    headingParts: [],
    paragraphs: [],
  };
}

export function parseImportedInstruction(sourceText = '') {
  const lines = String(sourceText ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n');

  const sections = [];
  const sectionByNumber = new Map();

  let currentSection = null;
  let currentPoint = null;
  let collectingHeading = false;
  let documentStarted = false;

  function getSection(number) {
    if (sectionByNumber.has(number)) {
      return sectionByNumber.get(number);
    }

    const section = createSection(number);

    sectionByNumber.set(number, section);

    sections.push(section);

    return section;
  }

  function flushPoint() {
    if (!currentPoint) {
      return;
    }

    const content = cleanPointContent(joinParts(currentPoint.parts));

    if (content) {
      const section = getSection(currentPoint.sectionNumber);

      section.paragraphs.push(
        `${currentPoint.sectionNumber}.` + `${currentPoint.pointNumber}. ` + content,
      );
    }

    currentPoint = null;
  }

  for (const rawLine of lines) {
    const line = normalizeLine(rawLine);

    if (!line) {
      continue;
    }

    /*
     * После основного текста приложения,
     * листы ознакомления и подписи нам
     * больше не нужны.
     */
    if (documentStarted && isServiceBoundary(line)) {
      flushPoint();
      break;
    }

    /*
     * Раздел:
     *
     * 1. ОБЩИЕ
     *
     * Важно: (?!\d) отличает его от 1.1.
     */
    const sectionMatch = line.match(/^([1-9]\d*)\.(?!\d)\s*(.*)$/u);

    if (sectionMatch) {
      flushPoint();

      const sectionNumber = Number.parseInt(sectionMatch[1], 10);

      currentSection = getSection(sectionNumber);

      currentSection.headingParts = [];

      const firstHeadingPart = normalizeLine(sectionMatch[2]);

      if (firstHeadingPart) {
        currentSection.headingParts.push(firstHeadingPart);
      }

      collectingHeading = true;
      documentStarted = true;

      continue;
    }

    /*
     * Пункт:
     *
     * 1.1. Текст
     * 1.1 Текст
     */
    const pointMatch = line.match(/^(\d+)\.(\d+)\.?\s*(.*)$/u);

    if (pointMatch) {
      flushPoint();

      const sectionNumber = Number.parseInt(pointMatch[1], 10);

      const pointNumber = Number.parseInt(pointMatch[2], 10);

      currentSection = getSection(sectionNumber);

      currentPoint = {
        sectionNumber,
        pointNumber,
        parts: [pointMatch[3]],
      };

      collectingHeading = false;
      documentStarted = true;

      continue;
    }

    /*
     * Всё до первого настоящего раздела/пункта
     * считаем титульной частью документа.
     */
    if (!documentStarted) {
      continue;
    }

    /*
     * Продолжение заголовка:
     *
     * 1. ОБЩИЕ
     * ТРЕБОВАНИЯ ОХРАНЫ ТРУДА
     */
    if (currentSection && collectingHeading && !currentPoint) {
      currentSection.headingParts.push(line);

      continue;
    }

    /*
     * Продолжение существующего пункта.
     *
     * Здесь ничего не генерируем —
     * просто склеиваем перенос Word/PDF.
     */
    if (currentPoint) {
      currentPoint.parts.push(line);
    }
  }

  flushPoint();

  const resultSections = sections
    .filter(section => section.paragraphs.length > 0)
    .map(section => {
      const standardHeading = STANDARD_SECTION_HEADINGS.get(section.number);

      const extractedHeading = joinParts(section.headingParts)
        .replace(/^\d+\.\s*/, '')
        .trim();

      return {
        number: section.number,

        /*
         * Для стандартных разделов 1–5
         * используем единое оформление.
         * Это не генерация содержания.
         */
        heading: standardHeading || extractedHeading,

        paragraphs: section.paragraphs,
      };
    });

  return {
    sections: resultSections,
  };
}
