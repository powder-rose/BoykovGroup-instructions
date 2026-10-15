const BODY_SIZE = 10;
const LINE_GAP = 2;
const BLOCK_GAP = 18;
const SIGNATURE_WIDTH = 72;
const SIGNATURE_GAP = 10;

function text(value) {
  return typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : '';
}

function font(document, fonts, bold = false, size = BODY_SIZE) {
  return document
    .font(bold ? fonts.boldFont : fonts.regularFont)
    .fontSize(size)
    .fillColor('#172033');
}

function measure(document, value, width, fonts, bold = false, size = BODY_SIZE) {
  font(document, fonts, bold, size);
  return document.heightOfString(value || 'М', { width, lineGap: LINE_GAP });
}

function pageSpace(document, height) {
  const bottom = document.page.height - document.page.margins.bottom;
  if (document.y + height > bottom) document.addPage();
}

function rule(document, x, y, width) {
  document.save().lineWidth(0.5).strokeColor('#172033');
  document
    .moveTo(x, y)
    .lineTo(x + width, y)
    .stroke();
  document.restore();
}

function field(
  document,
  value,
  x,
  y,
  width,
  fonts,
  { align = 'left', bold = false, size = BODY_SIZE } = {},
) {
  const height = measure(document, value, width, fonts, bold, size);
  if (value) {
    document.text(value, x, y, { width, align, lineGap: LINE_GAP });
  } else {
    const lineWidth = Math.min(width, 260);
    rule(document, align === 'center' ? x + (width - lineWidth) / 2 : x, y + size, lineWidth);
  }
  return height;
}

export function formatInstructionDownloadDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('Некорректная дата скачивания PDF');
  const parts = new Intl.DateTimeFormat('ru-RU', {
    timeZone: 'Europe/Moscow',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);
  const part = type => parts.find(item => item.type === type)?.value;
  return `${part('day')}.${part('month')}.${part('year')}`;
}

export function renderInstructionCompanyHeader(document, profile, downloadedAt, fonts) {
  const left = document.page.margins.left;
  const width = document.page.width - left - document.page.margins.right;
  const company = text(profile?.companyName);
  const inn = text(profile?.inn);
  const companyLine = `${company || '__________________'}, ИНН ${inn || '__________________'}`;
  const companyHeight = measure(document, companyLine, width, fonts, true, 11);
  pageSpace(document, companyHeight);
  let y = document.y;
  y += field(document, companyLine, left, y, width, fonts, {
    align: 'center',
    bold: true,
    size: 11,
  });
  document.x = left;
  document.y = y + BLOCK_GAP;

  const fullName = text(profile?.headFullName);
  const position = text(profile?.headPosition);
  const approvalWidth = width / 2;
  const approvalLeft = left + width - approvalWidth;
  const nameWidth = approvalWidth - SIGNATURE_WIDTH - SIGNATURE_GAP;
  const nameX = approvalLeft + SIGNATURE_WIDTH + SIGNATURE_GAP;
  const approvalHeight = measure(document, 'УТВЕРЖДАЮ', approvalWidth, fonts, true);
  const positionHeight = measure(document, position, approvalWidth, fonts);
  const rowHeight = measure(document, fullName, nameWidth, fonts);
  const date = formatInstructionDownloadDate(downloadedAt);
  const dateHeight = measure(document, date, approvalWidth, fonts);
  pageSpace(document, approvalHeight + positionHeight + rowHeight + dateHeight + 20);
  y = document.y;
  y +=
    field(document, 'УТВЕРЖДАЮ', approvalLeft, y, approvalWidth, fonts, {
      bold: true,
    }) + 8;
  y += field(document, position, approvalLeft, y, approvalWidth, fonts) + 6;
  rule(document, approvalLeft, y + BODY_SIZE, SIGNATURE_WIDTH);
  field(document, fullName, nameX, y, nameWidth, fonts);
  y += rowHeight + 6;
  y += field(document, date, approvalLeft, y, approvalWidth, fonts);
  document.x = left;
  document.y = y + BLOCK_GAP;
}

export function renderInstructionCompanySignature(document, profile, fonts) {
  const left = document.page.margins.left;
  const width = document.page.width - left - document.page.margins.right;
  const columnGap = 18;
  const positionWidth = width * 0.43;
  const signatureX = left + positionWidth + columnGap;
  const nameX = signatureX + SIGNATURE_WIDTH + SIGNATURE_GAP;
  const nameWidth = left + width - nameX;
  const position = text(profile?.occupationalSafetyPosition);
  const fullName = text(profile?.occupationalSafetyFullName);
  const positionHeight = measure(document, position, positionWidth, fonts);
  const nameHeight = measure(document, fullName, nameWidth, fonts);
  const height = Math.max(positionHeight, nameHeight);
  pageSpace(document, BLOCK_GAP + height);
  const y = document.y + BLOCK_GAP;
  field(document, position, left, y, positionWidth, fonts);
  rule(document, signatureX, y + BODY_SIZE, SIGNATURE_WIDTH);
  field(document, fullName, nameX, y, nameWidth, fonts);
  document.x = left;
  document.y = y + height;
}
