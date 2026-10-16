import { getUserById } from '../services/userService.js';

export function createRequirePdfAccess({ userLookup = getUserById } = {}) {
  return function requirePdfAccess(req, res, next) {
    res.set('Cache-Control', 'private, no-store');

    if (!req.user) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    if (req.user.role === 'admin') {
      return next();
    }

    if (req.user.role !== 'user' || !req.user.sub) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const user = userLookup(req.user.sub);

    if (!user) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    return next();
  };
}

export const requirePdfAccess = createRequirePdfAccess();
