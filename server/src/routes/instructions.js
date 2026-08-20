import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { nanoid } from "nanoid";
import { instructionsRepository } from "../services/instructionsRepository.js";
import { searchInstructions } from "../services/searchService.js";
import { generateInstructionWithYandexGpt, isYandexGptConfigured } from "../services/yandexGptService.js";
import { runScheduledGeneration } from "../services/scheduledGenerationService.js";
import { extractTextFromUpload, splitIntoParagraphs } from "../services/documentTextExtractor.js";
import { slugify } from "../utils/slug.js";
import { requireAdmin } from "../middleware/auth.js";
import { runExclusive } from "../services/generationLock.js";

export const instructionsRouter = Router();

const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024; // 15 МБ
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
});

// GET /api/instructions?q=...&page=1&pageSize=6
// Поиск выполняется полностью на сервере, клиент только отображает результат.
// Доступен всем, без авторизации.
instructionsRouter.get("/", (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const page = Number.parseInt(req.query.page, 10) || 1;
  const pageSize = Number.parseInt(req.query.pageSize, 10) || 6;

  const result = searchInstructions(q, { page, pageSize });
  res.json(result);
});

// GET /api/instructions/:id — полный текст одной инструкции. Тоже публичный маршрут.
instructionsRouter.get("/:id", (req, res) => {
  const instruction = instructionsRepository.getById(req.params.id);
  if (!instruction) {
    return res.status(404).json({ error: "Инструкция не найдена" });
  }
  res.json(instruction);
});

// POST /api/instructions/generate { profession: string }
// Генерирует недостающую инструкцию через YandexGPT и сохраняет её в базу.
// Управлять контентом (генерировать, удалять) может только админ.
instructionsRouter.post("/generate", requireAdmin, async (req, res) => {
  const profession = String(req.body?.profession ?? "").trim();
  if (!profession) {
    return res.status(400).json({ error: "Поле profession обязательно" });
  }

  if (!isYandexGptConfigured()) {
    return res.status(503).json({
      error:
        "YandexGPT не настроен на сервере. Задайте YANDEX_API_KEY и YANDEX_FOLDER_ID в server/.env и перезапустите сервер.",
    });
  }

  const id = slugify(profession) || `instruction-${Date.now()}`;

  const existing = instructionsRepository.getById(id);
  if (existing) {
    return res.json(existing);
  }

  try {
    // runExclusive: если генерация для этого же id уже идёт (например, эту же
    // профессию в этот момент подхватила автогенерация по расписанию, или
    // админ нажал кнопку дважды), второй вызов просто дождётся результата
    // первого вместо того, чтобы запускать YandexGPT ещё раз — см. generationLock.js.
    const instruction = await runExclusive(id, async () => {
      const alreadySaved = instructionsRepository.getById(id);
      if (alreadySaved) return alreadySaved;

      const generated = await generateInstructionWithYandexGpt(profession);
      const built = {
        id,
        title: generated.title,
        profession: generated.profession,
        intro: generated.intro,
        sections: generated.sections,
        source: "generated",
        generatedBy: "admin",
        createdAt: new Date().toISOString(),
      };
      instructionsRepository.save(built);
      return built;
    });
    res.status(201).json(instruction);
  } catch (err) {
    console.error("Ошибка генерации инструкции через YandexGPT:", err);
    res.status(502).json({ error: `Не удалось сгенерировать инструкцию: ${err.message}` });
  }
});

// POST /api/instructions/upload — добавление СВОЕЙ инструкции админом:
// либо файлом (multipart/form-data, поле "file": .pdf/.docx/.txt/.md),
// либо текстом вручную (поле "content"). Плюс обязательные текстовые поля
// title и profession. Только админ.
instructionsRouter.post(
  "/upload",
  requireAdmin,
  (req, res, next) => {
    // multer вызывает next(err) при превышении лимита размера и т.п. —
    // оборачиваем вручную, чтобы вернуть понятный JSON, а не общий 500.
    upload.single("file")(req, res, (err) => {
      if (!err) return next();
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          error: `Файл слишком большой — максимум ${Math.round(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024))} МБ`,
        });
      }
      res.status(400).json({ error: `Не удалось загрузить файл: ${err.message}` });
    });
  },
  async (req, res) => {
    const title = String(req.body?.title ?? "").trim();
    const profession = String(req.body?.profession ?? "").trim();
    const manualContent = String(req.body?.content ?? "").trim();

    if (!title) {
      return res.status(400).json({ error: "Поле title (название инструкции) обязательно" });
    }
    if (!profession) {
      return res.status(400).json({ error: "Поле profession обязательно" });
    }
    if (!req.file && !manualContent) {
      return res.status(400).json({ error: "Прикрепите файл или введите текст инструкции вручную" });
    }

    let rawText;
    let fileType = "manual";
    let originalFileName = null;

    try {
      if (req.file) {
        rawText = await extractTextFromUpload({
          buffer: req.file.buffer,
          originalName: req.file.originalname,
          mimetype: req.file.mimetype,
        });
        fileType = path.extname(req.file.originalname || "").replace(".", "").toLowerCase() || "file";
        originalFileName = req.file.originalname;
      } else {
        rawText = manualContent;
      }
    } catch (err) {
      return res.status(422).json({ error: err.message });
    }

    const paragraphs = splitIntoParagraphs(rawText);
    if (paragraphs.length === 0) {
      return res.status(422).json({
        error:
          "Не удалось извлечь текст — файл пустой или, возможно, это скан без текстового слоя (изображение). Попробуйте другой файл или введите текст вручную.",
      });
    }

    const id = `${slugify(title) || "instruction"}-${nanoid(6)}`;

    const instruction = {
      id,
      title,
      profession,
      intro: "",
      sections: [{ number: 1, heading: "Текст инструкции", paragraphs }],
      source: "uploaded",
      uploadedBy: "admin",
      fileType,
      originalFileName,
      createdAt: new Date().toISOString(),
    };

    instructionsRepository.save(instruction);
    res.status(201).json(instruction);
  }
);

// DELETE /api/instructions/:id — удаление инструкции. Только админ.
instructionsRouter.delete("/:id", requireAdmin, (req, res) => {
  const existing = instructionsRepository.getById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: "Инструкция не найдена" });
  }
  instructionsRepository.remove(req.params.id);
  res.status(204).end();
});

// POST /api/instructions/run-scheduled-generation
// Вручную запускает тот же процесс, что и ежедневное фоновое задание
// (jobs/dailyGenerationJob.js) — берёт следующую недостающую профессию из
// очереди server/src/data/professionQueue.json и генерирует по ней инструкцию.
// Полезно для проверки, не дожидаясь ночного запуска по расписанию. Только админ.
instructionsRouter.post("/run-scheduled-generation", requireAdmin, async (req, res) => {
  const result = await runScheduledGeneration();

  if (result.status === "generated") {
    return res.status(201).json(result.instruction);
  }
  if (result.status === "skipped") {
    return res.status(200).json({ message: result.reason });
  }
  res.status(502).json({ error: result.reason });
});