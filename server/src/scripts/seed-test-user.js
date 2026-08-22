/**
 * Script para criar um usuário de teste rapidamente.
 * Uso: node src/scripts/seed-test-user.js
 */

const bcrypt = require('bcryptjs');
const { getDatabase } = require('../database/init');

const USERS = [
    {
        username: 'admin',
        display_name: 'Tavinho',
        password: 'admin123',
        avatar_color: '#5865F2',
        is_admin: 1,
    },
    {
        username: 'amigo1',
        display_name: 'Amigo 1',
        password: 'amigo123',
        avatar_color: '#57F287',
        is_admin: 0,
    },
    {
        username: 'amigo2',
        display_name: 'Amigo 2',
        password: 'amigo123',
        avatar_color: '#EB459E',
        is_admin: 0,
    },
];

function main() {
    const db = getDatabase();

    console.log('\n🌱 ═══════════════════════════════════════');
    console.log('   Discord2 — Seed de Usuários de Teste');
    console.log('═══════════════════════════════════════════\n');

    for (const user of USERS) {
        // Verifica se já existe
        const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(user.username);
        if (existing) {
            console.log(`  ⏩ "${user.username}" já existe, pulando...`);
            continue;
        }

        const salt = bcrypt.genSaltSync(12);
        const passwordHash = bcrypt.hashSync(user.password, salt);

        const stmt = db.prepare(`
            INSERT INTO users (username, display_name, password_hash, avatar_color, is_admin)
            VALUES (?, ?, ?, ?, ?)
        `);

        const result = stmt.run(user.username, user.display_name, passwordHash, user.avatar_color, user.is_admin);

        console.log(`  ✅ Criado: ${user.display_name} (@${user.username}) | ID: ${result.lastInsertRowid} | Admin: ${user.is_admin ? 'Sim' : 'Não'}`);
    }

    // Lista todos os usuários
    const allUsers = db.prepare('SELECT id, username, display_name, avatar_color, is_admin, created_at FROM users').all();

    console.log('\n📋 Usuários no banco:');
    console.log('─────────────────────────────────────────');
    for (const u of allUsers) {
        console.log(`  [${u.id}] @${u.username} — ${u.display_name} ${u.is_admin ? '🛡️' : ''}`);
    }
    console.log('─────────────────────────────────────────\n');
}

main();
