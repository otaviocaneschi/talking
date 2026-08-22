const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'discord2_fallback_secret';

/**
 * Middleware Express para autenticação JWT.
 * Espera o token no header: Authorization: Bearer <token>
 */
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token não fornecido.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded; // { id, username, display_name, is_admin }
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }
}

/**
 * Gera um token JWT para o usuário.
 */
function generateToken(user) {
    const payload = {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        avatar_color: user.avatar_color,
        is_admin: user.is_admin,
    };

    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    });
}

/**
 * Autentica um socket (Socket.io) via JWT.
 * Espera o token em: socket.handshake.auth.token
 */
function socketAuthMiddleware(socket, next) {
    const token = socket.handshake.auth?.token;

    if (!token) {
        return next(new Error('Token não fornecido.'));
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.user = decoded; // Anexa dados do usuário ao socket
        next();
    } catch (err) {
        return next(new Error('Token inválido ou expirado.'));
    }
}

module.exports = { authMiddleware, generateToken, socketAuthMiddleware };
