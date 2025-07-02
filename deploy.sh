#!/bin/bash
# Script de deploy para VPS

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Iniciando deploy da API de Biometria...${NC}"

# 1. Build da imagem Docker
echo -e "${YELLOW}📦 Construindo imagem Docker...${NC}"
docker build -t fingerprint-api:latest .

# 2. Parar container anterior se existir
echo -e "${YELLOW}🛑 Parando container anterior (se existir)...${NC}"
docker stop fingerprint-api 2>/dev/null || true
docker rm fingerprint-api 2>/dev/null || true

# 3. Executar novo container
echo -e "${YELLOW}🏃 Executando novo container...${NC}"
docker run -d \
  --name fingerprint-api \
  --restart unless-stopped \
  -p 3000:3000 \
  -v $(pwd)/templates:/app/templates \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  fingerprint-api:latest

# 4. Aguardar container ficar pronto
echo -e "${YELLOW}⏳ Aguardando API ficar disponível...${NC}"
sleep 5

# 5. Verificar se a API está funcionando
if curl -f http://localhost:3000/health >/dev/null 2>&1; then
  echo -e "${GREEN}✅ API deployada com sucesso!${NC}"
  echo -e "${GREEN}🌐 Acesse: http://localhost:3000${NC}"
  echo -e "${GREEN}💊 Health check: http://localhost:3000/health${NC}"
else
  echo -e "${RED}❌ Erro: API não está respondendo${NC}"
  echo -e "${YELLOW}📋 Logs do container:${NC}"
  docker logs fingerprint-api
  exit 1
fi

# 6. Mostrar status
echo -e "${YELLOW}📊 Status do container:${NC}"
docker ps | grep fingerprint-api

echo -e "${GREEN}🎉 Deploy concluído!${NC}"
