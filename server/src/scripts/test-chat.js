/**
 * Script de teste para o chat via Socket.io.
 * Simula dois usuários conversando.
 * 
 * Uso: node src/scripts/test-chat.js
 * (Requer que o servidor esteja rodando)
 */

const { io } = require('socket.io-client');
const http = require('http');

const SERVER = 'http://localhost:3001';

// Função para fazer login via HTTP
function login(username, password) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ username, password });
        const req = http.request(`${SERVER}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function main() {
    console.log('\n🧪 ═══════════════════════════════════════');
    console.log('   Teste de Chat em Tempo Real');
    console.log('═══════════════════════════════════════════\n');

    // Login dos dois usuários
    console.log('📡 Fazendo login...');
    const admin = await login('admin', 'admin123');
    const amigo = await login('amigo1', 'amigo123');
    console.log(`  ✅ ${admin.user.display_name} logado`);
    console.log(`  ✅ ${amigo.user.display_name} logado`);

    // Conecta via Socket.io
    const socketAdmin = io(SERVER, { auth: { token: admin.token } });
    const socketAmigo = io(SERVER, { auth: { token: amigo.token } });

    let messagesReceived = 0;

    // Admin: escuta mensagens
    socketAdmin.on('message:new', (msg) => {
        console.log(`  📨 [Admin recebeu] ${msg.display_name}: ${msg.content}`);
        messagesReceived++;
    });

    // Amigo: escuta mensagens  
    socketAmigo.on('message:new', (msg) => {
        console.log(`  📨 [Amigo recebeu] ${msg.display_name}: ${msg.content}`);
        messagesReceived++;
    });

    // Escuta lista de usuários online
    socketAdmin.on('user:online', (users) => {
        console.log(`  👥 Usuários online: ${users.map(u => u.display_name).join(', ')}`);
    });

    // Escuta indicador de digitação
    socketAdmin.on('message:typing', (data) => {
        console.log(`  ✏️  ${data.display_name} está digitando...`);
    });

    // Aguarda ambos conectarem
    await new Promise(resolve => {
        let connected = 0;
        socketAdmin.on('connect', () => { connected++; if (connected === 2) resolve(); });
        socketAmigo.on('connect', () => { connected++; if (connected === 2) resolve(); });
    });

    console.log('\n🔌 Ambos conectados!\n');

    // Ambos entram no canal #geral (id: 1)
    socketAdmin.emit('channel:join', 1);
    socketAmigo.emit('channel:join', 1);

    // Escuta histórico
    socketAdmin.on('channel:history', (data) => {
        console.log(`  📜 Histórico do canal ${data.channelId}: ${data.messages.length} mensagens anteriores`);
    });

    // Aguarda um pouco para processar o join
    await new Promise(r => setTimeout(r, 500));

    // Simula digitação
    socketAmigo.emit('message:typing', 1);
    await new Promise(r => setTimeout(r, 300));

    // Amigo envia mensagem
    console.log('\n💬 Enviando mensagens...\n');
    socketAmigo.emit('message:send', { channelId: 1, content: 'Fala galera! Tudo bom?' });
    await new Promise(r => setTimeout(r, 300));

    socketAdmin.emit('message:send', { channelId: 1, content: 'E aí! Tudo certo por aqui 🎮' });
    await new Promise(r => setTimeout(r, 300));

    socketAmigo.emit('message:send', { channelId: 1, content: 'Bora jogar hoje?' });
    await new Promise(r => setTimeout(r, 500));

    // Resultados
    console.log('\n✅ ═══════════════════════════════════════');
    console.log('   Resultados do Teste');
    console.log('═══════════════════════════════════════════');
    console.log(`  Mensagens enviadas:  3`);
    console.log(`  Mensagens recebidas: ${messagesReceived} (esperado: 6 — cada msg recebida por 2 sockets)`);
    console.log(`  Teste: ${messagesReceived === 6 ? '✅ PASSOU' : '❌ FALHOU'}`);
    console.log('═══════════════════════════════════════════\n');

    // Desconecta
    socketAdmin.disconnect();
    socketAmigo.disconnect();

    // Aguarda desconexão
    await new Promise(r => setTimeout(r, 300));
    process.exit(0);
}

main().catch(console.error);
