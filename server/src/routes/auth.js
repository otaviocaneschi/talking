const express = require('express');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../database/init');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * POST /api/auth/login
 * 
 * Body: { username, password }
 * Response: { token, user: { id, username, display_name, avatar_color, is_admin } }
 */
router.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Validação
    if (!username || !password) {
        return res.status(400).json({ error: 'Username e senha são obrigatórios.' });
    }

    const db = getDatabase();

    // Busca o usuário
    const user = db.prepare(`
        SELECT id, username, display_name, password_hash, avatar_color, is_admin
        FROM users
        WHERE username = ?
    `).get(username);

    if (!user) {
        return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    // Verifica a senha
    const isValid = bcrypt.compareSync(password, user.password_hash);
    if (!isValid) {
        return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    // Gera o token JWT
    const token = generateToken(user);

    // Retorna o token e os dados do usuário (sem o hash da senha)
    res.json({
        token,
        user: {
            id: user.id,
            username: user.username,
            display_name: user.display_name,
            avatar_color: user.avatar_color,
            is_admin: user.is_admin,
        },
    });
});

module.exports = router;
