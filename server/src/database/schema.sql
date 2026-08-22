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

-- Tabela de Canais
CREATE TABLE IF NOT EXISTS channels (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,
    type       TEXT    NOT NULL CHECK (type IN ('text', 'voice')),
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
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

-- ============================================
-- Canais padrão
-- ============================================
INSERT OR IGNORE INTO channels (name, type) VALUES ('geral', 'text');
INSERT OR IGNORE INTO channels (name, type) VALUES ('memes', 'text');
INSERT OR IGNORE INTO channels (name, type) VALUES ('off-topic', 'text');
INSERT OR IGNORE INTO channels (name, type) VALUES ('Sala 1', 'voice');
INSERT OR IGNORE INTO channels (name, type) VALUES ('Sala 2', 'voice');
