const express = require('express');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../database/init');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

// ─── Rate Limiter (in-memory, per IP) ───────────────
const loginAttempts = new Map(); // Map<ip, { count, resetTime }>
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutos
const RATE_LIMIT_MAX = 10; // 10 tentativas por janela

function rateLimiter(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const entry = loginAttempts.get(ip);

    if (!entry || now > entry.resetTime) {
        loginAttempts.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return next();
    }

    if (entry.count >= RATE_LIMIT_MAX) {
        const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
        return res.status(429).json({
            error: `Muitas tentativas. Tente novamente em ${Math.ceil(retryAfter / 60)} minuto(s).`
        });
    }

    entry.count++;
    return next();
}

// Limpa entradas expiradas a cada 5 minutos
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of loginAttempts) {
        if (now > entry.resetTime) loginAttempts.delete(ip);
    }
}, 5 * 60 * 1000);

/**
 * POST /api/auth/login
 * 
 * Body: { username, password }
 * Response: { token, user: { id, username, display_name, avatar_color, is_admin } }
 */
router.post('/login', rateLimiter, (req, res) => {
    const { username, password } = req.body;

    // Validação
    if (!username || !password) {
        return res.status(400).json({ error: 'Username e senha são obrigatórios.' });
    }

    if (username.length > 32 || password.length > 128) {
        return res.status(400).json({ error: 'Dados inválidos.' });
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

/**
 * POST /api/auth/signup
 * 
 * Body: { username, password, display_name }
 * Response: { token, user }
 */
router.post('/signup', rateLimiter, (req, res) => {
    const { username, password, display_name } = req.body;

    if (!username || !password || !display_name) {
        return res.status(400).json({ error: 'Username, senha e nome de exibição são obrigatórios.' });
    }

    if (username.length > 32 || password.length > 128 || display_name.length > 32) {
        return res.status(400).json({ error: 'Dados muito longos.' });
    }

    if (password.length < 4) {
        return res.status(400).json({ error: 'A senha deve ter pelo menos 4 caracteres.' });
    }

    const db = getDatabase();

    // Check if user already exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
        return res.status(409).json({ error: 'Username já está em uso.' });
    }

    // Generate random avatar color
    const colors = ['#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245'];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    try {
        const info = db.prepare(`
            INSERT INTO users (username, display_name, password_hash, avatar_color)
            VALUES (?, ?, ?, ?)
        `).run(username, display_name, passwordHash, avatarColor);

        const newUser = {
            id: info.lastInsertRowid,
            username,
            display_name,
            avatar_color: avatarColor,
            is_admin: 0
        };

        const token = generateToken(newUser);

        res.status(201).json({
            token,
            user: newUser
        });
    } catch (err) {
        console.error('Error creating user:', err);
        res.status(500).json({ error: 'Erro ao criar usuário.' });
    }
});

module.exports = router;
