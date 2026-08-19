// Разовая утилита: пересобирает название («Инструкция по охране труда
// для …») у уже сгенерированных YandexGPT инструкций, у которых профессия
// в названии не была правильно склонена в родительный падеж (например,
// «для электромонтёр» вместо «для электромонтёра»). После обновления кода
// новые инструкции формируют название сразу правильно (см.
// src/services/yandexGptService.js и src/utils/professionGenitive.js) — этот
// скрипт нужен только чтобы поправить то, что уже успело сохраниться на диск
// со старым, неправильно склонённым названием.
//
// Использование:
//   node scripts/fix-generated-titles.js         — только показать, что изменится
//   node scripts/fix-generated-titles.js --write  — применить и сохранить на диск
import { instructionsRepository } from "../src/services/instructionsRepository.js";
import { getProfessionGenitive } from "../src/utils/professionGenitive.js";

const shouldWrite = process.argv.includes("--write");

const all = instructionsRepository.getAll();
const toFix = [];

for (const instruction of all) {
  if (instruction.source !== "generated") continue; // загруженные вручную инструкции не трогаем
  if (!instruction.profession) continue;

  const correctTitle = `Инструкция по охране труда для ${getProfessionGenitive(instruction.profession)}`;
  if (instruction.title !== correctTitle) {
    toFix.push({ instruction, correctTitle });
  }
}

if (toFix.length === 0) {
  console.log("Все названия уже корректны — исправлять нечего.");
  process.exit(0);
}

console.log(`Найдено ${toFix.length} инструкций с названием для исправления:\n`);
for (const { instruction, correctTitle } of toFix) {
  console.log(`  [${instruction.id}]`);
  console.log(`    было:  ${instruction.title}`);
  console.log(`    станет: ${correctTitle}\n`);
}

if (!shouldWrite) {
  console.log("Это предварительный просмотр — файлы не изменены.");
  console.log("Чтобы применить исправления, запустите: node scripts/fix-generated-titles.js --write");
  process.exit(0);
}

for (const { instruction, correctTitle } of toFix) {
  instruction.title = correctTitle;
  instructionsRepository.save(instruction);
}

console.log(`Готово — исправлено и сохранено ${toFix.length} инструкций.`);
