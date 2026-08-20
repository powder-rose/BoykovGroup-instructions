//  :   (   
//  )    YandexGPT ,   
//          (,
//     ).   
//       (.
// src/services/yandexGptService.js  src/utils/professionGenitive.js)  
//      ,      
//  ,   .
//
// :
//   node scripts/fix-generated-titles.js           ,  
//   node scripts/fix-generated-titles.js --write       
import { instructionsRepository } from "../src/services/instructionsRepository.js";
import { getProfessionGenitive } from "../src/utils/professionGenitive.js";

const shouldWrite = process.argv.includes("--write");

const all = instructionsRepository.getAll();
const toFix = [];

for (const instruction of all) {
  if (instruction.source !== "generated") continue; //     
  if (!instruction.profession) continue;

  const correctTitle = `     ${getProfessionGenitive(instruction.profession)}`;
  if (instruction.title !== correctTitle) {
    toFix.push({ instruction, correctTitle });
  }
}

if (toFix.length === 0) {
  console.log("      .");
  process.exit(0);
}

console.log(` ${toFix.length}     :\n`);
for (const { instruction, correctTitle } of toFix) {
  console.log(`  [${instruction.id}]`);
  console.log(`    :  ${instruction.title}`);
  console.log(`    : ${correctTitle}\n`);
}

if (!shouldWrite) {
  console.log("      .");
  console.log("  , : node scripts/fix-generated-titles.js --write");
  process.exit(0);
}

for (const { instruction, correctTitle } of toFix) {
  instruction.title = correctTitle;
  instructionsRepository.save(instruction);
}

console.log(`     ${toFix.length} .`);
