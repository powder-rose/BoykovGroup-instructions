import "dotenv/config";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import { instructionsRouter } from "./routes/instructions.js";
import { authRouter } from "./routes/auth.js";
import { attachUser } from "./middleware/auth.js";
import { isYandexGptConfigured } from "./services/yandexGptService.js";
import { isAdminConfigured } from "./services/authService.js";
import { startDailyGenerationJob } from "./jobs/dailyGenerationJob.js";

const app = express();
const PORT = process.env.PORT || 4000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json());
app.use(morgan("dev"));
app.use(attachUser);

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    yandexGptConfigured: isYandexGptConfigured(),
    adminConfigured: isAdminConfigured(),
  });
});

app.use("/api/auth", authRouter);
app.use("/api/instructions", instructionsRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Маршрут не найден" });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Внутренняя ошибка сервера" });
});

app.listen(PORT, () => {
  console.log(`Instructions API запущен на http://localhost:${PORT}`);
  if (!isYandexGptConfigured()) {
    console.warn(
      "YandexGPT не настроен (нет YANDEX_API_KEY/YANDEX_FOLDER_ID) — генерация недостающих инструкций будет недоступна."
    );
  }
  if (!isAdminConfigured()) {
    console.warn(
      "Учётная запись админа не настроена (нет ADMIN_LOGIN/ADMIN_PASSWORD_HASH) — вход в панель будет недоступен."
    );
  }

  startDailyGenerationJob();
});
