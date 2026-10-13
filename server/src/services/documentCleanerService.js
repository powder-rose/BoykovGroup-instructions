import { getImportedProfessionFromFilename } from './importedProfessionAliasService.js';
import { PROFESSION_GENITIVE_OVERRIDES } from '../data/professionGenitiveOverrides.js';

const REMOVE_PATTERNS = [
  /name_full/gi,
  /inndoc/gi,
  /uridicheskiy_adress/gi,
  /date_doc/gi,
  /obj_name/gi,
  /address_object/gi,
  /dolzn_shortcompname/gi,
  /podpisant_ot/gi,
  /NMBP/gi,
  /AUTOZAMENA[_\w]*/gi,
  /autozamena[_\w]*/gi,
];

export function cleanDocumentText(text = '') {
  let cleaned = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\u00a0/g, ' ');

  for (const pattern of REMOVE_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }

  /*
   * Удаляем только конкретные служебные строки.
   * Не удаляем произвольные 100-300 символов
   * после реквизита.
   */
  cleaned = cleaned
    .split('\n')
    .filter(line => {
      const value = line.trim();

      return !(
        /^УТВЕРЖДАЮ\b/i.test(value) ||
        /^СОГЛАСОВАНО\b/i.test(value) ||
        /^Номер документа\b/i.test(value) ||
        /^Дата составления\b/i.test(value)
      );
    })
    .join('\n');

  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  return cleaned.trim();
}

export function normalizeProfession(filename, text = '') {
  /*
   * Сначала пытаемся определить профессию
   * из полного имени импортируемого файла.
   *
   * Это защищает длинные профессии:
   *
   * автослесарь -> НЕ слесарь
   * автомаляр   -> НЕ маляр
   * водитель электропогрузчика -> НЕ водитель
   */
  const importedProfession = getImportedProfessionFromFilename(filename);

  if (importedProfession) {
    return importedProfession;
  }

  const source = (filename + ' ' + text.substring(0, 1000)).toLowerCase();

  const professions = [
    'сварщик',
    'электромонтер',
    'электромонтер по ремонту и обслуживанию электрооборудования',
    'автомаляр',
    'маляр',
    'бетонщик',
    'автослесарь',
    'слесарь',
    'водитель',
    'плотник',
    'администратор данных',
    'повар',
    'стропальщик',
  ];

  const matchedProfession = professions
    .filter(profession => source.includes(profession))
    .sort((a, b) => b.length - a.length)[0];

  if (matchedProfession) {
    return matchedProfession;
  }

  return filename

    .replace(/\.[^/.]+$/, '')

    .replace(/_/g, ' ')

    .replace(/иот/gi, '')

    .trim();
}

export function buildInstructionTitle(profession) {
  const rawProfession = String(profession ?? '')
    .trim()
    .replace(/\s+/g, ' ');

  const alreadyAfterDlya = /^(?:для\s+)+/iu.test(rawProfession);

  const normalizedProfession = rawProfession.replace(/^(?:для\s+)+/iu, '').trim();

  /*
   * Если получили:
   *
   *   "для автомеханика"
   *
   * значит форма "автомеханика" уже готова.
   * Повторно склонять её нельзя.
   */
  if (alreadyAfterDlya) {
    return 'Инструкция по охране труда для ' + normalizedProfession;
  }

  /*
   * Для известных профессий используем
   * только точный словарь.
   *
   * Никакой общей эвристики для импортов.
   */
  const lower = normalizedProfession.toLocaleLowerCase('ru-RU');

  let titleProfession = normalizedProfession;

  for (const [key, value] of Object.entries(PROFESSION_GENITIVE_OVERRIDES)) {
    if (key.toLocaleLowerCase('ru-RU') === lower) {
      titleProfession = value;
      break;
    }
  }

  return 'Инструкция по охране труда для ' + titleProfession;
}
