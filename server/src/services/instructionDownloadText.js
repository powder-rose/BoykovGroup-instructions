const BOILERPLATE =
  /(?<![\p{L}\p{N}_])Настоящая\s+инструкция\s+устанавливает\s+требования\s+безопасности\s+при\s+выполнении\s+работ\.[ \t]*/giu;

export function instructionBoilerplateRanges(value) {
  return [...String(value ?? '').matchAll(BOILERPLATE)].map(match => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
}

export function instructionBodyText(value) {
  return String(value ?? '')
    .replace(/\r\n?/gu, '\n')
    .trim()
    .replace(BOILERPLATE, '')
    .trim();
}
