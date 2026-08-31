const express = require('express');
const { getDatabase } = require('../database/init');
const { authMiddleware } = require('../middleware/auth');
const crypto = require('crypto');

const router = express.Router();

// All routes require auth
router.use(authMiddleware);

/**
 * GET /api/servers
 * Returns all servers the user is a member of
 */
router.get('/', (req, res) => {
    const db = getDatabase();
    
    try {
        const servers = db.prepare(`
            SELECT s.id, s.name, s.owner_id, s.invite_code, s.created_at
            FROM servers s
            JOIN server_members sm ON s.id = sm.server_id
            WHERE sm.user_id = ?
        `).all(req.user.id);
        
        res.json(servers);
    } catch (err) {
        console.error('Error fetching servers:', err);
        res.status(500).json({ error: 'Erro ao buscar servidores.' });
    }
});

/**
 * POST /api/servers
 * Creates a new server and adds the user as owner/member.
 * Also creates default channels.
 * 
 * Body: { name }
 */
router.post('/', (req, res) => {
    const { name } = req.body;
    
    if (!name) {
        return res.status(400).json({ error: 'Nome do servidor é obrigatório.' });
    }
    
    const db = getDatabase();
    const inviteCode = crypto.randomBytes(4).toString('hex');
    
    try {
        // Use a transaction
        const createServer = db.transaction(() => {
            const serverInfo = db.prepare(`
                INSERT INTO servers (name, owner_id, invite_code)
                VALUES (?, ?, ?)
            `).run(name, req.user.id, inviteCode);
            
            const serverId = serverInfo.lastInsertRowid;
            
            // Add user as member
            db.prepare(`
                INSERT INTO server_members (server_id, user_id)
                VALUES (?, ?)
            `).run(serverId, req.user.id);
            
            // Create default channels
            db.prepare(`
                INSERT INTO channels (server_id, name, type)
                VALUES (?, 'geral', 'text')
            `).run(serverId);
            
            db.prepare(`
                INSERT INTO channels (server_id, name, type)
                VALUES (?, 'Geral', 'voice')
            `).run(serverId);
            
            return {
                id: serverId,
                name,
                owner_id: req.user.id,
                invite_code: inviteCode
            };
        });
        
        const newServer = createServer();
        res.status(201).json(newServer);
    } catch (err) {
        console.error('Error creating server:', err);
        res.status(500).json({ error: 'Erro ao criar servidor.' });
    }
});

/**
 * POST /api/servers/join
 * Joins a server using an invite code
 * 
 * Body: { invite_code }
 */
router.post('/join', (req, res) => {
    const { invite_code } = req.body;
    
    if (!invite_code) {
        return res.status(400).json({ error: 'Código de convite é obrigatório.' });
    }
    
    const db = getDatabase();
    
    try {
        const server = db.prepare('SELECT id, name, owner_id, invite_code FROM servers WHERE invite_code = ?').get(invite_code);
        
        if (!server) {
            return res.status(404).json({ error: 'Convite inválido ou expirado.' });
        }
        
        // Check if already a member
        const isMember = db.prepare('SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?').get(server.id, req.user.id);
        
        if (isMember) {
            return res.status(400).json({ error: 'Você já é membro deste servidor.' });
        }
        
        db.prepare('INSERT INTO server_members (server_id, user_id) VALUES (?, ?)').run(server.id, req.user.id);
        
        res.json(server);
    } catch (err) {
        console.error('Error joining server:', err);
        res.status(500).json({ error: 'Erro ao entrar no servidor.' });
    }
});

/**
 * GET /api/servers/:id/channels
 * Returns all channels for a specific server
 */
router.get('/:id/channels', (req, res) => {
    const serverId = req.params.id;
    const db = getDatabase();
    
    try {
        // Verify membership
        const isMember = db.prepare('SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?').get(serverId, req.user.id);
        
        if (!isMember) {
            return res.status(403).json({ error: 'Acesso negado.' });
        }
        
        const allChannels = db.prepare('SELECT id, name, type, server_id FROM channels WHERE server_id = ? ORDER BY type, id').all(serverId);
        
        const textChannels = allChannels.filter(c => c.type === 'text');
        const voiceChannels = allChannels.filter(c => c.type === 'voice');
        
        res.json({
            all: allChannels,
            text: textChannels,
            voice: voiceChannels
        });
    } catch (err) {
        console.error('Error fetching channels:', err);
        res.status(500).json({ error: 'Erro ao buscar canais.' });
    }
});
/**
 * PUT /api/servers/:id
 * Edita o nome do servidor. Apenas dono ou admin.
 */
router.put('/:id', (req, res) => {
    const serverId = req.params.id;
    const { name } = req.body;

    if (!name || !name.trim()) {
        return res.status(400).json({ error: 'O nome do servidor é obrigatório.' });
    }

    const db = getDatabase();

    try {
        const server = db.prepare('SELECT owner_id FROM servers WHERE id = ?').get(serverId);
        if (!server) return res.status(404).json({ error: 'Servidor não encontrado.' });

        if (server.owner_id !== req.user.id && !req.user.is_admin) {
            return res.status(403).json({ error: 'Apenas o dono do servidor pode editá-lo.' });
        }

        db.prepare('UPDATE servers SET name = ? WHERE id = ?').run(name.trim(), serverId);
        res.json({ id: Number(serverId), name: name.trim() });
    } catch (err) {
        console.error('Error updating server:', err);
        res.status(500).json({ error: 'Erro ao atualizar servidor.' });
    }
});

/**
 * DELETE /api/servers/:id
 * Exclui o servidor inteiro. Apenas dono ou admin.
 */
router.delete('/:id', (req, res) => {
    const serverId = req.params.id;
    const db = getDatabase();

    try {
        const server = db.prepare('SELECT owner_id FROM servers WHERE id = ?').get(serverId);
        if (!server) return res.status(404).json({ error: 'Servidor não encontrado.' });

        if (server.owner_id !== req.user.id && !req.user.is_admin) {
            return res.status(403).json({ error: 'Apenas o dono do servidor pode excluí-lo.' });
        }

        // ON DELETE CASCADE handle members, channels, and messages
        db.prepare('DELETE FROM servers WHERE id = ?').run(serverId);
        res.json({ success: true, message: 'Servidor excluído com sucesso.' });
    } catch (err) {
        console.error('Error deleting server:', err);
        res.status(500).json({ error: 'Erro ao excluir servidor.' });
    }
});

module.exports = router;
