/**
 * Script CLI para criar usuários no banco de dados.
 * 
 * Uso:
 *   npm run create-user
 *   node src/scripts/create-user.js
 * 
 * O script vai pedir:
 *   - Username (login)
 *   - Nome de exibição
 *   - Senha
 *   - Se é admin (s/n)
 */

const readline = require('readline');
const bcrypt = require('bcryptjs');
const { getDatabase } = require('../database/init');

// Paleta de cores para avatares (estilo Discord)
const AVATAR_COLORS = [
    '#5865F2', // Blurple (Discord)
    '#57F287', // Green
    '#FEE75C', // Yellow
    '#EB459E', // Fuchsia
    '#ED4245', // Red
    '#F47B67', // Salmon
    '#E8A855', // Gold
    '#45DDC0', // Teal
    '#9B84EC', // Purple
    '#3BA4F4', // Blue
];

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

function ask(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer.trim());
        });
    });
}

async function main() {
    console.log('\n🔧 ═══════════════════════════════════════');
    console.log('   Discord2 — Criar Novo Usuário');
    console.log('═══════════════════════════════════════════\n');

    // Inicializa o banco
    const db = getDatabase();

    // Coleta informações
    const username = await ask('  👤 Username (login): ');
    if (!username) {
        console.log('\n❌ Username não pode ser vazio.');
        rl.close();
        process.exit(1);
    }

    // Verifica se o username já existe
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
        console.log(`\n❌ O username "${username}" já está em uso.`);
        rl.close();
        process.exit(1);
    }

    const displayName = await ask('  📛 Nome de exibição: ') || username;

    const password = await ask('  🔑 Senha: ');
    if (!password || password.length < 4) {
        console.log('\n❌ A senha deve ter pelo menos 4 caracteres.');
        rl.close();
        process.exit(1);
    }

    const isAdminInput = await ask('  🛡️  É administrador? (s/N): ');
    const isAdmin = isAdminInput.toLowerCase() === 's' ? 1 : 0;

    // Hash da senha
    const salt = bcrypt.genSaltSync(12);
    const passwordHash = bcrypt.hashSync(password, salt);

    // Cor aleatória do avatar
    const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

    // Insere no banco
    try {
        const stmt = db.prepare(`
            INSERT INTO users (username, display_name, password_hash, avatar_color, is_admin)
            VALUES (?, ?, ?, ?, ?)
        `);

        const result = stmt.run(username, displayName, passwordHash, avatarColor, isAdmin);

        console.log('\n✅ ═══════════════════════════════════════');
        console.log('   Usuário criado com sucesso!');
        console.log('═══════════════════════════════════════════');
        console.log(`  ID:        ${result.lastInsertRowid}`);
        console.log(`  Username:  ${username}`);
        console.log(`  Nome:      ${displayName}`);
        console.log(`  Admin:     ${isAdmin ? 'Sim' : 'Não'}`);
        console.log(`  Cor:       ${avatarColor}`);
        console.log('═══════════════════════════════════════════\n');
    } catch (error) {
        console.error('\n❌ Erro ao criar usuário:', error.message);
        process.exit(1);
    }

    rl.close();
}

main();
