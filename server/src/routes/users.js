const express = require('express');
const { getDatabase } = require('../database/init');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/users
 * Retorna a lista de todos os usuários (sem dados sensíveis).
 * Requer autenticação JWT.
 */
router.get('/', authMiddleware, (req, res) => {
    const db = getDatabase();

    const users = db.prepare(`
        SELECT id, username, display_name, avatar_color, is_admin, created_at
        FROM users
        ORDER BY display_name ASC
    `).all();

    res.json(users);
});

/**
 * GET /api/users/me
 * Retorna os dados do usuário autenticado.
 */
router.get('/me', authMiddleware, (req, res) => {
    const db = getDatabase();

    const user = db.prepare(`
        SELECT id, username, display_name, avatar_color, is_admin, created_at
        FROM users
        WHERE id = ?
    `).get(req.user.id);

    if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    res.json(user);
});

module.exports = router;
