export const ACCEPTED_EXTENSIONS =
    ".pdf,.doc,.docx,.txt,.md";

export const MAX_FILE_SIZE =
    15 * 1024 * 1024;

export const MAX_FILES =
    5000;

/*
 * Backend допускает 20 файлов,
 * но дополнительно ограничиваем примерный
 * размер одного HTTP multipart request.
 */
const MAX_CHUNK_FILES =
    20;

const MAX_CHUNK_BYTES =
    40 * 1024 * 1024;

export const POLL_INTERVAL =
    700;

export const ACTIVE_BATCH_KEY =
    "boykovdocs_active_bulk_import_id";


export function sleep(ms) {
    return new Promise(
        (resolve) =>
            setTimeout(resolve, ms)
    );
}


export function makeChunks(files) {

    const chunks = [];

    let current = [];
    let currentBytes = 0;


    for (const file of files) {

        const shouldStartNewChunk =
            current.length > 0 &&
            (
                current.length >=
                MAX_CHUNK_FILES
                ||
                currentBytes +
                    file.size >
                MAX_CHUNK_BYTES
            );


        if (shouldStartNewChunk) {

            chunks.push(current);

            current = [];
            currentBytes = 0;

        }


        current.push(file);

        currentBytes +=
            file.size;

    }


    if (current.length) {
        chunks.push(current);
    }


    return chunks;
}


export function getStatusText(
    phase,
    progress
) {

    switch (phase) {

        case "creating":
            return "Создание пакетного импорта...";

        case "uploading":
            return "Загрузка файлов на сервер...";

        case "starting":
            return "Запуск обработки...";

        case "processing":
            return "Обработка документов...";

        case "stopping":
            return "Останавливаем импорт...";

        case "paused":
            return "Импорт остановлен";

        case "completed":
            if (progress?.failed) {
                return "Импорт завершён с ошибками";
            }

            return "Импорт успешно завершён";

        case "error":
            return "Ошибка массового импорта";

        default:
            return "";
    }
}
