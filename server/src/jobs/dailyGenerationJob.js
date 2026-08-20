import cron from "node-cron";
import { runScheduledGeneration } from "../services/scheduledGenerationService.js";

//       (24   , ~20-30  
// ),        .
//   DAILY_GENERATION_CRON  server/.env (   cron-).
const DAILY_CRON_EXPRESSION = process.env.DAILY_GENERATION_CRON || "0 * * * *";

/**    :   ~24      . */
export function startDailyGenerationJob() {
  if (!cron.validate(DAILY_CRON_EXPRESSION)) {
    console.error(
      `[-]  cron- DAILY_GENERATION_CRON="${DAILY_CRON_EXPRESSION}"    .`
    );
    return;
  }

  cron.schedule(DAILY_CRON_EXPRESSION, async () => {
    console.log("[-]     ...");
    const result = await runScheduledGeneration();
    if (result.status === "skipped") {
      console.log(`[-] : ${result.reason}`);
    } else if (result.status === "error") {
      console.error(`[-] : ${result.reason}`);
    }
  });

  console.log(
    `[-]   (cron: "${DAILY_CRON_EXPRESSION}"). ` +
      " ,     ."
  );

  // Cron          
  //  ,       (    2-3 
  //   )     .   
  //     ,     
  //   ,       
  //     cron-.
  console.log("[-]    (  )...");
  runScheduledGeneration()
    .then((result) => {
      if (result.status === "generated") {
        console.log(`[-]  :  ${result.instruction.title}`);
      } else if (result.status === "skipped") {
        console.log(`[-]   : ${result.reason}`);
      } else {
        console.error(`[-]   : ${result.reason}`);
      }
    })
    .catch((err) => {
      console.error("[-]    :", err);
    });
}
