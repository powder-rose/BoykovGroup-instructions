import { Router } from "express";
import { verifyAdminCredentials, issueAdminToken, isAdminConfigured } from "../services/authService.js";

export const authRouter = Router();

// POST /api/auth/login { login, password } -> { token, user }
authRouter.post("/login", (req, res) => {
  const { login, password } = req.body ?? {};
  if (!login || !password) {
    return res.status(400).json({ error: "Укажите логин и пароль" });
  }

  if (!isAdminConfigured()) {
    return res.status(503).json({
      error:
        "Учётная запись администратора не настроена на сервере (ADMIN_LOGIN / ADMIN_PASSWORD_HASH в server/.env)",
    });
  }

  if (!verifyAdminCredentials(login, password)) {
    return res.status(401).json({ error: "Неверный логин или пароль" });
  }

  const token = issueAdminToken();
  res.json({ token, user: { login, role: "admin" } });
});

// GET /api/auth/me — проверка токена при загрузке страницы (req.user кладёт middleware attachUser)
authRouter.get("/me", (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: "Не авторизован" });
  }
  res.json({ user: { login: req.user.sub, role: req.user.role } });
});