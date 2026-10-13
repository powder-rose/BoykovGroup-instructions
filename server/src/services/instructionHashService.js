import crypto from 'node:crypto';

export function createInstructionHash(instruction) {
  const content = [
    instruction.title,

    instruction.profession,

    instruction.intro,

    ...(instruction.sections || []).flatMap(section => section.paragraphs || []),
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return crypto.createHash('sha256').update(content).digest('hex');
}
