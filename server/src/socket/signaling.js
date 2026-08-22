/**
 * Signaling Server para WebRTC.
 * 
 * Gerencia:
 * - Entrada/saída de canais de voz
 * - Troca de SDP offers/answers entre peers
 * - Troca de ICE candidates
 * - Notificação de screen sharing
 * 
 * Topologia: Mesh (cada peer conecta com todos os outros)
 */

// Map<channelId, Map<socketId, userData>>
const voiceChannels = new Map();

/**
 * Registra os handlers de sinalização WebRTC no Socket.io.
 * @param {import('socket.io').Server} io
 */
function registerSignalingHandlers(io) {
    io.on('connection', (socket) => {
        const user = socket.user;

        // ─── Join Voice Channel ──────────────────────────
        socket.on('voice:join', (channelId) => {
            // Sai do canal de voz anterior, se houver
            leaveCurrentVoiceChannel(socket, io);

            // Cria o canal se não existe
            if (!voiceChannels.has(channelId)) {
                voiceChannels.set(channelId, new Map());
            }

            const channel = voiceChannels.get(channelId);

            // Pega a lista de peers já no canal ANTES de adicionar o novo
            const existingPeers = [];
            for (const [peerSocketId, peerData] of channel) {
                existingPeers.push({
                    socketId: peerSocketId,
                    ...peerData,
                });
            }

            // Adiciona o novo usuário ao canal
            const userData = {
                id: user.id,
                username: user.username,
                display_name: user.display_name,
                avatar_color: user.avatar_color,
                muted: false,
                deafened: false,
                screenSharing: false,
            };

            channel.set(socket.id, userData);

            // Entra na room do Socket.io para o canal de voz
            socket.join(`voice:${channelId}`);

            // Salva referência do canal atual no socket
            socket.voiceChannelId = channelId;

            console.log(`🎤 ${user.display_name} entrou no canal de voz ${channelId} (${channel.size} usuários)`);

            // Envia a lista de peers existentes para o novo usuário
            // (ele vai criar offers para cada um deles)
            socket.emit('voice:peers', {
                channelId,
                peers: existingPeers,
            });

            // Notifica os peers existentes que um novo usuário entrou
            // (cada um vai esperar receber um offer do novo usuário)
            socket.to(`voice:${channelId}`).emit('voice:user-joined', {
                channelId,
                socketId: socket.id,
                ...userData,
            });

            // Broadcast: atualiza a lista de usuários no canal de voz para todos
            broadcastVoiceUsers(io, channelId);
        });

        // ─── Leave Voice Channel ─────────────────────────
        socket.on('voice:leave', () => {
            leaveCurrentVoiceChannel(socket, io);
        });

        // ─── Mute/Unmute ─────────────────────────────────
        socket.on('voice:mute', (muted) => {
            if (!socket.voiceChannelId) return;

            const channel = voiceChannels.get(socket.voiceChannelId);
            if (!channel) return;

            const userData = channel.get(socket.id);
            if (userData) {
                userData.muted = muted;
                broadcastVoiceUsers(io, socket.voiceChannelId);
            }
        });

        // ─── Deafen/Undeafen ─────────────────────────────
        socket.on('voice:deafen', (deafened) => {
            if (!socket.voiceChannelId) return;

            const channel = voiceChannels.get(socket.voiceChannelId);
            if (!channel) return;

            const userData = channel.get(socket.id);
            if (userData) {
                userData.deafened = deafened;
                if (deafened) userData.muted = true; // Deafen implica mute
                broadcastVoiceUsers(io, socket.voiceChannelId);
            }
        });

        // ─── WebRTC Signaling: Offer ─────────────────────
        socket.on('webrtc:offer', ({ targetSocketId, offer }) => {
            io.to(targetSocketId).emit('webrtc:offer', {
                fromSocketId: socket.id,
                offer,
            });
        });

        // ─── WebRTC Signaling: Answer ────────────────────
        socket.on('webrtc:answer', ({ targetSocketId, answer }) => {
            io.to(targetSocketId).emit('webrtc:answer', {
                fromSocketId: socket.id,
                answer,
            });
        });

        // ─── WebRTC Signaling: ICE Candidate ─────────────
        socket.on('webrtc:ice-candidate', ({ targetSocketId, candidate }) => {
            io.to(targetSocketId).emit('webrtc:ice-candidate', {
                fromSocketId: socket.id,
                candidate,
            });
        });

        // ─── Screen Sharing ──────────────────────────────
        socket.on('screen:start', () => {
            if (!socket.voiceChannelId) return;

            const channel = voiceChannels.get(socket.voiceChannelId);
            if (!channel) return;

            const userData = channel.get(socket.id);
            if (userData) {
                userData.screenSharing = true;
                broadcastVoiceUsers(io, socket.voiceChannelId);

                // Notifica os outros peers para pedir a track de tela
                socket.to(`voice:${socket.voiceChannelId}`).emit('screen:started', {
                    socketId: socket.id,
                    display_name: user.display_name,
                });
            }
        });

        socket.on('screen:stop', () => {
            if (!socket.voiceChannelId) return;

            const channel = voiceChannels.get(socket.voiceChannelId);
            if (!channel) return;

            const userData = channel.get(socket.id);
            if (userData) {
                userData.screenSharing = false;
                broadcastVoiceUsers(io, socket.voiceChannelId);

                socket.to(`voice:${socket.voiceChannelId}`).emit('screen:stopped', {
                    socketId: socket.id,
                });
            }
        });

        // ─── Disconnect ──────────────────────────────────
        socket.on('disconnect', () => {
            leaveCurrentVoiceChannel(socket, io);
        });
    });
}

/**
 * Remove o usuário do canal de voz atual.
 */
function leaveCurrentVoiceChannel(socket, io) {
    const channelId = socket.voiceChannelId;
    if (!channelId) return;

    const channel = voiceChannels.get(channelId);
    if (channel) {
        channel.delete(socket.id);

        // Remove o canal se ficou vazio
        if (channel.size === 0) {
            voiceChannels.delete(channelId);
        }
    }

    // Sai da room do Socket.io
    socket.leave(`voice:${channelId}`);

    // Notifica os outros peers
    socket.to(`voice:${channelId}`).emit('voice:user-left', {
        socketId: socket.id,
        channelId,
    });

    console.log(`🔇 ${socket.user?.display_name} saiu do canal de voz ${channelId}`);

    socket.voiceChannelId = null;

    // Atualiza a lista
    broadcastVoiceUsers(io, channelId);
}

/**
 * Envia a lista atualizada de usuários do canal de voz para todos.
 */
function broadcastVoiceUsers(io, channelId) {
    const channel = voiceChannels.get(channelId);
    const users = [];

    if (channel) {
        for (const [socketId, userData] of channel) {
            users.push({ socketId, ...userData });
        }
    }

    io.emit('voice:users', { channelId, users });
}

/**
 * Retorna os dados de todos os canais de voz ativos.
 */
function getVoiceChannelsData() {
    const data = {};
    for (const [channelId, channel] of voiceChannels) {
        data[channelId] = [];
        for (const [socketId, userData] of channel) {
            data[channelId].push({ socketId, ...userData });
        }
    }
    return data;
}

module.exports = { registerSignalingHandlers, getVoiceChannelsData };
