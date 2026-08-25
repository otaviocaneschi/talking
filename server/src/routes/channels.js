const express = require('express');
const { getDatabase } = require('../database/init');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Require auth for all routes
router.use(authMiddleware);

/**
 * GET /api/channels?server_id=X
 * Retorna todos os canais de um servidor, separados por tipo.
 */
router.get('/', (req, res) => {
    const { server_id } = req.query;
    
    if (!server_id) {
        return res.status(400).json({ error: 'server_id é obrigatório na query.' });
    }
    
    const db = getDatabase();

    // Verify membership
    const isMember = db.prepare('SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?').get(server_id, req.user.id);
    if (!isMember) {
        return res.status(403).json({ error: 'Você não tem acesso a este servidor.' });
    }

    const channels = db.prepare(`
        SELECT id, name, type, created_at, server_id
        FROM channels
        WHERE server_id = ?
        ORDER BY type ASC, id ASC
    `).all(server_id);

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
 * Cria um novo canal em um servidor. Apenas o dono do servidor pode criar (ou admin global).
 * Body: { server_id, name, type }
 */
router.post('/', (req, res) => {
    const { server_id, name, type } = req.body;

    if (!server_id || !name || !type) {
        return res.status(400).json({ error: 'server_id, name e type são obrigatórios.' });
    }

    if (!['text', 'voice'].includes(type)) {
        return res.status(400).json({ error: 'Tipo deve ser "text" ou "voice".' });
    }

    const db = getDatabase();

    try {
        const server = db.prepare('SELECT owner_id FROM servers WHERE id = ?').get(server_id);
        if (!server) {
            return res.status(404).json({ error: 'Servidor não encontrado.' });
        }
        
        if (server.owner_id !== req.user.id && !req.user.is_admin) {
            return res.status(403).json({ error: 'Apenas o dono do servidor pode criar canais.' });
        }

        const stmt = db.prepare('INSERT INTO channels (server_id, name, type) VALUES (?, ?, ?)');
        const result = stmt.run(server_id, name, type);

        res.status(201).json({
            id: result.lastInsertRowid,
            server_id,
            name,
            type,
        });
    } catch (error) {
        console.error('Error creating channel:', error);
        res.status(500).json({ error: 'Erro ao criar canal.' });
    }
});

module.exports = router;
