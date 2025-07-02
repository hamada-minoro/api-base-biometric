# � Fingerprint Biometrics API Base

Uma API TypeScript/Express robusta e extensível para processamento de biometria de impressões digitais usando NBIS (NIST Biometric Image Software). Esta é uma base limpa e bem documentada para projetos de biometria.

## 📋 Índice

- [Visão Geral](#-visão-geral)
- [Características](#-características)
- [Pré-requisitos](#-pré-requisitos)
- [Instalação](#-instalação)
- [Uso](#-uso)
- [Estrutura do Projeto](#-estrutura-do-projeto)
- [Endpoints da API](#-endpoints-da-api)
- [Extensão para Projetos](#-extensão-para-projetos)
- [Próximos Passos](#-próximos-passos)
- [Contribuição](#-contribuição)

## 🎯 Visão Geral

Esta API fornece funcionalidades essenciais para processamento de impressões digitais:

- **Geração de Templates XYT**: Converte arquivos WSQ (Wavelet Scalar Quantization) em templates XYT usando NBIS
- **Matching de Impressões**: Compara duas impressões digitais e retorna score de similaridade
- **Base Extensível**: Arquitetura limpa preparada para integração com bancos de dados e storage

### Tecnologias Utilizadas

- **Backend**: Node.js 18+, Express.js, TypeScript
- **Biometria**: NBIS (mindtct + bozorth3)
- **Upload**: Multer para processamento de arquivos
- **Formatos**: WSQ (entrada) → XYT (templates) → Matching

### ⚙️ Processo de Biometria

1. **Conversão**: `mindtct` extrai minutiae de WSQ → XYT
2. **Matching**: `bozorth3` compara dois templates XYT
3. **Score**: Retorna valor numérico de similaridade (0 = sem match, 400+ = match forte)

## ✨ Características

- 🏗️ **Arquitetura Limpa**: Código bem estruturado e documentado
- 🔒 **Validação Robusta**: Verificação de arquivos e tratamento de erros
- 📊 **Logs Detalhados**: Rastreamento completo de operações
- 🔧 **Configurável**: Facilmente extensível para novos casos de uso
- 📁 **Gestão de Arquivos**: Sistema organizado de armazenamento de templates
- 🏥 **Health Check**: Endpoint para monitoramento da API e dependências

## � Pré-requisitos

### Sistema
- **Node.js** 18+ e npm
- **NBIS** instalado e acessível via PATH
- **Sistema Unix/Linux** (testado em Ubuntu/Debian)

### Verificação do NBIS
```bash
# Verificar se as ferramentas NBIS estão disponíveis
which mindtct
which bozorth3

# Testar execução
mindtct -h
bozorth3 -h
```

Se o NBIS não estiver instalado, consulte a documentação em `/nbis/Rel_5.0.0/` no repositório.

## 🚀 Instalação

1. **Clone e navegue para o diretório**:
```bash
cd api-match
```

2. **Instale as dependências**:
```bash
npm install
```

3. **Configure o ambiente** (opcional):
```bash
# Crie um arquivo .env se necessário
cp .env.example .env
```

4. **Build do projeto**:
```bash
npm run build
```

## 🎮 Uso

### Desenvolvimento
```bash
npm run dev
```
A API estará disponível em: `http://localhost:3000`

### Produção
```bash
npm run build
npm start
```

### Docker (se disponível)
```bash
docker-compose up -d
```

## 📂 Estrutura do Projeto

```
api-match/
├── src/
│   ├── server.ts          # Servidor Express principal
│   └── nbis.service.ts    # Serviço para operações NBIS
├── templates/             # Armazenamento de arquivos WSQ/XYT
├── dist/                  # Build compilado (gerado)
├── package.json          # Dependências e scripts
├── tsconfig.json         # Configuração TypeScript
├── Dockerfile           # Container Docker
└── README.md            # Esta documentação
```

### Principais Arquivos

- **`src/server.ts`**: API Express com rotas, middlewares e configuração
- **`src/nbis.service.ts`**: Lógica de integração com ferramentas NBIS
- **`templates/`**: Diretório para armazenamento local de arquivos WSQ e XYT

## 🌐 Endpoints da API

### `GET /`
**Informações básicas da API**
```bash
curl http://localhost:3000/
```

### `GET /health`
**Status da API e dependências**
```bash
curl http://localhost:3000/health
```
Retorna status de saúde incluindo disponibilidade das ferramentas NBIS.

### `POST /generate-template`
**Gera template XYT a partir de arquivo WSQ**

```bash
curl -X POST \
  -F "wsq=@fingerprint.wsq" \
  http://localhost:3000/generate-template
```

**Response:**
```json
{
  "success": true,
  "message": "Template XYT gerado com sucesso",
  "data": {
    "originalFile": "fingerprint.wsq",
    "templateFile": "abc123-fingerprint.xyt",
    "path": "/templates/abc123-fingerprint.xyt",
    "size": 1024
  }
}
```

### `POST /match`
**Compara duas impressões digitais**

⚠️ **Importante**: Este endpoint recebe arquivos WSQ, mas **internamente** converte ambos para XYT e realiza o matching entre os templates XYT gerados.

**Fluxo interno:**
1. Recebe 2 arquivos WSQ
2. Converte WSQ₁ → XYT₁ e WSQ₂ → XYT₂  
3. Executa `bozorth3 -p XYT₁ XYT₂`
4. Retorna score de matching
5. Remove arquivos temporários

```bash
curl -X POST \
  -F "fingerprint1=@finger1.wsq" \
  -F "fingerprint2=@finger2.wsq" \
  http://localhost:3000/match
```

**Response:**
```json
{
  "success": true,
  "message": "Matching realizado com sucesso",
  "data": {
    "score": 85,
    "similarity": "high",
    "match": true,
    "files": {
      "finger1": "abc123-finger1.xyt",
      "finger2": "def456-finger2.xyt"
    }
  }
}
```

### Códigos de Resposta

- **200**: Operação realizada com sucesso
- **400**: Erro de validação (arquivo inválido, formato incorreto)
- **500**: Erro interno do servidor (falha no NBIS, sistema)

## 🔨 Extensão para Projetos

Esta API foi projetada como base extensível. Aqui estão os pontos de extensão principais:

### 1. Adicionando Novos Endpoints

Edite `src/server.ts`:

```typescript
// Exemplo: endpoint para buscar templates por usuário
app.get('/templates/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    // Sua lógica aqui
    res.json({ success: true, templates: [] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

### 2. Adicionando Validações Customizadas

```typescript
// src/validators.ts (novo arquivo)
export const validateUserId = (userId: string): boolean => {
  return userId && userId.length > 0;
};

// src/middleware.ts (novo arquivo)
export const authMiddleware = (req, res, next) => {
  // Sua lógica de autenticação
  next();
};
```

### 3. Configurações de Ambiente

Crie um arquivo `.env`:

```env
NODE_ENV=development
PORT=3000
TEMPLATES_DIR=./templates
MAX_FILE_SIZE=5242880
ALLOWED_EXTENSIONS=.wsq
DATABASE_URL=postgresql://user:pass@localhost:5432/db
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
```

E carregue no `src/server.ts`:

```typescript
import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 3000;
const TEMPLATES_DIR = process.env.TEMPLATES_DIR || './templates';
```

### 4. Adicionando Logging Avançado

```typescript
// src/logger.ts (novo arquivo)
import winston from 'winston';

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});
```

## 🚀 Próximos Passos

### 1. Integração com Banco de Dados (MySQL)

Para armazenar metadados dos templates e associá-los a usuários:

#### Estrutura de Tabelas Sugerida

```sql
-- Tabela de usuários
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de templates de impressão digital
CREATE TABLE fingerprint_templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INT NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    storage_provider ENUM('local', 'minio', 's3') DEFAULT 'local',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user_id (user_id),
    INDEX idx_file_hash (file_hash)
);

-- Tabela de comparações realizadas
CREATE TABLE matching_results (
    id INT PRIMARY KEY AUTO_INCREMENT,
    template1_id INT NOT NULL,
    template2_id INT NOT NULL,
    score INT NOT NULL,
    similarity VARCHAR(20) NOT NULL,
    is_match BOOLEAN NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template1_id) REFERENCES fingerprint_templates(id),
    FOREIGN KEY (template2_id) REFERENCES fingerprint_templates(id)
);
```

#### Implementação

1. **Instalar dependências do MySQL**:
```bash
npm install mysql2 @types/mysql2
```

2. **Criar serviço de banco de dados**:
```typescript
// src/database.service.ts
import mysql from 'mysql2/promise';

export class DatabaseService {
  private connection: mysql.Connection;

  async connect() {
    this.connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'fingerprint_db'
    });
  }

  async saveTemplate(userId: number, filename: string, filePath: string, fileSize: number, fileHash: string) {
    const [result] = await this.connection.execute(
      'INSERT INTO fingerprint_templates (user_id, filename, file_path, file_size, file_hash) VALUES (?, ?, ?, ?, ?)',
      [userId, filename, filePath, fileSize, fileHash]
    );
    return result;
  }

  async getTemplatesByUser(userId: number) {
    const [rows] = await this.connection.execute(
      'SELECT * FROM fingerprint_templates WHERE user_id = ?',
      [userId]
    );
    return rows;
  }

  async saveMatchingResult(template1Id: number, template2Id: number, score: number, similarity: string, isMatch: boolean) {
    const [result] = await this.connection.execute(
      'INSERT INTO matching_results (template1_id, template2_id, score, similarity, is_match) VALUES (?, ?, ?, ?, ?)',
      [template1Id, template2Id, score, similarity, isMatch]
    );
    return result;
  }
}
```

3. **Modificar endpoints existentes**:
```typescript
// Adicionar ao endpoint /generate-template
const templateId = await dbService.saveTemplate(
  userId, 
  filename, 
  filePath, 
  fileSize, 
  fileHash
);
```

### 2. Integração com MinIO (Storage S3-Compatible)

Para armazenar arquivos XYT em storage distribuído:

#### Setup do MinIO

1. **Instalar MinIO localmente**:
```bash
# Via Docker
docker run -p 9000:9000 -p 9001:9001 \
  --name minio \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  -v /tmp/minio-data:/data \
  quay.io/minio/minio server /data --console-address ":9001"
```

2. **Instalar cliente MinIO**:
```bash
npm install minio @types/minio
```

#### Implementação

```typescript
// src/storage.service.ts
import { Client as MinioClient } from 'minio';

export class StorageService {
  private minioClient: MinioClient;
  private bucketName = 'fingerprint-templates';

  constructor() {
    this.minioClient = new MinioClient({
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin'
    });
  }

  async initializeBucket() {
    const exists = await this.minioClient.bucketExists(this.bucketName);
    if (!exists) {
      await this.minioClient.makeBucket(this.bucketName);
    }
  }

  async uploadTemplate(fileName: string, filePath: string): Promise<string> {
    const objectName = `templates/${Date.now()}-${fileName}`;
    await this.minioClient.fPutObject(this.bucketName, objectName, filePath);
    return objectName;
  }

  async downloadTemplate(objectName: string, localPath: string): Promise<void> {
    await this.minioClient.fGetObject(this.bucketName, objectName, localPath);
  }

  async deleteTemplate(objectName: string): Promise<void> {
    await this.minioClient.removeObject(this.bucketName, objectName);
  }

  getTemplateUrl(objectName: string): Promise<string> {
    return this.minioClient.presignedGetObject(this.bucketName, objectName, 24 * 60 * 60); // 24 horas
  }
}
```

#### Modificação dos Endpoints

```typescript
// src/server.ts - endpoint modificado
app.post('/generate-template', upload.single('wsq'), async (req, res) => {
  try {
    // Processar com NBIS...
    const xytPath = await nbisService.generateTemplate(wsqPath);
    
    // Upload para MinIO
    const storageObjectName = await storageService.uploadTemplate(xytFilename, xytPath);
    
    // Salvar no banco
    const templateId = await dbService.saveTemplate(
      userId, 
      xytFilename, 
      storageObjectName, // path no MinIO
      fileSize, 
      fileHash,
      'minio' // provider
    );

    // Cleanup arquivo local
    fs.unlinkSync(xytPath);

    res.json({
      success: true,
      data: {
        templateId,
        storageObjectName,
        downloadUrl: await storageService.getTemplateUrl(storageObjectName)
      }
    });
  } catch (error) {
    // tratamento de erro...
  }
});
```

### 3. Melhorias de Segurança

- **Autenticação JWT**: Adicionar middleware de autenticação
- **Rate Limiting**: Limitar requisições por IP/usuário
- **Validação Avançada**: Verificar integridade dos arquivos WSQ
- **Sanitização**: Validar nomes de arquivos e inputs

### 4. Monitoring e Performance

- **Métricas**: Implementar coleta de métricas com Prometheus
- **APM**: Adicionar Application Performance Monitoring
- **Logs Estruturados**: Implementar logging estruturado com ELK Stack
- **Cache**: Adicionar Redis para cache de resultados de matching

### 5. Extensões Funcionais

- **Batch Processing**: Processar múltiplos templates simultaneamente
- **Webhook Support**: Notificações automáticas de resultados
- **Template Versioning**: Versionamento de templates
- **Multi-format Support**: Suporte a outros formatos além de WSQ

## 🤝 Contribuição

1. Fork este repositório
2. Crie uma branch para sua feature (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

### Padrões de Código

- Use TypeScript com tipagem estrita
- Siga os padrões ESLint configurados
- Adicione testes para novas funcionalidades
- Documente APIs com comentários JSDoc

## 📄 Licença

Este projeto está licenciado sob a licença MIT. Veja o arquivo `LICENSE` para detalhes.

## 🆘 Suporte

Para dúvidas ou problemas:

1. Verifique a seção de [troubleshooting](#troubleshooting)
2. Consulte os logs da aplicação
3. Abra uma issue no repositório

### Troubleshooting

**Erro: "mindtct command not found"**
- Verifique se o NBIS está instalado e no PATH
- Execute: `export PATH=$PATH:/caminho/para/nbis/bin`

**Erro: "Permission denied"**
- Verifique permissões do diretório `templates/`
- Execute: `chmod 755 templates/`

**Erro: "File too large"**
- Ajuste o limite de tamanho no Multer
- Verifique espaço em disco disponível

---

*Esta API serve como uma base sólida para projetos de biometria de impressões digitais. Estenda conforme suas necessidades específicas.*

## 🔄 Pipeline de Processamento

1. **WSQ** → Extrai minúcias → **XYT** (usando `mindtct`)
2. **XYT** + **XYT** → Score de matching (usando `bozorth3`)

## 📊 Interpretação dos Scores

- **Score >= 40**: Match provável
- **Score 20-39**: Match possível  
- **Score < 20**: Não é match

## 🧪 Teste com cURL

```bash
# Converter WSQ para XYT
curl -X POST -F "wsq=@fingerprint.wsq" http://localhost:3000/convert-to-xyt

# Matching entre dois WSQ
curl -X POST -F "wsq1=@finger1.wsq" -F "wsq2=@finger2.wsq" http://localhost:3000/match

# Verificar status
curl http://localhost:3000/status
```

## � Estrutura do Projeto

```
api-match/
├── src/
│   ├── server.ts           # Servidor principal
│   ├── nbis.service.ts     # Serviço para interagir com NBIS
├── dist/                   # Build TypeScript (gerado)
├── package.json
├── tsconfig.json
└── README.md
```

## 📝 Arquivos Gerados

- **WSQ**: Salvos na pasta raiz da API
- **XYT**: Salvos na pasta raiz da API  
- **Nomes**: UUID único + extensão original

## ⚠️ Importantes

- API aceita **apenas arquivos WSQ nativos**
- Não há conversão de RAW → WSQ (responsabilidade do frontend)
- Arquivos são mantidos na pasta raiz para análise posterior
- TypeScript com tipagem completa
