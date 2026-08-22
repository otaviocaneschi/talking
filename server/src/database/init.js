const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'discord2.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db = null;

/**
 * Inicializa o banco de dados SQLite.
 * Cria o diretório de dados se não existir,
 * aplica o schema e retorna a instância do banco.
 */
function initDatabase() {
    // Garante que o diretório data/ existe
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        console.log('📁 Diretório data/ criado');
    }

    // Abre (ou cria) o banco de dados
    db = new Database(DB_PATH);

    // Habilita WAL mode para melhor performance de leitura concorrente
    db.pragma('journal_mode = WAL');

    // Habilita foreign keys
    db.pragma('foreign_keys = ON');

    // Aplica o schema
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
    db.exec(schema);

    console.log('✅ Banco de dados inicializado em:', DB_PATH);

    return db;
}

/**
 * Retorna a instância do banco de dados.
 * Inicializa se ainda não foi criado.
 */
function getDatabase() {
    if (!db) {
        return initDatabase();
    }
    return db;
}

module.exports = { initDatabase, getDatabase };
