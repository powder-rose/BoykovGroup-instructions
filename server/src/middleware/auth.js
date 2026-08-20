import { verifyToken } from "../services/authService.js";

/**
 * Достаёт и проверяет Bearer-токен из заголовка Authorization, если он есть,
 * и кладёт его payload в req.user. Ничего не требует сама по себе —
 * подключена глобально, чтобы req.user был доступен во всех роутах;
 * доступ реально ограничивает requireAdmin ниже.
 */
export function attachUser(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");
  if (scheme === "Bearer" && token) {
    try {
      req.user = verifyToken(token);
    } catch {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}

/** Пропускает дальше только запросы с валидным токеном админа. */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") {
    return res.status(401).json({ error: "Требуется авторизация администратора" });
  }
  next();
}