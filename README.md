
# BoykovDocs — инструкции по охране труда

Веб-приложение для поиска, публикации, загрузки и генерации инструкций по охране труда с использованием **YandexGPT**.

Проект состоит из frontend на **Vite + React** и backend на **Express (Node.js, ESM)**. Для хранения инструкций используются JSON-файлы, для поиска — Fuse.js, для фоновой генерации — `node-cron`, для авторизации администратора — JWT.

---

## Стек

### Frontend

- Vite + React
- CSS Modules (`*.module.css`)
- Redux + Redux Thunk
- Comfortaa — основной шрифт
- JetBrains Mono — моноширинный шрифт
- Google Fonts через `client/index.html`
- CSS-переменные `--font-main` и `--font-mono` в `client/src/styles/variables.css`

При необходимости вместо Google Fonts можно использовать:

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
- JSON-хранилище
- `pdf-parse`
- `mammoth`

---

# Быстрый запуск

## Установка зависимостей

Из корня проекта:

```bash
npm run install:all
```

Или отдельно:

```bash
cd server && npm install
cd ../client && npm install
```

---

## Настройка окружения

Создать `.env`:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

В `server/.env` необходимо настроить YandexGPT и данные администратора.

Для генерации хэша пароля:

```bash
cd server
node scripts/hash-password.js "ВАШ_ПАРОЛЬ"
cd ..
```

Полученный хэш сохранить в:

```env
ADMIN_PASSWORD_HASH=
```

---

## Запуск

Из корня проекта:

```bash
npm run dev
```

Или отдельно:

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

## Работа в локальной сети

В `client/vite.config.js` dev-сервер может быть настроен так:

```js
server: {
  host: "0.0.0.0"
}
```

После запуска Vite может показать:

```text
Network: http://<IP>:5173/
```

Если frontend открыт не через `localhost`, необходимо указать соответствующий origin в `CLIENT_ORIGIN` на backend, например:

```env
CLIENT_ORIGIN=http://192.168.1.42:5173
```

---

# Структура проекта

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
    fix-generated-titles.js
```

---

# API инструкций

## Получить список инструкций

```http
GET /api/instructions?q=<query>&page=<page>&pageSize=6
```

Поиск выполняется через `Fuse.js`.

---

## Получить инструкцию

```http
GET /api/instructions/:id
```

---

# Авторизация администратора

Авторизация настраивается через `server/.env`.

Пример:

```env
ADMIN_LOGIN=admin
ADMIN_PASSWORD_HASH=
JWT_SECRET=
JWT_EXPIRES_IN=12h
```

Для создания хэша пароля:

```bash
node server/scripts/hash-password.js "ВАШ_ПАРОЛЬ"
```

Вход выполняется через:

```http
POST /api/auth/login
```

Проверка текущей сессии:

```http
GET /api/auth/me
```

JWT хранится на frontend в `localStorage` и передаётся в защищённых запросах:

```http
Authorization: Bearer <token>
```

Middleware:

```text
attachUser
requireAdmin
```

При отсутствии действительного токена защищённые маршруты возвращают:

```text
401 Unauthorized
```

---

# Защищённые действия администратора

## Генерация инструкции

```http
POST /api/instructions/generate
Authorization: Bearer <token>
Content-Type: application/json
```

Body:

```json
{
  "profession": "<профессия>"
}
```

На frontend используется:

```text
GenerateInstructionButton
```

---

## Удаление инструкции

```http
DELETE /api/instructions/:id
Authorization: Bearer <token>
```

---

## Ручной запуск плановой генерации

```http
POST /api/instructions/run-scheduled-generation
Authorization: Bearer <token>
```

---

# Генерация инструкций через YandexGPT

Основной сервис:

```text
server/src/services/yandexGptService.js
```

Промпт:

```text
server/src/prompts/generateInstructionPrompt.js
```

Используется Yandex Foundation Models API:

```text
https://llm.api.cloud.yandex.net/foundationModels/v1/completion
```

Инструкция формируется по разделам. В проекте предусмотрена генерация пяти основных разделов инструкции по охране труда.

Результат сохраняется в:

```text
server/src/data/instructions/
```

---

# Требования к структуре инструкции

Промпт ориентирован на пять основных разделов:

1. Общие требования охраны труда.
2. Требования охраны труда перед началом работы.
3. Требования охраны труда во время работы.
4. Требования охраны труда в аварийных ситуациях.
5. Требования охраны труда по окончании работы.

Точная структура, объём и правила генерации задаются в:

```text
server/src/prompts/generateInstructionPrompt.js
```

---

# Склонение профессий

Для формирования корректных заголовков используется:

```text
server/src/utils/professionGenitive.js
```

Исключения:

```text
server/src/data/professionGenitiveOverrides.js
```

Очередь профессий:

```text
server/src/data/professionQueue.json
```

Если профессия склоняется неверно, её можно добавить в файл исключений.

Пример:

```js
{
  "визажист": "визажиста"
}
```

---

## Исправление заголовков уже созданных инструкций

Предпросмотр:

```bash
node scripts/fix-generated-titles.js
```

Применить изменения:

```bash
node scripts/fix-generated-titles.js --write
```

Скрипт предназначен для исправления автоматически сгенерированных инструкций, в частности записей с:

```json
{
  "source": "generated"
}
```

Загруженные инструкции (`source: "uploaded"`) и seed-инструкции не следует изменять без необходимости.

---

# Загрузка инструкций

На frontend используется:

```text
AddInstructionButton
```

Запрос:

```http
POST /api/instructions/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

Поддерживаемые поля:

```text
title
profession
file
content
```

---

## Поддерживаемые форматы

Поддерживаются:

- PDF
- DOCX
- TXT
- MD

Извлечение текста выполняется в:

```text
server/src/services/documentTextExtractor.js
```

Используются:

- PDF → `pdf-parse`
- DOCX → `mammoth`
- TXT / MD → чтение текста напрямую

Формат `.doc` напрямую не поддерживается. Такой файл необходимо предварительно преобразовать в `.docx` или `.pdf`.

Текущий лимит загрузки задаётся в:

```text
server/src/routes/instructions.js
```

В исходном описании проекта указан лимит **15 МБ**.

OCR для сканированных PDF автоматически не выполняется.

После загрузки инструкция получает признаки вроде:

```json
{
  "source": "uploaded",
  "uploadedBy": "admin"
}
```

Также может сохраняться тип файла и оригинальное имя.

---

# Хранилище инструкций

Инструкции хранятся в:

```text
server/src/data/instructions/
```

Каждая инструкция — отдельный JSON-файл.

Репозиторий:

```text
server/src/services/instructionsRepository.js
```

Основные методы:

```text
getAll
getById
save
```

Также в проекте используется удаление инструкций через API.

---

# Автоматическая генерация

Автоматическая генерация реализована через `node-cron`.

Основные файлы:

```text
server/src/jobs/dailyGenerationJob.js
server/src/services/scheduledGenerationService.js
```

Cron запускается из:

```text
server/src/index.js
```

Расписание задаётся переменной:

```env
DAILY_GENERATION_CRON=
```

Примеры:

Каждый час:

```env
DAILY_GENERATION_CRON=0 * * * *
```

Каждые 2 часа:

```env
DAILY_GENERATION_CRON=0 */2 * * *
```

Три раза в сутки:

```env
DAILY_GENERATION_CRON=0 3,11,19 * * *
```

---

## Очередь профессий

Очередь хранится в:

```text
server/src/data/professionQueue.json
```

В исходном описании проекта указано около **180 профессий**.

При темпе около **24 инструкций в сутки** полная обработка такой очереди занимает ориентировочно 7–8 дней.

---

## `runScheduledGeneration()`

Сервис:

```text
server/src/services/scheduledGenerationService.js
```

Логика:

1. Берёт следующую профессию из `professionQueue.json`.
2. Проверяет наличие уже существующей инструкции.
3. Если инструкция есть — профессия пропускается.
4. Если инструкции нет — вызывается YandexGPT.
5. Сгенерированная инструкция сохраняется в `server/src/data/instructions/`.
6. Для результата может указываться источник запуска.

Например:

```json
{
  "generatedBy": "schedule"
}
```

или:

```json
{
  "generatedBy": "admin"
}
```

---

# Защита от дублей и параллельной генерации

ID инструкции формируется с использованием:

```text
slugify(profession)
```

Файл:

```text
server/src/utils/slug.js
```

Для защиты от одновременной генерации одной и той же профессии используется:

```text
server/src/services/generationLock.js
```

Перед генерацией необходимо проверять существующую инструкцию и не создавать дубли.

---

# Настройка Yandex Cloud

В `server/.env`:

```env
YANDEX_API_KEY=
YANDEX_FOLDER_ID=
YANDEX_GPT_MODEL=yandexgpt/latest
```

Yandex Cloud:

```text
https://console.yandex.cloud
```

Для API-ключа требуются права на использование Yandex Foundation Models.

Если `YANDEX_API_KEY` или `YANDEX_FOLDER_ID` не настроены, генерация через YandexGPT недоступна.

---

# Пример `server/.env`

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

Для production необходимо заменить `CLIENT_ORIGIN` на реальный адрес frontend.

---

# Redux

Redux расположен в:

```text
client/src/store/
```

Используется обычный `redux` + `redux-thunk`.

Корневой reducer:

```js
combineReducers({
  auth,
  instructions
})
```

---

## `auth`

Файл:

```text
client/src/store/authSlice.js
```

Отвечает за:

- авторизацию;
- выход;
- восстановление сессии;
- данные пользователя;
- JWT.

Thunk-функции:

```text
login
logout
restoreSession
```

---

## `instructions`

Файл:

```text
client/src/store/instructionsSlice.js
```

Отвечает за:

- список инструкций;
- поиск;
- получение инструкции;
- генерацию;
- загрузку;
- удаление.

Thunk-функции:

```text
searchInstructions
fetchInstruction
generateInstruction
uploadInstruction
deleteInstruction
```

---

# Ссылка на основной сайт

Компонент:

```text
client/src/components/SiteLinkButton/SiteLinkButton.jsx
```

В исходном описании проекта ссылка ведёт на:

```text
https://boykovgroup.ru
```

Адрес может задаваться через:

```env
VITE_SITE_URL=
```

в `client/.env`.

---

# Seed-данные

В:

```text
server/src/data/instructions/
```

находятся стартовые JSON-инструкции.

Очередь для автоматической генерации:

```text
server/src/data/professionQueue.json
```

---

# Production

Для production frontend должен обращаться к backend через относительные URL:

```text
/api/...
```

Не следует использовать:

```text
http://localhost:4000
```

или:

```text
http://api/...
```

на HTTPS-сайте.

---

# Beget / Passenger

При размещении backend на Beget через Passenger приложение запускается как Node.js-приложение под `mod_passenger`.

Для такого размещения внутренний `node-cron` может быть ненадёжным, если Passenger выгружает процесс приложения при простое.

Для стабильной автоматической генерации в production предпочтительнее использовать системный Cron Beget, который запускает отдельный скрипт или вызывает защищённый endpoint плановой генерации.

---

# Важные замечания

- Не хранить реальные API-ключи в Git.
- Не коммитить `server/.env`.
- Не хранить пароль администратора в исходном коде.
- После изменения `server/.env` backend необходимо перезапустить.
- При изменении frontend production-сборку необходимо пересобрать.
- Для HTTPS использовать только безопасные URL.
