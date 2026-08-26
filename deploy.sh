#!/bin/bash
# ═══════════════════════════════════════════════════════
# Discord2 — Script de Deploy para VPS
# 
# Uso: bash deploy.sh
#
# Pré-requisitos no servidor:
#   - Docker + Docker Compose instalados
#   - Git instalado
#   - Porta 80 e 443 abertas no firewall
# ═══════════════════════════════════════════════════════

set -e

echo ""
echo "🚀 ═══════════════════════════════════════"
echo "   Discord2 — Deploy"
echo "═══════════════════════════════════════════"
echo ""

# Verifica se o .env existe
if [ ! -f .env ]; then
    echo "⚠️  Arquivo .env não encontrado. Criando..."
    echo ""
    
    # Gera um JWT_SECRET aleatório
    JWT_SECRET=$(openssl rand -hex 32)
    echo "JWT_SECRET=$JWT_SECRET" > .env
    
    echo "✅ .env criado com JWT_SECRET gerado automaticamente."
    echo "   Guarde este secret: $JWT_SECRET"
    echo ""
fi

# Cria arquivo server/.env vazio se não existir para evitar erros no docker-compose
if [ ! -f server/.env ]; then
    touch server/.env
fi

# Pull das últimas mudanças
echo "📥 Puxando últimas mudanças do GitHub..."
git pull origin main

# Build e start dos containers
echo ""
echo "🔨 Buildando e iniciando containers..."
docker compose up -d --build

echo ""
echo "⏳ Aguardando o app iniciar..."
sleep 5

# Verifica se está rodando
if docker compose ps | grep -q "running"; then
    echo ""
    echo "✅ ═══════════════════════════════════════"
    echo "   Deploy concluído com sucesso!"
    echo "═══════════════════════════════════════════"
    echo ""
    echo "   Verifique: docker compose logs -f app"
    echo ""
else
    echo ""
    echo "❌ Algo deu errado. Verifique os logs:"
    echo "   docker compose logs app"
    echo ""
    exit 1
fi
