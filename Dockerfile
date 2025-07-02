# Use uma imagem Node.js oficial
FROM node:18-alpine

# Instalar dependências do sistema (caso precise)
RUN apk add --no-cache curl

# Definir diretório de trabalho
WORKDIR /app

# Copiar package.json e package-lock.json
COPY package*.json ./

# Instalar dependências do Node.js
RUN npm ci --only=production

# Copiar código da aplicação
COPY . .

# Compilar TypeScript
RUN npm run build

# Tornar executáveis do NBIS executáveis
RUN chmod +x bin/*

# Criar diretórios necessários
RUN mkdir -p templates data/samples data/xyt

# Expor porta
EXPOSE 3000

# Definir comando de inicialização
CMD ["npm", "start"]
