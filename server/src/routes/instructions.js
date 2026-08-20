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

const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024; // 15 
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES },
});

instructionsRouter.get("/", (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const page = Number.parseInt(req.query.page, 10) || 1;
  const pageSize = Number.parseInt(req.query.pageSize, 10) || 6;

  const result = searchInstructions(q, { page, pageSize });
  res.json(result);
});

instructionsRouter.get("/:id", (req, res) => {
  const instruction = instructionsRepository.getById(req.params.id);
  if (!instruction) {
    return res.status(404).json({ error: "  " });
  }
  res.json(instruction);
});

instructionsRouter.post("/generate", requireAdmin, async (req, res) => {
  const profession = String(req.body?.profession ?? "").trim();
  if (!profession) {
    return res.status(400).json({ error: " profession " });
  }

  if (!isYandexGptConfigured()) {
    return res.status(503).json({
      error:
        "YandexGPT    .  YANDEX_API_KEY  YANDEX_FOLDER_ID  server/.env   .",
    });
  }

  const id = slugify(profession) || `instruction-${Date.now()}`;

  const existing = instructionsRepository.getById(id);
  if (existing) {
    return res.json(existing);
  }

  try {
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
    console.error("    YandexGPT:", err);
    res.status(502).json({ error: `   : ${err.message}` });
  }
});

instructionsRouter.post(
  "/upload",
  requireAdmin,
  (req, res, next) => {
    upload.array("files", 50)(req, res, (err) => {
      if (!err) return next();
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          error: `     ${Math.round(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024))} `,
        });
      }
      res.status(400).json({ error: `   : ${err.message}` });
    });
  },
  async (req, res) => {
    const title = String(req.body?.title ?? "").trim();
    const profession = String(req.body?.profession ?? "").trim();
    const manualContent = String(req.body?.content ?? "").trim();

    if (!title) {
      return res.status(400).json({ error: " title ( ) " });
    }
    if (!profession) {
      return res.status(400).json({ error: " profession " });
    }
    if (!req.files && !manualContent) {
      return res.status(400).json({ error: "      " });
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
          "       , ,      ().       .",
      });
    }

    const id = `${slugify(title) || "instruction"}-${nanoid(6)}`;

    const instruction = {
      id,
      title,
      profession,
      intro: "",
      sections: [{ number: 1, heading: " ", paragraphs }],
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

instructionsRouter.put("/:id", requireAdmin, (req, res) => {

  const existing = instructionsRepository.getById(req.params.id);

  if (!existing) {
    return res.status(404).json({
      error: "  "
    });
  }


  const updated = {

    ...existing,

    ...req.body,


    id: existing.id,


  version: existing.version
  ? (Number(existing.version) + 0.1).toFixed(1)
  : "1.1",

    updatedAt: new Date().toISOString()

  };


  instructionsRepository.save(updated);


  res.json(updated);

});

// DELETE /api/instructions/:id   .  .
instructionsRouter.delete("/:id", requireAdmin, (req, res) => {
  const existing = instructionsRepository.getById(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: "  " });
  }
  instructionsRepository.remove(req.params.id);
  res.status(204).end();
});

// POST /api/instructions/run-scheduled-generation
//     ,     
// (jobs/dailyGenerationJob.js)      
//  server/src/data/professionQueue.json     .
//   ,      .  .
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
