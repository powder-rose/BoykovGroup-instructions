const dateFormatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Moscow',
});

export function quotaScheduleCopy(value) {
  const { limit, used, remaining, nextResetAt } = value ?? {};
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    !Number.isInteger(used) ||
    used < 0 ||
    used > limit ||
    !Number.isInteger(remaining) ||
    remaining !== limit - used ||
    (used === 0 && nextResetAt !== null) ||
    (used > 0 && (typeof nextResetAt !== 'string' || !Number.isFinite(Date.parse(nextResetAt))))
  ) {
    return null;
  }

  if (used === 0) {
    return {
      title: `Доступно ${limit} из ${limit}`,
      description: 'Месячный срок начнётся после первого бесплатного скачивания.',
    };
  }

  const date = `${dateFormatter.format(new Date(nextResetAt))} (МСК)`;
  if (remaining === 0) {
    return {
      title: 'Бесплатный лимит исчерпан',
      description: `Новые ${limit} бесплатных скачиваний будут доступны ${date}. До этого инструкции можно покупать с баланса.`,
    };
  }
  return {
    title: `Осталось ${remaining} из ${limit}`,
    description: `Следующее обновление лимита — ${date}. После каждого бесплатного скачивания дата сдвигается на месяц.`,
  };
}
