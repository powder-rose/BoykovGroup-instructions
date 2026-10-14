# BoykovDocs вЂ” РёРЅСЃС‚СЂСѓРєС†РёРё РїРѕ РѕС…СЂР°РЅРµ С‚СЂСѓРґР°

Р’РµР±-РїСЂРёР»РѕР¶РµРЅРёРµ РґР»СЏ РїРѕРёСЃРєР°, РїСѓР±Р»РёРєР°С†РёРё, Р·Р°РіСЂСѓР·РєРё Рё РіРµРЅРµСЂР°С†РёРё РёРЅСЃС‚СЂСѓРєС†РёР№ РїРѕ РѕС…СЂР°РЅРµ С‚СЂСѓРґР° СЃ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµРј **YandexGPT**.

РџСЂРѕРµРєС‚ СЃРѕСЃС‚РѕРёС‚ РёР· frontend РЅР° **Vite + React** Рё backend РЅР° **Express (Node.js, ESM)**. Р”Р»СЏ С…СЂР°РЅРµРЅРёСЏ РёРЅСЃС‚СЂСѓРєС†РёР№ РёСЃРїРѕР»СЊР·СѓСЋС‚СЃСЏ JSON-С„Р°Р№Р»С‹, РґР»СЏ РїРѕРёСЃРєР° вЂ” Fuse.js, РґР»СЏ С„РѕРЅРѕРІРѕР№ РіРµРЅРµСЂР°С†РёРё вЂ” `node-cron`, РґР»СЏ Р°РІС‚РѕСЂРёР·Р°С†РёРё Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР° вЂ” JWT.

---

## РЎС‚РµРє

### Frontend

- Vite + React
- CSS Modules (`*.module.css`)
- Redux + Redux Thunk
- Comfortaa вЂ” РѕСЃРЅРѕРІРЅРѕР№ С€СЂРёС„С‚
- JetBrains Mono вЂ” РјРѕРЅРѕС€РёСЂРёРЅРЅС‹Р№ С€СЂРёС„С‚
- Google Fonts С‡РµСЂРµР· `client/index.html`
- CSS-РїРµСЂРµРјРµРЅРЅС‹Рµ `--font-main` Рё `--font-mono` РІ `client/src/styles/variables.css`

РџСЂРё РЅРµРѕР±С…РѕРґРёРјРѕСЃС‚Рё РІРјРµСЃС‚Рѕ Google Fonts РјРѕР¶РЅРѕ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ:

```text
@fontsource/comfortaa
@fontsource/jetbrains-mono
```

### Backend

- Express
- Node.js, ESM
- YandexGPT / Yandex Foundation Models API
- `node-cron`
- JWT
- bcrypt
- Fuse.js
- JSON-С…СЂР°РЅРёР»РёС‰Рµ
- `pdf-parse`
- `mammoth`

---

# Р‘С‹СЃС‚СЂС‹Р№ Р·Р°РїСѓСЃРє

## РЈСЃС‚Р°РЅРѕРІРєР° Р·Р°РІРёСЃРёРјРѕСЃС‚РµР№

РР· РєРѕСЂРЅСЏ РїСЂРѕРµРєС‚Р°:

```bash
npm run install:all
```

РР»Рё РѕС‚РґРµР»СЊРЅРѕ:

```bash
cd server && npm install
cd ../client && npm install
```

---

## РќР°СЃС‚СЂРѕР№РєР° РѕРєСЂСѓР¶РµРЅРёСЏ

РЎРѕР·РґР°С‚СЊ `.env`:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Р’ `server/.env` РЅРµРѕР±С…РѕРґРёРјРѕ РЅР°СЃС‚СЂРѕРёС‚СЊ YandexGPT Рё РґР°РЅРЅС‹Рµ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°.

Р”Р»СЏ РіРµРЅРµСЂР°С†РёРё С…СЌС€Р° РїР°СЂРѕР»СЏ:

```bash
cd server
node scripts/hash-password.js "Р’РђРЁ_РџРђР РћР›Р¬"
cd ..
```

РџРѕР»СѓС‡РµРЅРЅС‹Р№ С…СЌС€ СЃРѕС…СЂР°РЅРёС‚СЊ РІ:

```env
ADMIN_PASSWORD_HASH=
```

---

## Р—Р°РїСѓСЃРє

РР· РєРѕСЂРЅСЏ РїСЂРѕРµРєС‚Р°:

```bash
npm run dev
```

РР»Рё РѕС‚РґРµР»СЊРЅРѕ:

```bash
cd server && npm run dev
```

Backend:

```text
http://localhost:4000
```

Frontend:

```bash
cd client && npm run dev
```

Frontend:

```text
http://localhost:5173
```

---

## Р Р°Р±РѕС‚Р° РІ Р»РѕРєР°Р»СЊРЅРѕР№ СЃРµС‚Рё

Р’ `client/vite.config.js` dev-СЃРµСЂРІРµСЂ РјРѕР¶РµС‚ Р±С‹С‚СЊ РЅР°СЃС‚СЂРѕРµРЅ С‚Р°Рє:

```js
server: {
  host: '0.0.0.0';
}
```

РџРѕСЃР»Рµ Р·Р°РїСѓСЃРєР° Vite РјРѕР¶РµС‚ РїРѕРєР°Р·Р°С‚СЊ:

```text
Network: http://<IP>:5173/
```

Р•СЃР»Рё frontend РѕС‚РєСЂС‹С‚ РЅРµ С‡РµСЂРµР· `localhost`, РЅРµРѕР±С…РѕРґРёРјРѕ СѓРєР°Р·Р°С‚СЊ СЃРѕРѕС‚РІРµС‚СЃС‚РІСѓСЋС‰РёР№ origin РІ `CLIENT_ORIGIN` РЅР° backend, РЅР°РїСЂРёРјРµСЂ:

```env
CLIENT_ORIGIN=http://192.168.1.42:5173
```

---

# РЎС‚СЂСѓРєС‚СѓСЂР° РїСЂРѕРµРєС‚Р°

```text
client/
  src/
    api/
      instructionsApi.js
      authApi.js

    store/
      index.js
      rootReducer.js
      authSlice.js
      instructionsSlice.js

    hooks/
      useDebouncedValue.js

    components/
      Header/
      SearchBar/
      AuthControl/
      LoginModal/
      GenerateInstructionButton/
      AddInstructionButton/
      SiteLinkButton/
      InstructionList/
      InstructionButton/
      Pagination/
      EmptyState/
      InstructionModal/
      Loader/

    App.jsx


server/
  src/
    index.js

    middleware/
      auth.js

    jobs/
      dailyGenerationJob.js

    routes/
      auth.js
      instructions.js

    services/
      authService.js
      instructionsRepository.js
      searchService.js
      yandexGptService.js
      documentTextExtractor.js
      scheduledGenerationService.js

    prompts/
      generateInstructionPrompt.js

    data/
      instructions/
      professionQueue.json
      professionGenitiveOverrides.js

    utils/
      slug.js
      professionGenitive.js

  scripts/
    hash-password.js
```

---

# API РёРЅСЃС‚СЂСѓРєС†РёР№

## РџРѕР»СѓС‡РёС‚СЊ СЃРїРёСЃРѕРє РёРЅСЃС‚СЂСѓРєС†РёР№

```http
GET /api/instructions?q=<query>&page=<page>&pageSize=6
```

РџРѕРёСЃРє РІС‹РїРѕР»РЅСЏРµС‚СЃСЏ С‡РµСЂРµР· `Fuse.js`.

---

## РџРѕР»СѓС‡РёС‚СЊ РёРЅСЃС‚СЂСѓРєС†РёСЋ

```http
GET /api/instructions/:id
```

---

# РђРІС‚РѕСЂРёР·Р°С†РёСЏ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°

РђРІС‚РѕСЂРёР·Р°С†РёСЏ РЅР°СЃС‚СЂР°РёРІР°РµС‚СЃСЏ С‡РµСЂРµР· `server/.env`.

РџСЂРёРјРµСЂ:

```env
ADMIN_LOGIN=admin
ADMIN_PASSWORD_HASH=
JWT_SECRET=
JWT_EXPIRES_IN=12h
```

Р”Р»СЏ СЃРѕР·РґР°РЅРёСЏ С…СЌС€Р° РїР°СЂРѕР»СЏ:

```bash
node server/scripts/hash-password.js "Р’РђРЁ_РџРђР РћР›Р¬"
```

Р’С…РѕРґ РІС‹РїРѕР»РЅСЏРµС‚СЃСЏ С‡РµСЂРµР·:

```http
POST /api/auth/login
```

РџСЂРѕРІРµСЂРєР° С‚РµРєСѓС‰РµР№ СЃРµСЃСЃРёРё:

```http
GET /api/auth/me
```

JWT С…СЂР°РЅРёС‚СЃСЏ РЅР° frontend РІ `localStorage` Рё РїРµСЂРµРґР°С‘С‚СЃСЏ РІ Р·Р°С‰РёС‰С‘РЅРЅС‹С… Р·Р°РїСЂРѕСЃР°С…:

```http
Authorization: Bearer <token>
```

Middleware:

```text
attachUser
requireAdmin
```

РџСЂРё РѕС‚СЃСѓС‚СЃС‚РІРёРё РґРµР№СЃС‚РІРёС‚РµР»СЊРЅРѕРіРѕ С‚РѕРєРµРЅР° Р·Р°С‰РёС‰С‘РЅРЅС‹Рµ РјР°СЂС€СЂСѓС‚С‹ РІРѕР·РІСЂР°С‰Р°СЋС‚:

```text
401 Unauthorized
```

---

# Р—Р°С‰РёС‰С‘РЅРЅС‹Рµ РґРµР№СЃС‚РІРёСЏ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°

## Р“РµРЅРµСЂР°С†РёСЏ РёРЅСЃС‚СЂСѓРєС†РёРё

```http
POST /api/instructions/generate
Authorization: Bearer <token>
Content-Type: application/json
```

Body:

```json
{
  "profession": "<РїСЂРѕС„РµСЃСЃРёСЏ>"
}
```

РќР° frontend РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ:

```text
GenerateInstructionButton
```

---

## РЈРґР°Р»РµРЅРёРµ РёРЅСЃС‚СЂСѓРєС†РёРё

```http
DELETE /api/instructions/:id
Authorization: Bearer <token>
```

---

## Р СѓС‡РЅРѕР№ Р·Р°РїСѓСЃРє РїР»Р°РЅРѕРІРѕР№ РіРµРЅРµСЂР°С†РёРё

```http
POST /api/instructions/run-scheduled-generation
Authorization: Bearer <token>
```

---

# Р“РµРЅРµСЂР°С†РёСЏ РёРЅСЃС‚СЂСѓРєС†РёР№ С‡РµСЂРµР· YandexGPT

РћСЃРЅРѕРІРЅРѕР№ СЃРµСЂРІРёСЃ:

```text
server/src/services/yandexGptService.js
```

РџСЂРѕРјРїС‚:

```text
server/src/prompts/generateInstructionPrompt.js
```

РСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ Yandex Foundation Models API:

```text
https://llm.api.cloud.yandex.net/foundationModels/v1/completion
```

РРЅСЃС‚СЂСѓРєС†РёСЏ С„РѕСЂРјРёСЂСѓРµС‚СЃСЏ РїРѕ СЂР°Р·РґРµР»Р°Рј. Р’ РїСЂРѕРµРєС‚Рµ РїСЂРµРґСѓСЃРјРѕС‚СЂРµРЅР° РіРµРЅРµСЂР°С†РёСЏ РїСЏС‚Рё РѕСЃРЅРѕРІРЅС‹С… СЂР°Р·РґРµР»РѕРІ РёРЅСЃС‚СЂСѓРєС†РёРё РїРѕ РѕС…СЂР°РЅРµ С‚СЂСѓРґР°.

Р РµР·СѓР»СЊС‚Р°С‚ СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ РІ:

```text
server/src/data/instructions/
```

---

# РўСЂРµР±РѕРІР°РЅРёСЏ Рє СЃС‚СЂСѓРєС‚СѓСЂРµ РёРЅСЃС‚СЂСѓРєС†РёРё

РџСЂРѕРјРїС‚ РѕСЂРёРµРЅС‚РёСЂРѕРІР°РЅ РЅР° РїСЏС‚СЊ РѕСЃРЅРѕРІРЅС‹С… СЂР°Р·РґРµР»РѕРІ:

1. РћР±С‰РёРµ С‚СЂРµР±РѕРІР°РЅРёСЏ РѕС…СЂР°РЅС‹ С‚СЂСѓРґР°.
2. РўСЂРµР±РѕРІР°РЅРёСЏ РѕС…СЂР°РЅС‹ С‚СЂСѓРґР° РїРµСЂРµРґ РЅР°С‡Р°Р»РѕРј СЂР°Р±РѕС‚С‹.
3. РўСЂРµР±РѕРІР°РЅРёСЏ РѕС…СЂР°РЅС‹ С‚СЂСѓРґР° РІРѕ РІСЂРµРјСЏ СЂР°Р±РѕС‚С‹.
4. РўСЂРµР±РѕРІР°РЅРёСЏ РѕС…СЂР°РЅС‹ С‚СЂСѓРґР° РІ Р°РІР°СЂРёР№РЅС‹С… СЃРёС‚СѓР°С†РёСЏС….
5. РўСЂРµР±РѕРІР°РЅРёСЏ РѕС…СЂР°РЅС‹ С‚СЂСѓРґР° РїРѕ РѕРєРѕРЅС‡Р°РЅРёРё СЂР°Р±РѕС‚С‹.

РўРѕС‡РЅР°СЏ СЃС‚СЂСѓРєС‚СѓСЂР°, РѕР±СЉС‘Рј Рё РїСЂР°РІРёР»Р° РіРµРЅРµСЂР°С†РёРё Р·Р°РґР°СЋС‚СЃСЏ РІ:

```text
server/src/prompts/generateInstructionPrompt.js
```

---

# РЎРєР»РѕРЅРµРЅРёРµ РїСЂРѕС„РµСЃСЃРёР№

Р”Р»СЏ С„РѕСЂРјРёСЂРѕРІР°РЅРёСЏ РєРѕСЂСЂРµРєС‚РЅС‹С… Р·Р°РіРѕР»РѕРІРєРѕРІ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ:

```text
server/src/utils/professionGenitive.js
```

РСЃРєР»СЋС‡РµРЅРёСЏ:

```text
server/src/data/professionGenitiveOverrides.js
```

РћС‡РµСЂРµРґСЊ РїСЂРѕС„РµСЃСЃРёР№:

```text
server/src/data/professionQueue.json
```

Р•СЃР»Рё РїСЂРѕС„РµСЃСЃРёСЏ СЃРєР»РѕРЅСЏРµС‚СЃСЏ РЅРµРІРµСЂРЅРѕ, РµС‘ РјРѕР¶РЅРѕ РґРѕР±Р°РІРёС‚СЊ РІ С„Р°Р№Р» РёСЃРєР»СЋС‡РµРЅРёР№.

РџСЂРёРјРµСЂ:

```js
{
  "РІРёР·Р°Р¶РёСЃС‚": "РІРёР·Р°Р¶РёСЃС‚Р°"
}
```

---

## РСЃРїСЂР°РІР»РµРЅРёРµ Р·Р°РіРѕР»РѕРІРєРѕРІ СѓР¶Рµ СЃРѕР·РґР°РЅРЅС‹С… РёРЅСЃС‚СЂСѓРєС†РёР№

РџСЂРµРґРїСЂРѕСЃРјРѕС‚СЂ:

```bash

```

РџСЂРёРјРµРЅРёС‚СЊ РёР·РјРµРЅРµРЅРёСЏ:

```bash

```

РЎРєСЂРёРїС‚ РїСЂРµРґРЅР°Р·РЅР°С‡РµРЅ РґР»СЏ РёСЃРїСЂР°РІР»РµРЅРёСЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё СЃРіРµРЅРµСЂРёСЂРѕРІР°РЅРЅС‹С… РёРЅСЃС‚СЂСѓРєС†РёР№, РІ С‡Р°СЃС‚РЅРѕСЃС‚Рё Р·Р°РїРёСЃРµР№ СЃ:

```json
{
  "source": "generated"
}
```

Р—Р°РіСЂСѓР¶РµРЅРЅС‹Рµ РёРЅСЃС‚СЂСѓРєС†РёРё (`source: "uploaded"`) Рё seed-РёРЅСЃС‚СЂСѓРєС†РёРё РЅРµ СЃР»РµРґСѓРµС‚ РёР·РјРµРЅСЏС‚СЊ Р±РµР· РЅРµРѕР±С…РѕРґРёРјРѕСЃС‚Рё.

---

# Р—Р°РіСЂСѓР·РєР° РёРЅСЃС‚СЂСѓРєС†РёР№

РќР° frontend РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ:

```text
AddInstructionButton
```

Р—Р°РїСЂРѕСЃ:

```http
POST /api/instructions/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

РџРѕРґРґРµСЂР¶РёРІР°РµРјС‹Рµ РїРѕР»СЏ:

```text
title
profession
file
content
```

---

## РџРѕРґРґРµСЂР¶РёРІР°РµРјС‹Рµ С„РѕСЂРјР°С‚С‹

РџРѕРґРґРµСЂР¶РёРІР°СЋС‚СЃСЏ:

- PDF
- DOCX
- TXT
- MD

РР·РІР»РµС‡РµРЅРёРµ С‚РµРєСЃС‚Р° РІС‹РїРѕР»РЅСЏРµС‚СЃСЏ РІ:

```text
server/src/services/documentTextExtractor.js
```

РСЃРїРѕР»СЊР·СѓСЋС‚СЃСЏ:

- PDF в†’ `pdf-parse`
- DOCX в†’ `mammoth`
- TXT / MD в†’ С‡С‚РµРЅРёРµ С‚РµРєСЃС‚Р° РЅР°РїСЂСЏРјСѓСЋ

Р¤РѕСЂРјР°С‚ `.doc` РЅР°РїСЂСЏРјСѓСЋ РЅРµ РїРѕРґРґРµСЂР¶РёРІР°РµС‚СЃСЏ. РўР°РєРѕР№ С„Р°Р№Р» РЅРµРѕР±С…РѕРґРёРјРѕ РїСЂРµРґРІР°СЂРёС‚РµР»СЊРЅРѕ РїСЂРµРѕР±СЂР°Р·РѕРІР°С‚СЊ РІ `.docx` РёР»Рё `.pdf`.

РўРµРєСѓС‰РёР№ Р»РёРјРёС‚ Р·Р°РіСЂСѓР·РєРё Р·Р°РґР°С‘С‚СЃСЏ РІ:

```text
server/src/routes/instructions.js
```

Р’ РёСЃС…РѕРґРЅРѕРј РѕРїРёСЃР°РЅРёРё РїСЂРѕРµРєС‚Р° СѓРєР°Р·Р°РЅ Р»РёРјРёС‚ **15 РњР‘**.

OCR РґР»СЏ СЃРєР°РЅРёСЂРѕРІР°РЅРЅС‹С… PDF Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РЅРµ РІС‹РїРѕР»РЅСЏРµС‚СЃСЏ.

РџРѕСЃР»Рµ Р·Р°РіСЂСѓР·РєРё РёРЅСЃС‚СЂСѓРєС†РёСЏ РїРѕР»СѓС‡Р°РµС‚ РїСЂРёР·РЅР°РєРё РІСЂРѕРґРµ:

```json
{
  "source": "uploaded",
  "uploadedBy": "admin"
}
```

РўР°РєР¶Рµ РјРѕР¶РµС‚ СЃРѕС…СЂР°РЅСЏС‚СЊСЃСЏ С‚РёРї С„Р°Р№Р»Р° Рё РѕСЂРёРіРёРЅР°Р»СЊРЅРѕРµ РёРјСЏ.

---

# РҐСЂР°РЅРёР»РёС‰Рµ РёРЅСЃС‚СЂСѓРєС†РёР№

РРЅСЃС‚СЂСѓРєС†РёРё С…СЂР°РЅСЏС‚СЃСЏ РІ:

```text
server/src/data/instructions/
```

РљР°Р¶РґР°СЏ РёРЅСЃС‚СЂСѓРєС†РёСЏ вЂ” РѕС‚РґРµР»СЊРЅС‹Р№ JSON-С„Р°Р№Р».

Р РµРїРѕР·РёС‚РѕСЂРёР№:

```text
server/src/services/instructionsRepository.js
```

РћСЃРЅРѕРІРЅС‹Рµ РјРµС‚РѕРґС‹:

```text
getAll
getById
save
```

РўР°РєР¶Рµ РІ РїСЂРѕРµРєС‚Рµ РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ СѓРґР°Р»РµРЅРёРµ РёРЅСЃС‚СЂСѓРєС†РёР№ С‡РµСЂРµР· API.

---

# РђРІС‚РѕРјР°С‚РёС‡РµСЃРєР°СЏ РіРµРЅРµСЂР°С†РёСЏ

РђРІС‚РѕРјР°С‚РёС‡РµСЃРєР°СЏ РіРµРЅРµСЂР°С†РёСЏ СЂРµР°Р»РёР·РѕРІР°РЅР° С‡РµСЂРµР· `node-cron`.

РћСЃРЅРѕРІРЅС‹Рµ С„Р°Р№Р»С‹:

```text
server/src/jobs/dailyGenerationJob.js
server/src/services/scheduledGenerationService.js
```

Cron Р·Р°РїСѓСЃРєР°РµС‚СЃСЏ РёР·:

```text
server/src/index.js
```

Р Р°СЃРїРёСЃР°РЅРёРµ Р·Р°РґР°С‘С‚СЃСЏ РїРµСЂРµРјРµРЅРЅРѕР№:

```env
DAILY_GENERATION_CRON=
```

РџСЂРёРјРµСЂС‹:

РљР°Р¶РґС‹Р№ С‡Р°СЃ:

```env
DAILY_GENERATION_CRON=0 * * * *
```

РљР°Р¶РґС‹Рµ 2 С‡Р°СЃР°:

```env
DAILY_GENERATION_CRON=0 */2 * * *
```

РўСЂРё СЂР°Р·Р° РІ СЃСѓС‚РєРё:

```env
DAILY_GENERATION_CRON=0 3,11,19 * * *
```

---

## РћС‡РµСЂРµРґСЊ РїСЂРѕС„РµСЃСЃРёР№

РћС‡РµСЂРµРґСЊ С…СЂР°РЅРёС‚СЃСЏ РІ:

```text
server/src/data/professionQueue.json
```

Р’ РёСЃС…РѕРґРЅРѕРј РѕРїРёСЃР°РЅРёРё РїСЂРѕРµРєС‚Р° СѓРєР°Р·Р°РЅРѕ РѕРєРѕР»Рѕ **180 РїСЂРѕС„РµСЃСЃРёР№**.

РџСЂРё С‚РµРјРїРµ РѕРєРѕР»Рѕ **24 РёРЅСЃС‚СЂСѓРєС†РёР№ РІ СЃСѓС‚РєРё** РїРѕР»РЅР°СЏ РѕР±СЂР°Р±РѕС‚РєР° С‚Р°РєРѕР№ РѕС‡РµСЂРµРґРё Р·Р°РЅРёРјР°РµС‚ РѕСЂРёРµРЅС‚РёСЂРѕРІРѕС‡РЅРѕ 7вЂ“8 РґРЅРµР№.

---

## `runScheduledGeneration()`

РЎРµСЂРІРёСЃ:

```text
server/src/services/scheduledGenerationService.js
```

Р›РѕРіРёРєР°:

1. Р‘РµСЂС‘С‚ СЃР»РµРґСѓСЋС‰СѓСЋ РїСЂРѕС„РµСЃСЃРёСЋ РёР· `professionQueue.json`.
2. РџСЂРѕРІРµСЂСЏРµС‚ РЅР°Р»РёС‡РёРµ СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РµР№ РёРЅСЃС‚СЂСѓРєС†РёРё.
3. Р•СЃР»Рё РёРЅСЃС‚СЂСѓРєС†РёСЏ РµСЃС‚СЊ вЂ” РїСЂРѕС„РµСЃСЃРёСЏ РїСЂРѕРїСѓСЃРєР°РµС‚СЃСЏ.
4. Р•СЃР»Рё РёРЅСЃС‚СЂСѓРєС†РёРё РЅРµС‚ вЂ” РІС‹Р·С‹РІР°РµС‚СЃСЏ YandexGPT.
5. РЎРіРµРЅРµСЂРёСЂРѕРІР°РЅРЅР°СЏ РёРЅСЃС‚СЂСѓРєС†РёСЏ СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ РІ `server/src/data/instructions/`.
6. Р”Р»СЏ СЂРµР·СѓР»СЊС‚Р°С‚Р° РјРѕР¶РµС‚ СѓРєР°Р·С‹РІР°С‚СЊСЃСЏ РёСЃС‚РѕС‡РЅРёРє Р·Р°РїСѓСЃРєР°.

РќР°РїСЂРёРјРµСЂ:

```json
{
  "generatedBy": "schedule"
}
```

РёР»Рё:

```json
{
  "generatedBy": "admin"
}
```

---

# Р—Р°С‰РёС‚Р° РѕС‚ РґСѓР±Р»РµР№ Рё РїР°СЂР°Р»Р»РµР»СЊРЅРѕР№ РіРµРЅРµСЂР°С†РёРё

ID РёРЅСЃС‚СЂСѓРєС†РёРё С„РѕСЂРјРёСЂСѓРµС‚СЃСЏ СЃ РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµРј:

```text
slugify(profession)
```

Р¤Р°Р№Р»:

```text
server/src/utils/slug.js
```

Р”Р»СЏ Р·Р°С‰РёС‚С‹ РѕС‚ РѕРґРЅРѕРІСЂРµРјРµРЅРЅРѕР№ РіРµРЅРµСЂР°С†РёРё РѕРґРЅРѕР№ Рё С‚РѕР№ Р¶Рµ РїСЂРѕС„РµСЃСЃРёРё РёСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ:

```text
server/src/services/generationLock.js
```

РџРµСЂРµРґ РіРµРЅРµСЂР°С†РёРµР№ РЅРµРѕР±С…РѕРґРёРјРѕ РїСЂРѕРІРµСЂСЏС‚СЊ СЃСѓС‰РµСЃС‚РІСѓСЋС‰СѓСЋ РёРЅСЃС‚СЂСѓРєС†РёСЋ Рё РЅРµ СЃРѕР·РґР°РІР°С‚СЊ РґСѓР±Р»Рё.

---

# РќР°СЃС‚СЂРѕР№РєР° Yandex Cloud

Р’ `server/.env`:

```env
YANDEX_API_KEY=
YANDEX_FOLDER_ID=
YANDEX_GPT_MODEL=yandexgpt/latest
```

Yandex Cloud:

```text
https://console.yandex.cloud
```

Р”Р»СЏ API-РєР»СЋС‡Р° С‚СЂРµР±СѓСЋС‚СЃСЏ РїСЂР°РІР° РЅР° РёСЃРїРѕР»СЊР·РѕРІР°РЅРёРµ Yandex Foundation Models.

Р•СЃР»Рё `YANDEX_API_KEY` РёР»Рё `YANDEX_FOLDER_ID` РЅРµ РЅР°СЃС‚СЂРѕРµРЅС‹, РіРµРЅРµСЂР°С†РёСЏ С‡РµСЂРµР· YandexGPT РЅРµРґРѕСЃС‚СѓРїРЅР°.

---

# РџСЂРёРјРµСЂ `server/.env`

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173

YANDEX_API_KEY=
YANDEX_FOLDER_ID=
YANDEX_GPT_MODEL=yandexgpt/latest

JWT_SECRET=
JWT_EXPIRES_IN=12h

ADMIN_LOGIN=admin
ADMIN_PASSWORD_HASH=

DAILY_GENERATION_CRON=0 * * * *
```

Р”Р»СЏ production РЅРµРѕР±С…РѕРґРёРјРѕ Р·Р°РјРµРЅРёС‚СЊ `CLIENT_ORIGIN` РЅР° СЂРµР°Р»СЊРЅС‹Р№ Р°РґСЂРµСЃ frontend.

---

# Redux

Redux СЂР°СЃРїРѕР»РѕР¶РµРЅ РІ:

```text
client/src/store/
```

РСЃРїРѕР»СЊР·СѓРµС‚СЃСЏ РѕР±С‹С‡РЅС‹Р№ `redux` + `redux-thunk`.

РљРѕСЂРЅРµРІРѕР№ reducer:

```js
combineReducers({
  auth,
  instructions,
});
```

---

## `auth`

Р¤Р°Р№Р»:

```text
client/src/store/authSlice.js
```

РћС‚РІРµС‡Р°РµС‚ Р·Р°:

- Р°РІС‚РѕСЂРёР·Р°С†РёСЋ;
- РІС‹С…РѕРґ;
- РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ СЃРµСЃСЃРёРё;
- РґР°РЅРЅС‹Рµ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ;
- JWT.

Thunk-С„СѓРЅРєС†РёРё:

```text
login
logout
restoreSession
```

---

## `instructions`

Р¤Р°Р№Р»:

```text
client/src/store/instructionsSlice.js
```

РћС‚РІРµС‡Р°РµС‚ Р·Р°:

- СЃРїРёСЃРѕРє РёРЅСЃС‚СЂСѓРєС†РёР№;
- РїРѕРёСЃРє;
- РїРѕР»СѓС‡РµРЅРёРµ РёРЅСЃС‚СЂСѓРєС†РёРё;
- РіРµРЅРµСЂР°С†РёСЋ;
- Р·Р°РіСЂСѓР·РєСѓ;
- СѓРґР°Р»РµРЅРёРµ.

Thunk-С„СѓРЅРєС†РёРё:

```text
searchInstructions
fetchInstruction
generateInstruction
uploadInstruction
deleteInstruction
```

---

# РЎСЃС‹Р»РєР° РЅР° РѕСЃРЅРѕРІРЅРѕР№ СЃР°Р№С‚

РљРѕРјРїРѕРЅРµРЅС‚:

```text
client/src/components/SiteLinkButton/SiteLinkButton.jsx
```

Р’ РёСЃС…РѕРґРЅРѕРј РѕРїРёСЃР°РЅРёРё РїСЂРѕРµРєС‚Р° СЃСЃС‹Р»РєР° РІРµРґС‘С‚ РЅР°:

```text
https://boykovgroup.ru
```

РђРґСЂРµСЃ РјРѕР¶РµС‚ Р·Р°РґР°РІР°С‚СЊСЃСЏ С‡РµСЂРµР·:

```env
VITE_SITE_URL=
```

РІ `client/.env`.

---

# Seed-РґР°РЅРЅС‹Рµ

Р’:

```text
server/src/data/instructions/
```

РЅР°С…РѕРґСЏС‚СЃСЏ СЃС‚Р°СЂС‚РѕРІС‹Рµ JSON-РёРЅСЃС‚СЂСѓРєС†РёРё.

РћС‡РµСЂРµРґСЊ РґР»СЏ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРѕР№ РіРµРЅРµСЂР°С†РёРё:

```text
server/src/data/professionQueue.json
```

---

# Production

Р”Р»СЏ production frontend РґРѕР»Р¶РµРЅ РѕР±СЂР°С‰Р°С‚СЊСЃСЏ Рє backend С‡РµСЂРµР· РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅС‹Рµ URL:

```text
/api/...
```

РќРµ СЃР»РµРґСѓРµС‚ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ:

```text
http://localhost:4000
```

РёР»Рё:

```text
http://api/...
```

РЅР° HTTPS-СЃР°Р№С‚Рµ.

---

# Beget / Passenger

РџСЂРё СЂР°Р·РјРµС‰РµРЅРёРё backend РЅР° Beget С‡РµСЂРµР· Passenger РїСЂРёР»РѕР¶РµРЅРёРµ Р·Р°РїСѓСЃРєР°РµС‚СЃСЏ РєР°Рє Node.js-РїСЂРёР»РѕР¶РµРЅРёРµ РїРѕРґ `mod_passenger`.

Р”Р»СЏ С‚Р°РєРѕРіРѕ СЂР°Р·РјРµС‰РµРЅРёСЏ РІРЅСѓС‚СЂРµРЅРЅРёР№ `node-cron` РјРѕР¶РµС‚ Р±С‹С‚СЊ РЅРµРЅР°РґС‘Р¶РЅС‹Рј, РµСЃР»Рё Passenger РІС‹РіСЂСѓР¶Р°РµС‚ РїСЂРѕС†РµСЃСЃ РїСЂРёР»РѕР¶РµРЅРёСЏ РїСЂРё РїСЂРѕСЃС‚РѕРµ.

Р”Р»СЏ СЃС‚Р°Р±РёР»СЊРЅРѕР№ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРѕР№ РіРµРЅРµСЂР°С†РёРё РІ production РїСЂРµРґРїРѕС‡С‚РёС‚РµР»СЊРЅРµРµ РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ СЃРёСЃС‚РµРјРЅС‹Р№ Cron Beget, РєРѕС‚РѕСЂС‹Р№ Р·Р°РїСѓСЃРєР°РµС‚ РѕС‚РґРµР»СЊРЅС‹Р№ СЃРєСЂРёРїС‚ РёР»Рё РІС‹Р·С‹РІР°РµС‚ Р·Р°С‰РёС‰С‘РЅРЅС‹Р№ endpoint РїР»Р°РЅРѕРІРѕР№ РіРµРЅРµСЂР°С†РёРё.

---

# Р’Р°Р¶РЅС‹Рµ Р·Р°РјРµС‡Р°РЅРёСЏ

- РќРµ С…СЂР°РЅРёС‚СЊ СЂРµР°Р»СЊРЅС‹Рµ API-РєР»СЋС‡Рё РІ Git.
- РќРµ РєРѕРјРјРёС‚РёС‚СЊ `server/.env`.
- РќРµ С…СЂР°РЅРёС‚СЊ РїР°СЂРѕР»СЊ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР° РІ РёСЃС…РѕРґРЅРѕРј РєРѕРґРµ.
- РџРѕСЃР»Рµ РёР·РјРµРЅРµРЅРёСЏ `server/.env` backend РЅРµРѕР±С…РѕРґРёРјРѕ РїРµСЂРµР·Р°РїСѓСЃС‚РёС‚СЊ.
- РџСЂРё РёР·РјРµРЅРµРЅРёРё frontend production-СЃР±РѕСЂРєСѓ РЅРµРѕР±С…РѕРґРёРјРѕ РїРµСЂРµСЃРѕР±СЂР°С‚СЊ.
- Р”Р»СЏ HTTPS РёСЃРїРѕР»СЊР·РѕРІР°С‚СЊ С‚РѕР»СЊРєРѕ Р±РµР·РѕРїР°СЃРЅС‹Рµ URL.
