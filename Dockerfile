# Multi-stage build para otimizar o tamanho da imagem
FROM node:20-alpine AS builder

# Instalar dependências de build
RUN apk add --no-cache curl

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de configuração do projeto
COPY package*.json ./
COPY tsconfig.json ./

# Instalar todas as dependências (incluindo devDependencies para build)
RUN npm ci

# Copiar código fonte
COPY src/ ./src/

# Compilar TypeScript
RUN npm run build

# Imagem de produção
FROM node:20-alpine AS production

# Instalar dependências de sistema necessárias para executáveis NBIS
RUN apk add --no-cache \
    curl \
    libc6-compat \
    libgcc \
    libstdc++

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de configuração
COPY package*.json ./

# Instalar apenas dependências de produção
RUN npm ci --only=production && npm cache clean --force

# Copiar código compilado do estágio anterior
COPY --from=builder /app/dist ./dist

# Copiar executáveis NBIS e torná-los executáveis
COPY bin/ ./bin/
RUN chmod +x bin/* && \
    chown -R nextjs:nodejs bin/

# Criar diretórios necessários com permissões corretas
RUN mkdir -p templates data/samples data/xyt logs && \
    chown -R nextjs:nodejs templates data logs

# Mudar para usuário não-root
USER nextjs

# Expor porta
EXPOSE 3000

# Configurar variáveis de ambiente
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Definir comando de inicialização
CMD ["node", "dist/server.js"]
