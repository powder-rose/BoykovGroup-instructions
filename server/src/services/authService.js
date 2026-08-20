import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || "dev-insecure-secret-change-me";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h";

function getAdminCredentials() {
  return {
    login: process.env.ADMIN_LOGIN,
    passwordHash: process.env.ADMIN_PASSWORD_HASH,
  };
}

/** Настроена ли учётная запись админа (заданы ADMIN_LOGIN и ADMIN_PASSWORD_HASH). */
export function isAdminConfigured() {
  const { login, passwordHash } = getAdminCredentials();
  return Boolean(login && passwordHash);
}

/** Сверяет логин/пароль с единственной учётной записью админа из server/.env. */
export function verifyAdminCredentials(login, password) {
  const { login: adminLogin, passwordHash } = getAdminCredentials();
  if (!adminLogin || !passwordHash) return false;
  if (login !== adminLogin) return false;
  try {
    return bcrypt.compareSync(password, passwordHash);
  } catch {
    return false;
  }
}

export function issueAdminToken() {
  return jwt.sign({ sub: "admin", role: "admin" }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

/** Бросает исключение, если токен невалиден или просрочен. */
export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}