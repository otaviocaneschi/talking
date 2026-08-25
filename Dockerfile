# ═══════════════════════════════════════════════════════
# Discord2 — Dockerfile (Multi-stage build)
# Build do client + servidor Node.js em uma imagem só
# ═══════════════════════════════════════════════════════

# ─── Stage 1: Build do frontend ───────────────────────
FROM node:20-alpine AS client-build

WORKDIR /app/client
COPY client/package.json client/package-lock.json ./
RUN npm ci --ignore-scripts

COPY client/ ./
RUN npm run build

# ─── Stage 2: Servidor de produção ────────────────────
FROM node:20-alpine AS production

# Dependência nativa do better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Instala deps do server
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm ci --omit=dev

# Copia o código do server
COPY server/ ./server/

# Copia o build do frontend
COPY --from=client-build /app/client/dist ./client/dist

# Cria diretório para o banco de dados SQLite
RUN mkdir -p /app/server/data

# Variáveis de ambiente padrão
ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:3001/api/health || exit 1

WORKDIR /app/server
CMD ["node", "src/index.js"]
