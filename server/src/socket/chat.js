const { getDatabase } = require('../database/init');

// Mapa de usuários online: Map<socketId, userData>
const onlineUsers = new Map();

/**
 * Registra os handlers de chat no Socket.io.
 * @param {import('socket.io').Server} io
 */
function registerChatHandlers(io) {
    io.on('connection', (socket) => {
        const user = socket.user; // Preenchido pelo socketAuthMiddleware
        console.log(`🟢 ${user.display_name} (@${user.username}) conectou — socket: ${socket.id}`);

        // Adiciona ao mapa de online
        onlineUsers.set(socket.id, {
            id: user.id,
            username: user.username,
            display_name: user.display_name,
            avatar_color: user.avatar_color,
            socketId: socket.id,
        });

        // Atualiza a presença online para o usuário e seus amigos
        updatePresenceForUserAndFriends(user.id, io);

        // ─── Join Channel ─────────────────────────────────
        socket.on('channel:join', (channelId) => {
            const db = getDatabase();

            try {
                // Verify if user is member of the server that owns this channel
                const channel = db.prepare('SELECT server_id FROM channels WHERE id = ?').get(channelId);
                if (!channel) return;

                const isMember = db.prepare('SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?').get(channel.server_id, user.id);
                if (!isMember) return; // Not allowed

                // Sai de todos os canais de chat anteriores (prefixo "chat:")
                for (const room of socket.rooms) {
                    if (room.startsWith('chat:')) {
                        socket.leave(room);
                    }
                }

                const roomName = `chat:${channelId}`;
                socket.join(roomName);
                console.log(`  📺 ${user.display_name} entrou no canal ${channelId}`);

                // Envia o histórico de mensagens do canal
                const messages = db.prepare(`
                    SELECT 
                        m.id,
                        m.content,
                        m.created_at,
                        m.channel_id,
                        u.id as user_id,
                        u.username,
                        u.display_name,
                        u.avatar_color
                    FROM messages m
                    JOIN users u ON m.user_id = u.id
                    WHERE m.channel_id = ?
                    ORDER BY m.created_at DESC
                    LIMIT 50
                `).all(channelId);

                // Envia em ordem cronológica (mais antigo primeiro)
                socket.emit('channel:history', {
                    channelId,
                    messages: messages.reverse(),
                });
            } catch (err) {
                console.error('Socket channel:join error:', err);
            }
        });

        // ─── Send Message ─────────────────────────────────
        socket.on('message:send', (data) => {
            const { channelId, content } = data;

            if (!content || !content.trim()) return;

            const db = getDatabase();

            try {
                // Verify membership
                const channel = db.prepare('SELECT server_id FROM channels WHERE id = ?').get(channelId);
                if (!channel) return;

                const isMember = db.prepare('SELECT 1 FROM server_members WHERE server_id = ? AND user_id = ?').get(channel.server_id, user.id);
                if (!isMember) return;

                // Salva no banco
                const result = db.prepare(`
                    INSERT INTO messages (channel_id, user_id, content)
                    VALUES (?, ?, ?)
                `).run(channelId, user.id, content.trim());

                // Monta o objeto da mensagem
                const message = {
                    id: result.lastInsertRowid,
                    content: content.trim(),
                    created_at: new Date().toISOString(),
                    channel_id: channelId,
                    user_id: user.id,
                    username: user.username,
                    display_name: user.display_name,
                    avatar_color: user.avatar_color,
                };

                // Broadcast para todos no canal (incluindo o remetente)
                io.to(`chat:${channelId}`).emit('message:new', message);

                console.log(`  💬 [#${channelId}] ${user.display_name}: ${content.trim().substring(0, 50)}...`);
            } catch (err) {
                console.error('Socket message:send error:', err);
            }
        });

        // ─── Typing Indicator ─────────────────────────────
        socket.on('message:typing', (channelId) => {
            socket.to(`chat:${channelId}`).emit('message:typing', {
                user_id: user.id,
                display_name: user.display_name,
                channelId,
            });
        });

        // ─── Stop Typing ─────────────────────────────────
        socket.on('message:stop-typing', (channelId) => {
            socket.to(`chat:${channelId}`).emit('message:stop-typing', {
                user_id: user.id,
                display_name: user.display_name,
                channelId,
            });
        });

        // ─── Disconnect ──────────────────────────────────
        socket.on('disconnect', () => {
            console.log(`🔴 ${user.display_name} (@${user.username}) desconectou`);
            onlineUsers.delete(socket.id);
            
            // Só avisa os amigos se o usuário não tiver mais nenhum socket conectado
            const isStillOnline = Array.from(onlineUsers.values()).some(u => u.id === user.id);
            if (!isStillOnline) {
                updatePresenceForUserAndFriends(user.id, io);
            }
        });
    });
}

/**
 * Retorna a lista de usuários online (sem duplicatas por ID).
 */
function getOnlineUsersList() {
    const usersMap = new Map();
    for (const [, userData] of onlineUsers) {
        usersMap.set(userData.id, userData);
    }
    return Array.from(usersMap.values());
}

/**
 * Recalcula e envia a lista de amigos online para um usuário específico.
 */
function broadcastOnlineFriends(userId, io) {
    const db = getDatabase();
    
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
    `).all(userId, userId);

    const onlineMap = getOnlineUsersList();
    const onlineFriends = friends.filter(f => onlineMap.some(ou => ou.id === f.id));

    for (const [socketId, userData] of onlineUsers.entries()) {
        if (userData.id === userId) {
            io.to(socketId).emit('user:online', onlineFriends);
        }
    }
}

/**
 * Atualiza a presença online para o usuário e notifica todos os seus amigos.
 */
function updatePresenceForUserAndFriends(userId, io) {
    // 1. Atualiza a tela do próprio usuário
    broadcastOnlineFriends(userId, io);

    // 2. Descobre quem são os amigos dele e pede para atualizar a tela deles também
    const db = getDatabase();
    const friends = db.prepare(`
        SELECT user_id_2 as friend_id FROM friends WHERE user_id_1 = ?
        UNION
        SELECT user_id_1 as friend_id FROM friends WHERE user_id_2 = ?
    `).all(userId, userId);

    for (const row of friends) {
        broadcastOnlineFriends(row.friend_id, io);
    }
}

module.exports = { registerChatHandlers, onlineUsers };
