/**
 * Script rápido para adicionar amigos.
 * 
 * Uso:
 *   node src/scripts/add-friend.js <username> <senha> <nome>
 * 
 * Exemplo:
 *   node src/scripts/add-friend.js joao 1234 "João Pedro"
 */

const bcrypt = require('bcryptjs');
const { getDatabase } = require('../database/init');

const AVATAR_COLORS = [
    '#5865F2', '#57F287', '#FEE75C', '#EB459E', '#ED4245',
    '#F47B67', '#E8A855', '#45DDC0', '#9B84EC', '#3BA4F4',
];

const args = process.argv.slice(2);

if (args.length < 2) {
    console.log('\n❌ Uso: node src/scripts/add-friend.js <username> <senha> [nome]');
    console.log('   Exemplo: node src/scripts/add-friend.js joao 1234 "João Pedro"\n');
    process.exit(1);
}

const [username, password, displayName] = args;
const name = displayName || username;

const db = getDatabase();

// Verifica se já existe
const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
if (existing) {
    console.log(`\n⚠️  O username "${username}" já existe!\n`);
    process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

const result = db.prepare(
    'INSERT INTO users (username, display_name, password_hash, avatar_color, is_admin) VALUES (?, ?, ?, ?, 0)'
).run(username, name, hash, color);

console.log(`\n✅ Amigo adicionado!`);
console.log(`   👤 Username: ${username}`);
console.log(`   📛 Nome: ${name}`);
console.log(`   🔑 Senha: ${password}`);
console.log(`   🎨 Cor: ${color}\n`);
