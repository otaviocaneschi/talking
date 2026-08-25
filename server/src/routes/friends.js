const express = require('express');
const { getDatabase } = require('../database/init');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Todas as rotas precisam de autenticação
router.use(authMiddleware);

/**
 * GET /api/friends
 * Retorna todos os amigos do usuário logado
 */
router.get('/', (req, res) => {
    const db = getDatabase();
    
    try {
        const friends = db.prepare(`
            SELECT 
                u.id, 
                u.username, 
                u.display_name, 
                u.avatar_color
            FROM friends f
            JOIN users u ON (
                (f.user_id_1 = ? AND f.user_id_2 = u.id) OR 
                (f.user_id_2 = ? AND f.user_id_1 = u.id)
            )
        `).all(req.user.id, req.user.id);
        
        res.json(friends);
    } catch (err) {
        console.error('Error fetching friends:', err);
        res.status(500).json({ error: 'Erro ao buscar amigos.' });
    }
});

/**
 * POST /api/friends/add
 * Adiciona um amigo pelo username
 * Body: { username }
 */
router.post('/add', (req, res) => {
    const { username } = req.body;
    
    if (!username) {
        return res.status(400).json({ error: 'Username é obrigatório.' });
    }
    
    if (username.toLowerCase() === req.user.username.toLowerCase()) {
        return res.status(400).json({ error: 'Você não pode adicionar a si mesmo.' });
    }
    
    const db = getDatabase();
    
    try {
        // Encontra o usuário
        const targetUser = db.prepare('SELECT id, username FROM users WHERE LOWER(username) = ?').get(username.toLowerCase());
        
        if (!targetUser) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }
        
        // Verifica se já são amigos
        const user1 = Math.min(req.user.id, targetUser.id);
        const user2 = Math.max(req.user.id, targetUser.id);
        
        const existing = db.prepare('SELECT 1 FROM friends WHERE user_id_1 = ? AND user_id_2 = ?').get(user1, user2);
        
        if (existing) {
            return res.status(400).json({ error: 'Vocês já são amigos!' });
        }
        
        // Insere a amizade
        db.prepare('INSERT INTO friends (user_id_1, user_id_2) VALUES (?, ?)').run(user1, user2);
        
        res.json({ success: true, message: `Você agora é amigo de ${targetUser.username}.` });
    } catch (err) {
        console.error('Error adding friend:', err);
        res.status(500).json({ error: 'Erro ao adicionar amigo.' });
    }
});

module.exports = router;
