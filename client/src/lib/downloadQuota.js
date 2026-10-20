const instructionPluralRules = new Intl.PluralRules('ru');

export function parseDownloadQuota(value) {
  const { limit, remaining } = value ?? {};
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    !Number.isInteger(remaining) ||
    remaining < 0 ||
    remaining > limit
  ) {
    return null;
  }
  return { limit, remaining };
}

export function downloadQuotaFromHeaders(headers) {
  const limit = headers.get('X-Download-Limit');
  const remaining = headers.get('X-Download-Remaining');
  if (!/^\d+$/.test(limit ?? '') || !/^\d+$/.test(remaining ?? '')) return null;
  return parseDownloadQuota({ limit: Number(limit), remaining: Number(remaining) });
}

export function formatAvailableInstructions(remaining) {
  const forms = {
    one: ['доступна', 'инструкция'],
    few: ['доступны', 'инструкции'],
    many: ['доступно', 'инструкций'],
  };
  const [available, instruction] = forms[instructionPluralRules.select(remaining)] ?? forms.many;
  return `Вам ${available} ${remaining} ${instruction} в текущем периоде`;
}
