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
/**
 * DELETE /api/users/:id
 * Exclui um usuário. Apenas super admins.
 * As foreign keys com ON DELETE CASCADE apagam mensagens, amizades, etc.
 */
router.delete('/:id', authMiddleware, (req, res) => {
    // Apenas admins podem excluir
    if (!req.user.is_admin) {
        return res.status(403).json({ error: 'Apenas administradores podem excluir usuários.' });
    }

    const targetId = Number(req.params.id);

    // Não pode se auto-excluir
    if (targetId === Number(req.user.id)) {
        return res.status(400).json({ error: 'Você não pode excluir sua própria conta por aqui.' });
    }

    const db = getDatabase();

    try {
        const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(targetId);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        // Exclui o usuário (CASCADE cuida do resto)
        db.prepare('DELETE FROM users WHERE id = ?').run(targetId);

        console.log(`🗑️ Admin ${req.user.username} excluiu o usuário ${user.username} (ID: ${targetId})`);

        res.json({ success: true, message: `Usuário "${user.username}" excluído com sucesso.` });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Erro ao excluir usuário.' });
    }
});

/**
 * PUT /api/users/:id/admin
 * Promove ou rebaixa um usuário a admin. Apenas super admins.
 * Body: { is_admin: 0 | 1 }
 */
router.put('/:id/admin', authMiddleware, (req, res) => {
    if (!req.user.is_admin) {
        return res.status(403).json({ error: 'Apenas administradores podem alterar permissões.' });
    }

    const targetId = Number(req.params.id);
    const { is_admin } = req.body;

    if (is_admin !== 0 && is_admin !== 1) {
        return res.status(400).json({ error: 'Valor inválido para is_admin. Use 0 ou 1.' });
    }

    // Não pode remover o próprio admin
    if (targetId === Number(req.user.id) && is_admin === 0) {
        return res.status(400).json({ error: 'Você não pode remover seu próprio status de administrador.' });
    }

    const db = getDatabase();

    try {
        const user = db.prepare('SELECT id, username FROM users WHERE id = ?').get(targetId);
        if (!user) {
            return res.status(404).json({ error: 'Usuário não encontrado.' });
        }

        db.prepare('UPDATE users SET is_admin = ? WHERE id = ?').run(is_admin, targetId);

        const action = is_admin ? 'promovido a admin' : 'rebaixado de admin';
        console.log(`🛡️ Admin ${req.user.username} ${action}: ${user.username} (ID: ${targetId})`);

        res.json({ success: true, message: `Usuário "${user.username}" ${action}.` });
    } catch (error) {
        console.error('Error updating admin status:', error);
        res.status(500).json({ error: 'Erro ao alterar permissão.' });
    }
});

module.exports = router;
