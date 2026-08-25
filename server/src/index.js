require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { initDatabase } = require('./database/init');
const { socketAuthMiddleware } = require('./middleware/auth');
const { registerChatHandlers } = require('./socket/chat');
const { registerSignalingHandlers } = require('./socket/signaling');

// ─── Rotas ──────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const channelRoutes = require('./routes/channels');
const userRoutes = require('./routes/users');
const serverRoutes = require('./routes/servers');

// ─── Configuração ───────────────────────────────────────
const PORT = process.env.PORT || 3001;
const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: '*', // Será restrito em produção
        methods: ['GET', 'POST'],
    },
});

// ─── Middlewares ─────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─── Inicializa o banco de dados ────────────────────────
const db = initDatabase();

// ─── Rotas da API ───────────────────────────────────────
app.get('/api/health', (req, res) => {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    const channelCount = db.prepare('SELECT COUNT(*) as count FROM channels').get();
    const messageCount = db.prepare('SELECT COUNT(*) as count FROM messages').get();

    res.json({
        status: 'online',
        name: 'Talking Server',
        version: '1.0.0',
        database: {
            users: userCount.count,
            channels: channelCount.count,
            messages: messageCount.count,
        },
        uptime: Math.floor(process.uptime()) + 's',
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/users', userRoutes);
app.use('/api/servers', serverRoutes);

// ─── Servir o frontend (produção / ngrok) ───────────────
const clientDistPath = require('path').join(__dirname, '..', '..', 'client', 'dist');
if (require('fs').existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    // Para SPA: qualquer rota não-API retorna o index.html
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api')) {
            res.sendFile(require('path').join(clientDistPath, 'index.html'));
        }
    });
    console.log('📦 Servindo frontend de:', clientDistPath);
}

// ─── Socket.io ──────────────────────────────────────────
// Middleware de autenticação JWT para o Socket.io
io.use(socketAuthMiddleware);

// Registra os handlers de chat
registerChatHandlers(io);

// Registra os handlers de sinalização WebRTC (voz)
registerSignalingHandlers(io);

// ─── Inicia o servidor ──────────────────────────────────
httpServer.listen(PORT, () => {
    console.log('\n🚀 ═══════════════════════════════════════');
    console.log(`🚀 Talking Server rodando na porta ${PORT}`);
    console.log('═══════════════════════════════════════════');
    console.log(`   API:    http://localhost:${PORT}/api/health`);
    console.log(`   Auth:   POST http://localhost:${PORT}/api/auth/login`);
    console.log(`   Socket: ws://localhost:${PORT}`);
    console.log('═══════════════════════════════════════════\n');
});

module.exports = { app, io, httpServer };
