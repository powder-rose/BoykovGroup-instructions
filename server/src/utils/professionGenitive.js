import { PROFESSION_GENITIVE_OVERRIDES } from "../data/professionGenitiveOverrides.js";

/**
 *          
 *      {  . }.
 *
 *        YandexGPT ( 
 *      ),    
 *     ,     
 *  (    ). 
 *       (. yandexGptService.js),
 *      ,    :
 *
 * 1.    PROFESSION_GENITIVE_OVERRIDES  
 *           
 *    (professionQueue.json).     .
 * 2.      (,     
 *       )      
 *    /.      
 *     ,     
 *        .
 */
export function getProfessionGenitive(profession) {
  const normalized = String(profession ?? "").trim().replace(/\s+/g, " ");
  if (!normalized) return normalized;

  const exact = PROFESSION_GENITIVE_OVERRIDES[normalized];
  if (exact) return exact;

  //    /    , 
  //         (    ..).
  const lower = normalized.toLowerCase();
  for (const [key, value] of Object.entries(PROFESSION_GENITIVE_OVERRIDES)) {
    if (key.toLowerCase() === lower) return value;
  }

  return declineProfessionHeuristic(normalized);
}

const ADJECTIVE_ENDING = /(||||||)$/i;

function looksLikeAdjective(word) {
  return ADJECTIVE_ENDING.test(word);
}

function declineAdjective(word) {
  if (/$/i.test(word)) return word.slice(0, -2) + "";
  if (/(|)$/i.test(word)) return word.slice(0, -2) + "";
  if (/$/i.test(word)) return word.slice(0, -2) + "";
  if (/$/i.test(word)) return word.slice(0, -2) + "";
  return word;
}

//    ( )    
//      / ,
//    .
function declineNoun(word) {
  if (!word) return word;

  // /   : , , .
  if (/(|)$/i.test(word)) return word.slice(0, -2) + "";
  if (/$/i.test(word)) return word.slice(0, -2) + "";

  //    :  -> .
  if (/$/i.test(word) && word.length > 3) return word.slice(0, -2) + "";

  //      :  -> ,  -> .
  if (/$/i.test(word)) return word.slice(0, -1) + "";

  //    -/-:  -> ,  /,,  -.
  if (/[]$/i.test(word)) return word.slice(0, -1) + "";
  if (/$/i.test(word)) return word.slice(0, -1) + "";
  if (/$/i.test(word)) return word.slice(0, -1) + "";

  //         
  //  :  -> .
  return word + "";
}

//       ,   
//    (-, -), 
//    (-, -).
function declineHead(word) {
  if (word.includes("-")) {
    return word
      .split("-")
      .map((part) => declineNoun(part))
      .join("-");
  }
  return declineNoun(word);
}

/**
 *   ,    , .
 *     ( / 
 *  ) ,     +  
 *  .    (    
 * ...  , ...   )
 *   ,        
 *  .
 */
function declineProfessionHeuristic(profession) {
  const words = profession.split(" ");
  if (words.length === 1) {
    return declineHead(words[0]);
  }

  //        
  // ,   , 
  // ,      
  //        .
  let adjectiveCount = 0;
  while (adjectiveCount < words.length - 1 && looksLikeAdjective(words[adjectiveCount])) {
    adjectiveCount++;
  }
  if (adjectiveCount > 0) {
    const declinedAdjectives = words.slice(0, adjectiveCount).map(declineAdjective);
    const declinedNoun = declineHead(words[adjectiveCount]);
    const rest = words.slice(adjectiveCount + 1).join(" ");
    return [...declinedAdjectives, declinedNoun, rest].filter(Boolean).join(" ");
  }

  //  + ,   ,
  //      ,   .
  if (words.length === 2 && looksLikeAdjective(words[1])) {
    return `${declineHead(words[0])} ${declineAdjective(words[1])}`;
  }

  //  :    ,    
  // (,  )     .
  const rest = words.slice(1).join(" ");
  return [declineHead(words[0]), rest].filter(Boolean).join(" ");
}
