export const COMPANY_PROFILE_FIELDS = Object.freeze([
  { name: 'companyName', label: 'Название компании', maxLength: 300 },
  { name: 'inn', label: 'ИНН', maxLength: 12 },
  { name: 'headFullName', label: 'ФИО руководителя организации', maxLength: 200 },
  {
    name: 'occupationalSafetyPosition',
    label: 'Должность ответственного по охране труда',
    maxLength: 200,
  },
  {
    name: 'occupationalSafetyFullName',
    label: 'ФИО ответственного по охране труда',
    maxLength: 200,
  },
]);

export const EMPTY_COMPANY_PROFILE = Object.freeze(
  Object.fromEntries(COMPANY_PROFILE_FIELDS.map(({ name }) => [name, ''])),
);

function invalidField(message, field) {
  const error = new Error(message);
  error.code = 'VALIDATION_ERROR';
  error.field = field;
  return error;
}

export function normalizeCompanyProfile(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw invalidField('Укажите данные компании');
  }

  const profile = {};

  for (const { name, label, maxLength } of COMPANY_PROFILE_FIELDS) {
    const value = Object.hasOwn(input, name) ? input[name] : '';

    if (typeof value !== 'string') {
      throw invalidField(`Поле «${label}» должно содержать текст`, name);
    }
    // Exclude control characters, including invisible direction overrides, from PDFs and mail.
    if (/[\p{Cc}\p{Cf}]/u.test(value)) {
      throw invalidField(`Поле «${label}» содержит недопустимые символы`, name);
    }
    if (value.length > maxLength) {
      throw invalidField(`Поле «${label}»: не более ${maxLength} символов`, name);
    }

    profile[name] = value.trim().replace(/\s+/gu, ' ');
  }

  if (profile.inn && !/^(?:\d{10}|\d{12})$/u.test(profile.inn)) {
    throw invalidField('ИНН должен содержать 10 или 12 цифр', 'inn');
  }

  return profile;
}
