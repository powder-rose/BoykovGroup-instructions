# Резервная копия и внедрение структуры

Функции каталогов, назначений, CSV, публичных страниц и приёмки готовы в коде. Следующий этап —
проверенная копия актуальных данных, импорт в изолированной тестовой среде и фактическая приёмка.
Команды ниже не применяют CSV и не публикуют структуру автоматически.

## Что сохраняется и проверяется

Manifest версии 1.2 включает данные относительно корня репозитория:

| Путь              | Содержимое                                                                 |
| ----------------- | -------------------------------------------------------------------------- |
| `server/src/data` | Инструкции, черновики, история и остальные данные приложения в этом дереве |
| `server/data`     | Учётные записи, профиль, баланс, runtime-реестр и журнал операций          |
| `server/uploads`  | Исходники загрузок, манифесты и файлы очереди пакетного импорта            |

`server/src/data` обязателен. `server/data` и `server/uploads` могут отсутствовать на свежей
установке; отсутствие фиксируется в отчёте. В существующей установке неожиданно отсутствующий
каталог требует проверки источника и Docker mounts. Команда не создаёт его в источнике.

Новый CLI создаёт `.tar.gz` и SHA-256, распаковывает **созданный им архив** в новую папку
`restored/`, сравнивает состав и содержимое восстановленных файлов и повторно проверяет источник.
Успех записывается в `recovery.json` со статусом `verified`. Отчёт содержит сведения о составе
и контрольные суммы; папка результата и архив предназначены для закрытого хранения.
Понадобится место как для архива, так и для распакованной копии. Проверяются также базовые
права файлов; владельцы, ACL и расширенные атрибуты не входят в подтверждённый контракт.
Код завершения CLI: `0` — копия проверена, `1` — ошибка. При ошибке уже созданная папка
получает статус `incomplete`; такая копия не считается подтверждённой.

Это копия данных приложения. Код, `server/.env`, Nginx, Compose и TLS-сертификаты в неё
не входят. Зафиксируйте SHA кода, версию окружения и отдельно сохраните необходимые конфигурацию
и секреты по принятому на сервере порядку. Наличие функций в коде не подтверждает наличие
рабочей копии или внешнего расписания резервирования.

Папка результата должна быть новой и находиться вне источника; её родитель должен существовать.
В источнике допустимы обычные каталоги и файлы; ссылки и специальные файлы требуют отдельного
разбора. Команда не восстанавливает данные поверх рабочей базы и не запускает приложение.

## Согласованный источник

Остановите все процессы, меняющие сохраняемые данные: API, фоновые задания этого API,
внешние импорты и отдельные CLI/cron, если они работают на сервере. Дождитесь завершения
активных операций. Выберите обслуживаемое окно с учётом входящих заявок и платежей.

Флаг `--writers-stopped` фиксирует ваше подтверждение остановки писателей. Он сам не проверяет
Docker, не останавливает процессы и не блокирует сторонние программы. Повторная сверка файлов
выявляет изменение снимка, но не заменяет согласованную остановку писателей. Сохраняйте журнал
массовых операций вместе с остальными данными, не удаляйте lock/журналы для прохождения проверки.

## Локальная копия: PowerShell

Для прогона на своей согласованной копии нужны Node.js 22 и `tar` в PATH.
Терминал WebStorm должен быть открыт в корне проекта; путь должен содержать вложенный `server/`.
Это проверка вашей локальной копии, а не автоматическое резервирование VPS.
На Windows ограничьте доступ к папке результата средствами NTFS: права `0700/0600` не заменяют
ACL. Нативная совместимость с вашим Windows `tar` проверяется локальным прогоном.

```powershell
$ErrorActionPreference = 'Stop'
node --version
if ($LASTEXITCODE -ne 0) { throw 'Node.js is unavailable' }
tar --version
if ($LASTEXITCODE -ne 0) { throw 'tar is unavailable' }

$sourceRoot = (Get-Location).Path
$backupParent = 'C:\BoykovDocs-QA'
New-Item -ItemType Directory -Path $backupParent -Force | Out-Null
$backupPath = Join-Path $backupParent ('pre-taxonomy-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))

node server/scripts/createVerifiedDataBackup.js `
  --source-root $sourceRoot `
  --output-dir $backupPath `
  --writers-stopped

if ($LASTEXITCODE -ne 0) { throw 'Backup verification failed; preserve its output for review' }
```

При ошибке не считайте копию подтверждённой. Сохраните результат и сообщение ошибки для разбора;
не повторяйте команду с тем же `--output-dir`. Успешный запуск не разрешает публикацию сам по себе.

## VPS: использовать фактически смонтированные данные

В production Compose корень развёртывания содержит `app/` и `nginx/`.
Проверьте текущий каталог и реальные mounts, подставьте свои пути. Не заменяйте рабочие данные
содержимым архива исходников.

| На хосте относительно Compose | В API-контейнере |
| ----------------------------- | ---------------- |
| `app/server/src/data`         | `/app/src/data`  |
| `app/server/data`             | `/app/data`      |
| `app/server/uploads`          | `/app/uploads`   |

В контейнере `/app` — корень **сервера**, а `--source-root` ожидает корень **репозитория**
с вложенным `server/`. Поэтому обычный `--source-root /app` для API-контейнера неверен.

На хосте можно использовать Node.js 22 напрямую. Если Node на хосте не установлен, ниже показан
запуск только CLI через существующий локальный образ API. Исходный `app/` монтируется как `/source`
только для чтения, папка копий — отдельно. Основной сервер и его фоновые задания в этом контейнере
не запускаются; доступ к сети отключён. Скрипт читается из обновлённого checkout, а не из слоя образа.

Сначала, **до остановки API**, проверьте состояние и инструменты. Это команды Bash на VPS;
выполняйте их из каталога production Compose, после merge и переноса файлов этой партии.

```bash
set -euo pipefail
source_root="$(realpath ./app)"
backup_parent="$(pwd -P)/backups"
mkdir -p "$backup_parent"
chmod 700 "$backup_parent"
backup_parent="$(realpath "$backup_parent")"
backup_name="pre-taxonomy-$(date -u +%Y%m%dT%H%M%SZ)"
api_image="$(docker compose images -q api)"

[ -n "$api_image" ] || { echo 'No local API image found'; exit 1; }
[ -f "$source_root/server/scripts/createVerifiedDataBackup.js" ] || {
  echo 'Backup CLI is missing from the host checkout'
  exit 1
}

docker compose ps api
docker inspect boykovdocs-api --format '{{json .Mounts}}'
docker run --rm --network none --entrypoint sh "$api_image" -c 'node --version && tar --version'
```

Проверьте, что mounts указывают именно на `source_root/server/...`. Если внешние писатели есть,
остановите их своим штатным способом. После этого выполните следующий блок целиком:

```bash
stop_status=0
docker compose stop api || stop_status=$?
if [ "$stop_status" -ne 0 ]; then
  docker compose up -d --no-deps api || {
    echo 'Stop and restart failed: inspect the API immediately'
    exit 1
  }
  echo 'API stop failed; backup was not started'
  exit "$stop_status"
fi

backup_status=0
docker run --rm --network none --entrypoint node \
  --mount "type=bind,src=$source_root,dst=/source,readonly" \
  --mount "type=bind,src=$backup_parent,dst=/backup-output" \
  "$api_image" /source/server/scripts/createVerifiedDataBackup.js \
  --source-root /source \
  --output-dir "/backup-output/$backup_name" \
  --writers-stopped || backup_status=$?

restart_status=0
docker compose up -d --no-deps api || restart_status=$?

if [ "$restart_status" -ne 0 ]; then
  echo 'API restart failed: inspect docker compose ps and logs immediately'
  exit "$restart_status"
fi
if [ "$backup_status" -ne 0 ]; then
  echo 'Backup verification failed; the API was restarted and the output must be reviewed'
  exit "$backup_status"
fi

docker compose ps api
docker compose logs --tail 30 api
```

API перезапускается и после ошибки проверки. Возобновляйте отдельно остановленные внешние
процессы по своему штатному порядку, затем проверьте доступность сайта и обработку заявок.
Результат на хосте находится в `$backup_parent/$backup_name`; пути `/source` и `/backup-output`
в отчёте относятся к контейнерному запуску. Отсутствие `recovery.json` со статусом `verified`
не является подтверждённым результатом. Этот блок не настраивает cron и не развёртывает новую
версию сайта.

## Baseline и изолированный импорт

Сохраните успешную копию без изменений. В `restored/server/src/data/instructions` находятся
исходные опубликованные записи, в `restored/server/data` — реестр и журнал. Эту распаковку
можно использовать как baseline для сравнения «до/после»; рабочую тестовую копию создавайте
отдельно, чтобы импорт не менял проверенный baseline.

Для проверки JSON на Windows после безопасного переноса копии:

```powershell
$beforeInstructions = Join-Path $backupPath 'restored\server\src\data\instructions'
$beforeRegistry = Join-Path $backupPath 'restored\server\data\instruction-taxonomy.json'
$reportPath = Join-Path $backupParent ('baseline-check-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$checkArgs = @(
  'server/scripts/checkInstructionTaxonomyAcceptance.js'
  '--directory'
  $beforeInstructions
  '--origin'
  'https://boykovdocs.ru'
  '--output-dir'
  $reportPath
)
if (Test-Path -LiteralPath $beforeRegistry -PathType Leaf) {
  $checkArgs += @('--registry', $beforeRegistry)
}
node @checkArgs
if ($LASTEXITCODE -eq 1) { Write-Warning 'Review baseline findings before import' }
if ($LASTEXITCODE -eq 2) { throw 'Baseline check could not finish' }
```

Отсутствующий runtime-реестр здесь означает проверку seed. Если реестр ожидался, сначала
разберитесь, почему его нет: не используйте такой результат как доказательство рабочего состояния.
После импорта в тестовой среде задайте её актуальные инструкции как `--directory`, сохранённый
baseline как `--baseline-directory`, точный реестр как `--registry`. HTTP-режим и подробная
[приёмка](instruction-taxonomy-acceptance.md) остаются отдельными проверками.

Не запускайте тестовую копию с production `.env`. Штатный `server/src/index.js` сразу восстанавливает
оплаченные заказы, затем запускает worker импорта, worker уведомлений и ежедневные задания.
Единого флага отключения этих действий сейчас нет. `DAILY_GENERATION_CRON` и `DAILY_STATS_CRON`
меняют расписания, а не создают безопасный staging; у статистики есть запуск после старта.
`BULK_IMPORT_CONCURRENCY` не отключает worker.

Перед стартом полноценного тестового API подготовьте отдельную изменяемую копию, тестовые
учётные записи и очереди, отдельные JWT/admin-настройки, закрытый доступ и ограничение исходящей
сети. Не переносите рабочие `SMTP_USER`/`SMTP_PASS`, `CLOUDPAYMENTS_PUBLIC_ID`/`CLOUDPAYMENTS_API_SECRET`
и `YANDEX_API_KEY`/`YANDEX_FOLDER_ID`. Проверьте сохранённые очереди заказов, outbox уведомлений
и import batches до запуска. Тестовый адрес не должен принимать рабочие платёжные callbacks.
Оригинальные проверенные данные и отчёты сохраняйте отдельно; в Git они не входят.

В изолированной среде выполните CSV preview, проверьте допуск строк, примените подтверждённые
назначения, сохраните отчёт и проверьте откат. 63 спорные записи остаются исключёнными до
индивидуального решения. H01 остаётся без публикации до согласования URL. После этого выполните
HTTP-приёмку и ручные проверки, включая мобильные экраны, PDF и существующие сценарии оплаты.

## Откат

Для назначения разделов и тегов используйте предпросмотр отката в журнале операций: он сохраняет
более поздние изменения текста и SEO. Резервная копия нужна для восстановления данных при
повреждении или другой аварии; откат коммита не возвращает прежние назначения в runtime JSON.

`restored/` — проверенная отдельная распаковка созданного архива, а не автоматический перенос
в production. Перед аварийной заменой снова остановите всех писателей, сохраните текущее
состояние для разбора и сопоставьте версию кода, конфигурацию и все три дерева данных.
Переносите согласованный набор через штатную процедуру восстановления; не накладывайте файлы
на работающую базу и не восстанавливайте только один JSON из связанного журнала операции.
После замены перезапустите API и повторите проверку доступности и приёмку.

Копия данных в этой партии не содержит независимую копию `.env`, конфигурации Nginx/Compose
и TLS. Способ их восстановления и доступ к ним нужно подтвердить отдельно перед рабочим
внедрением. Успешные синтетические тесты кода не заменяют фактический `recovery.json`, отчёт
реального импорта и проверку рабочей резервной копии.
