const path = require('path');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'discord2.db');

function createTestUsers() {
    console.log('📦 Inicializando criação de usuários de teste...');

    try {
        const db = new Database(DB_PATH);
        const saltRounds = 10;
        const passwordHash = bcrypt.hashSync('batata', saltRounds);

        const insertUser = db.prepare(`
            INSERT INTO users (username, display_name, email, password_hash, avatar_color)
            VALUES (?, ?, ?, ?, ?)
        `);

        // Teste 1
        try {
            insertUser.run('teste1', 'Teste 1', 'teste1@talking.com', passwordHash, '#FF5733');
            console.log('✅ Usuário teste1 criado com sucesso!');
        } catch (e) {
            if (e.message.includes('UNIQUE constraint failed')) {
                console.log('ℹ️ Usuário teste1 já existe.');
            } else {
                throw e;
            }
        }

        // Teste 2
        try {
            insertUser.run('teste2', 'Teste 2', 'teste2@talking.com', passwordHash, '#33FF57');
            console.log('✅ Usuário teste2 criado com sucesso!');
        } catch (e) {
            if (e.message.includes('UNIQUE constraint failed')) {
                console.log('ℹ️ Usuário teste2 já existe.');
            } else {
                throw e;
            }
        }

        db.close();
        console.log('🎉 Finalizado!');
    } catch (err) {
        console.error('❌ Erro:', err.message);
    }
}

createTestUsers();
