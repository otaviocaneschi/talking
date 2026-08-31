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
const friendsRoutes = require('./routes/friends');

// ─── Configuração ───────────────────────────────────
const PORT = process.env.PORT || 3001;
const app = express();
const httpServer = createServer(app);

// ─── CORS & Security ────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:3001'];

const corsOptions = {
    origin: (origin, callback) => {
        // Permite requisições sem origin (ex: Electron, mobile apps)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error('Bloqueado pelo CORS'));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
};

const io = new Server(httpServer, {
    cors: corsOptions,
});

app.set('io', io); // Permite acessar o io nas rotas usando req.app.get('io')

// ─── Middlewares ─────────────────────────────────────
app.use(cors(corsOptions));

// Security headers (sem dependência extra)
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), geolocation=()');
    next();
});

app.use(express.json({ limit: '1mb' }));

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
app.use('/api/friends', friendsRoutes);

app.get('/api/version', (req, res) => {
    res.json({
        version: process.env.CLIENT_VERSION || '1.0.0',
        downloadUrl: process.env.CLIENT_DOWNLOAD_URL || ''
    });
});

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
