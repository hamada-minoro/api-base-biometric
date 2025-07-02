# 🐳 Deploy com Docker

Este guia mostra como fazer o deploy da API de Biometria usando Docker.

## 🚀 Quick Start

### Opção 1: Usando Docker Compose (Recomendado)

```bash
# Build e execução em um comando
docker-compose up -d --build

# Verificar logs
docker-compose logs -f

# Parar
docker-compose down
```

### Opção 2: Usando o Script de Deploy

```bash
# Executar script automatizado
./deploy.sh
```

### Opção 3: Docker Manual

```bash
# Build da imagem
docker build -t fingerprint-api .

# Executar container
docker run -d \
  --name fingerprint-api \
  --restart unless-stopped \
  -p 3000:3000 \
  -v $(pwd)/templates:/app/templates \
  -v $(pwd)/logs:/app/logs \
  fingerprint-api
```

## 🔍 Verificações

### Health Check
```bash
curl http://localhost:3000/health
```

### Logs do Container
```bash
# Docker Compose
docker-compose logs -f

# Docker direto
docker logs -f fingerprint-api
```

### Status do Container
```bash
docker ps | grep fingerprint-api
```

## 📁 Volumes Persistidos

- `./templates` → Templates XYT gerados
- `./data` → Dados de teste (opcional)
- `./logs` → Logs da aplicação

## 🛠️ Configurações Avançadas

### Variáveis de Ambiente

Crie um arquivo `.env` com:

```env
NODE_ENV=production
PORT=3000
TEMPLATES_DIR=/app/templates
MAX_FILE_SIZE=5242880
LOG_LEVEL=info
```

### Recursos do Container

O docker-compose.yml já está configurado com:
- **Limite de Memória**: 512MB
- **Memória Reservada**: 256MB
- **Health Check**: A cada 30s
- **Restart Policy**: unless-stopped

## 🔧 Troubleshooting

### Container não inicia
```bash
# Verificar logs de build
docker-compose logs

# Verificar se a porta está livre
sudo netstat -tlnp | grep :3000
```

### Executáveis NBIS não funcionam
```bash
# Entrar no container
docker exec -it fingerprint-api sh

# Verificar executáveis
ls -la bin/
./bin/mindtct -h
```

### Permissões de arquivo
```bash
# Verificar permissões dos volumes
ls -la templates/ data/ logs/

# Ajustar se necessário
sudo chown -R $USER:$USER templates/ data/ logs/
```

## 🌐 Deploy em VPS

1. **Fazer upload dos arquivos**:
```bash
rsync -avz --exclude node_modules . user@vps:/path/to/app/
```

2. **Na VPS, executar**:
```bash
cd /path/to/app/
./deploy.sh
```

3. **Configurar proxy reverso** (Nginx/Apache) se necessário.

## 📊 Monitoramento

### Uso de recursos
```bash
docker stats fingerprint-api
```

### Verificar health
```bash
curl -f http://localhost:3000/health || echo "API não está saudável"
```

### Logs em tempo real
```bash
docker logs -f fingerprint-api | grep ERROR
```
