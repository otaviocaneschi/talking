const express = require('express');
const { getDatabase } = require('../database/init');
const { authMiddleware } = require('../middleware/auth');
const { onlineUsers } = require('../socket/chat');

function notifyUser(req, userId) {
    const io = req.app.get('io');
    if (!io) return;
    const targetId = Number(userId);
    for (const [socketId, userData] of onlineUsers.entries()) {
        if (Number(userData.id) === targetId) {
            io.to(socketId).emit('friend:update');
        }
    }
}

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
                u.avatar_color,
                f.status,
                f.sender_id
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
        
        const existing = db.prepare('SELECT status, sender_id FROM friends WHERE user_id_1 = ? AND user_id_2 = ?').get(user1, user2);
        
        if (existing) {
            if (existing.status === 'accepted') {
                return res.status(400).json({ error: 'Vocês já são amigos!' });
            }
            if (existing.sender_id === req.user.id) {
                return res.status(400).json({ error: 'Você já enviou um pedido de amizade para este usuário.' });
            }
            // Se o outro enviou um pedido que está pendente, aceitamos
            db.prepare('UPDATE friends SET status = ? WHERE user_id_1 = ? AND user_id_2 = ?').run('accepted', user1, user2);
            
            notifyUser(req, user1);
            notifyUser(req, user2);
            
            return res.json({ success: true, message: `Você agora é amigo de ${targetUser.username}.` });
        }
        
        // Insere a solicitação de amizade
        db.prepare('INSERT INTO friends (user_id_1, user_id_2, status, sender_id) VALUES (?, ?, ?, ?)').run(user1, user2, 'pending', req.user.id);
        
        notifyUser(req, user1);
        notifyUser(req, user2);
        
        res.json({ success: true, message: `Pedido de amizade enviado para ${targetUser.username}.` });
    } catch (err) {
        console.error('Error adding friend:', err);
        res.status(500).json({ error: 'Erro ao adicionar amigo.' });
    }
});

/**
 * POST /api/friends/accept
 * Aceita um pedido de amizade
 * Body: { targetUserId }
 */
router.post('/accept', (req, res) => {
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ error: 'ID do usuário alvo é obrigatório.' });

    const db = getDatabase();
    const user1 = Math.min(req.user.id, targetUserId);
    const user2 = Math.max(req.user.id, targetUserId);

    try {
        const existing = db.prepare('SELECT status, sender_id FROM friends WHERE user_id_1 = ? AND user_id_2 = ?').get(user1, user2);
        
        if (!existing || existing.status !== 'pending') {
            return res.status(404).json({ error: 'Pedido de amizade não encontrado.' });
        }
        if (existing.sender_id === req.user.id) {
            return res.status(400).json({ error: 'Você não pode aceitar um pedido que você mesmo enviou.' });
        }

        db.prepare('UPDATE friends SET status = ? WHERE user_id_1 = ? AND user_id_2 = ?').run('accepted', user1, user2);
        
        notifyUser(req, user1);
        notifyUser(req, user2);
        
        res.json({ success: true, message: 'Pedido de amizade aceito.' });
    } catch (err) {
        console.error('Error accepting friend:', err);
        res.status(500).json({ error: 'Erro ao aceitar pedido.' });
    }
});

/**
 * POST /api/friends/reject
 * Recusa (ou cancela/remove) uma amizade
 * Body: { targetUserId }
 */
router.post('/reject', (req, res) => {
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ error: 'ID do usuário alvo é obrigatório.' });

    const db = getDatabase();
    const user1 = Math.min(req.user.id, targetUserId);
    const user2 = Math.max(req.user.id, targetUserId);

    try {
        const result = db.prepare('DELETE FROM friends WHERE user_id_1 = ? AND user_id_2 = ?').run(user1, user2);
        
        if (result.changes > 0) {
            notifyUser(req, user1);
            notifyUser(req, user2);
        }

        res.json({ success: true, message: 'Amizade/Pedido removido.' });
    } catch (err) {
        console.error('Error rejecting friend:', err);
        res.status(500).json({ error: 'Erro ao remover amizade/pedido.' });
    }
});

module.exports = router;
