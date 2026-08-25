-- ============================================
-- Discord2 — Schema do Banco de Dados (SQLite)
-- ============================================

-- Habilita foreign keys (desabilitado por padrão no SQLite)
PRAGMA foreign_keys = ON;

-- Tabela de Usuários
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT    NOT NULL UNIQUE,
    display_name  TEXT    NOT NULL,
    password_hash TEXT    NOT NULL,
    avatar_color  TEXT    NOT NULL DEFAULT '#5865F2',
    is_admin      INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Tabela de Servidores
CREATE TABLE IF NOT EXISTS servers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    owner_id    INTEGER NOT NULL,
    invite_code TEXT    NOT NULL UNIQUE,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de Membros dos Servidores
CREATE TABLE IF NOT EXISTS server_members (
    server_id  INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    joined_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (server_id, user_id),
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabela de Canais
CREATE TABLE IF NOT EXISTS channels (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id  INTEGER NOT NULL,
    name       TEXT    NOT NULL,
    type       TEXT    NOT NULL CHECK (type IN ('text', 'voice')),
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (server_id) REFERENCES servers(id) ON DELETE CASCADE
);

-- Tabela de Mensagens
CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL,
    user_id    INTEGER NOT NULL,
    content    TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_user    ON messages(user_id);
CREATE INDEX IF NOT EXISTS idx_channels_server  ON channels(server_id);
CREATE INDEX IF NOT EXISTS idx_server_members_user ON server_members(user_id);

-- Tabela de Amigos
CREATE TABLE IF NOT EXISTS friends (
    user_id_1 INTEGER NOT NULL,
    user_id_2 INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    sender_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id_1, user_id_2),
    FOREIGN KEY (user_id_1) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id_2) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_friends_user2 ON friends(user_id_2);

