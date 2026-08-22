const express = require('express');
const { getDatabase } = require('../database/init');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/channels
 * Retorna todos os canais, separados por tipo.
 * Requer autenticação JWT.
 */
router.get('/', authMiddleware, (req, res) => {
    const db = getDatabase();

    const channels = db.prepare(`
        SELECT id, name, type, created_at
        FROM channels
        ORDER BY type ASC, id ASC
    `).all();

    // Separa por tipo para facilitar no frontend
    const textChannels = channels.filter(c => c.type === 'text');
    const voiceChannels = channels.filter(c => c.type === 'voice');

    res.json({
        text: textChannels,
        voice: voiceChannels,
        all: channels,
    });
});

/**
 * POST /api/channels
 * Cria um novo canal. Apenas admins.
 * Body: { name, type }
 */
router.post('/', authMiddleware, (req, res) => {
    if (!req.user.is_admin) {
        return res.status(403).json({ error: 'Apenas administradores podem criar canais.' });
    }

    const { name, type } = req.body;

    if (!name || !type) {
        return res.status(400).json({ error: 'Nome e tipo são obrigatórios.' });
    }

    if (!['text', 'voice'].includes(type)) {
        return res.status(400).json({ error: 'Tipo deve ser "text" ou "voice".' });
    }

    const db = getDatabase();

    try {
        const stmt = db.prepare('INSERT INTO channels (name, type) VALUES (?, ?)');
        const result = stmt.run(name, type);

        res.status(201).json({
            id: result.lastInsertRowid,
            name,
            type,
        });
    } catch (error) {
        if (error.message.includes('UNIQUE')) {
            return res.status(409).json({ error: 'Já existe um canal com este nome.' });
        }
        throw error;
    }
});

module.exports = router;
