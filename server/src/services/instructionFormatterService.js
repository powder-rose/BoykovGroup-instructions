import fetch from "node-fetch";

const URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion";

function config(){
 return {apiKey:process.env.YANDEX_API_KEY, folderId:process.env.YANDEX_FOLDER_ID, model:process.env.YANDEX_GPT_MODEL || "yandexgpt/latest"};
}

export function isFormatterConfigured(){
 const c=config();
 return Boolean(c.apiKey && c.folderId);
}

export async function formatInstructionDocument(text, filename=""){
 const c=config();
 if(!c.apiKey || !c.folderId) throw new Error("YandexGPT не настроен");
 const prompt=`Ты редактор документации по охране труда. Приведи документ к стандартной инструкции. Удали реквизиты, подписи, даты, ООО, ИП, адреса, шаблонные поля. Определи профессию. Верни только JSON без markdown.
Формат:
{"title":"Инструкция по охране труда для ...","profession":"...","intro":"...","sections":[{"number":1,"heading":"Общие требования охраны труда","paragraphs":[]}]}
Файл: ${filename}
Текст:
${text.slice(0,30000)}`;
 const r=await fetch(URL,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Api-Key ${c.apiKey}`,"x-folder-id":c.folderId},body:JSON.stringify({modelUri:`gpt://${c.folderId}/${c.model}`,completionOptions:{temperature:0.2,maxTokens:6000},messages:[{role:'user',text:prompt}]})});
 if(!r.ok) throw new Error(`YandexGPT ${r.status}`);
 const data=await r.json();
 const out=data?.result?.alternatives?.[0]?.message?.text;
 if(!out) throw new Error('Пустой ответ YandexGPT');
 return JSON.parse(out.replace(/```json|```/g,'').trim());
}
