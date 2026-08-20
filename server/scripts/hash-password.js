// Утилита для генерации bcrypt-хеша пароля админа.
// Использование: node scripts/hash-password.js "мойНадёжныйПароль"
// Полученную строку нужно вставить в server/.env как ADMIN_PASSWORD_HASH.
import bcrypt from "bcryptjs";

const password = process.argv[2];

if (!password) {
  console.error("Использование: node scripts/hash-password.js <пароль>");
  process.exit(1);
}

console.log(bcrypt.hashSync(password, 10));