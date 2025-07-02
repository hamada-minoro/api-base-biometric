import express, { Request, Response } from 'express';
import multer, { FileFilterCallback } from 'multer';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { NBISService } from './nbis.service';

/**
 * Fingerprint Matching API Base
 * 
 * Esta API serve como base para implementações de biometria usando NBIS.
 * Fornece funcionalidades essenciais para:
 * - Extração de minutiae de arquivos WSQ
 * - Matching (comparação) entre impressões digitais
 * - Armazenamento de templates XYT
 */

const app = express();
const PORT = process.env.PORT || 3000;

// Serviço NBIS para processamento biométrico
const nbisService = new NBISService();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Garantir que a pasta templates existe
const ensureTemplatesDirectory = async () => {
  try {
    await fs.mkdir('templates', { recursive: true });
  } catch (error) {
    console.error('Erro ao criar diretório templates:', error);
  }
};

// Configuração do multer para upload de arquivos WSQ
const storage = multer.diskStorage({
  destination: async (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    await ensureTemplatesDirectory();
    cb(null, 'templates');
  },
  filename: (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueId = uuidv4();
    const extension = path.extname(file.originalname);
    cb(null, `${uniqueId}${extension}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limite por arquivo
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (path.extname(file.originalname).toLowerCase() === '.wsq') {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos WSQ são aceitos'));
    }
  }
});

// Interfaces de resposta da API
interface ConvertResponse {
  success: boolean;
  message: string;
  data: {
    originalFile: string;
    xytFile: string;
    minutiaeCount: number;
    filePath: string;
    fileId: string;
  };
}

interface MatchResponse {
  success: boolean;
  message: string;
  data: {
    fingerprint1: {
      id: string;
      name: string;
      minutiae: number;
    };
    fingerprint2: {
      id: string;
      name: string;
      minutiae: number;
    };
    matchScore: number;
    confidence: number;
    isMatch: boolean;
    threshold: number;
  };
}

interface ApiStatus {
  service: string;
  version: string;
  status: string;
  timestamp: string;
  tools: {
    mindtct: boolean;
    bozorth3: boolean;
  };
  endpoints: Array<{
    method: string;
    path: string;
    description: string;
  }>;
}

/**
 * POST /generate-template
 * 
 * Converte arquivo WSQ para template XYT (minutiae)
 * Este é o primeiro passo no processo de biometria.
 * 
 * @param wsq - Arquivo WSQ da impressão digital
 * @returns Template XYT com minutiae extraídas
 */
app.post('/generate-template', upload.single('wsq'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: 'Nenhum arquivo WSQ foi enviado',
        error: 'MISSING_FILE'
      });
    }

    const wsqFile = req.file.path;
    const fileId = path.basename(req.file.filename, '.wsq');
    const xytFile = wsqFile.replace('.wsq', '.xyt');

    console.log(`[TEMPLATE] Processando: ${req.file.originalname} (ID: ${fileId})`);

    // Extrair minutiae usando mindtct
    const success = await nbisService.extractMinutiae(wsqFile, xytFile);

    if (!success) {
      // Limpar arquivo WSQ em caso de erro
      await fs.unlink(wsqFile).catch(() => {});
      
      return res.status(500).json({
        success: false,
        message: 'Falha na extração de minutiae do arquivo WSQ',
        error: 'EXTRACTION_FAILED'
      });
    }

    // Contar minutiae extraídas
    const minutiaeCount = await nbisService.countMinutiae(xytFile);

    if (minutiaeCount === 0) {
      // Limpar arquivos em caso de template inválido
      await Promise.all([
        fs.unlink(wsqFile).catch(() => {}),
        fs.unlink(xytFile).catch(() => {})
      ]);

      return res.status(400).json({
        success: false,
        message: 'Nenhuma minutia foi extraída. Arquivo WSQ pode estar corrompido ou de baixa qualidade.',
        error: 'NO_MINUTIAE'
      });
    }

    const response: ConvertResponse = {
      success: true,
      message: 'Template XYT gerado com sucesso',
      data: {
        originalFile: req.file.originalname,
        xytFile: path.basename(xytFile),
        minutiaeCount,
        filePath: xytFile,
        fileId
      }
    };

    console.log(`[TEMPLATE] Sucesso: ${minutiaeCount} minutiae extraídas`);
    res.json(response);

  } catch (error) {
    console.error('[TEMPLATE] Erro:', error);
    
    // Limpar arquivos em caso de erro
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }

    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: 'INTERNAL_ERROR'
    });
  }
});

/**
 * POST /match
 * 
 * Realiza matching (comparação) entre duas impressões digitais
 * Pode comparar arquivos WSQ ou templates XYT já existentes
 * 
 * @param fingerprint1 - Primeiro arquivo WSQ
 * @param fingerprint2 - Segundo arquivo WSQ
 * @returns Score de matching e indicação se são da mesma pessoa
 */
app.post('/match', upload.fields([
  { name: 'fingerprint1', maxCount: 1 },
  { name: 'fingerprint2', maxCount: 1 }
]), async (req: Request, res: Response) => {
  try {
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };

    if (!files.fingerprint1 || !files.fingerprint2) {
      return res.status(400).json({ 
        success: false,
        message: 'Dois arquivos WSQ são necessários para matching',
        error: 'MISSING_FILES'
      });
    }

    const file1 = files.fingerprint1[0];
    const file2 = files.fingerprint2[0];
    const fileId1 = path.basename(file1.filename, '.wsq');
    const fileId2 = path.basename(file2.filename, '.wsq');

    console.log(`[MATCH] Comparando: ${file1.originalname} vs ${file2.originalname}`);

    // Gerar nomes dos arquivos XYT
    const xyt1 = file1.path.replace('.wsq', '.xyt');
    const xyt2 = file2.path.replace('.wsq', '.xyt');

    // Extrair minutiae dos dois arquivos em paralelo
    const [success1, success2] = await Promise.all([
      nbisService.extractMinutiae(file1.path, xyt1),
      nbisService.extractMinutiae(file2.path, xyt2)
    ]);

    if (!success1 || !success2) {
      // Limpar arquivos em caso de erro
      await Promise.all([
        fs.unlink(file1.path).catch(() => {}),
        fs.unlink(file2.path).catch(() => {}),
        fs.unlink(xyt1).catch(() => {}),
        fs.unlink(xyt2).catch(() => {})
      ]);

      return res.status(500).json({
        success: false,
        message: 'Falha na extração de minutiae de um ou ambos os arquivos',
        error: 'EXTRACTION_FAILED'
      });
    }

    // Contar minutiae extraídas
    const [minutiae1, minutiae2] = await Promise.all([
      nbisService.countMinutiae(xyt1),
      nbisService.countMinutiae(xyt2)
    ]);

    // Verificar se ambos os templates têm minutiae suficientes
    if (minutiae1 === 0 || minutiae2 === 0) {
      await Promise.all([
        fs.unlink(file1.path).catch(() => {}),
        fs.unlink(file2.path).catch(() => {}),
        fs.unlink(xyt1).catch(() => {}),
        fs.unlink(xyt2).catch(() => {})
      ]);

      return res.status(400).json({
        success: false,
        message: 'Um ou ambos os arquivos não possuem minutiae suficientes',
        error: 'INSUFFICIENT_MINUTIAE'
      });
    }

    // Realizar matching usando Bozorth3
    const matchScore = await nbisService.matchFingerprints(xyt1, xyt2);
    const threshold = 40; // Threshold padrão para matching
    const confidence = Math.min((matchScore / 100) * 100, 100);

    const response: MatchResponse = {
      success: true,
      message: 'Matching realizado com sucesso',
      data: {
        fingerprint1: {
          id: fileId1,
          name: file1.originalname,
          minutiae: minutiae1
        },
        fingerprint2: {
          id: fileId2,
          name: file2.originalname,
          minutiae: minutiae2
        },
        matchScore,
        confidence: Math.round(confidence * 100) / 100,
        isMatch: matchScore >= threshold,
        threshold
      }
    };

    console.log(`[MATCH] Score: ${matchScore} | Match: ${matchScore >= threshold ? 'SIM' : 'NÃO'}`);
    res.json(response);

  } catch (error) {
    console.error('[MATCH] Erro:', error);

    // Limpar arquivos em caso de erro
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files) {
      const cleanupPromises = [];
      if (files.fingerprint1) cleanupPromises.push(fs.unlink(files.fingerprint1[0].path).catch(() => {}));
      if (files.fingerprint2) cleanupPromises.push(fs.unlink(files.fingerprint2[0].path).catch(() => {}));
      await Promise.all(cleanupPromises);
    }

    res.status(500).json({
      success: false,
      message: 'Erro interno do servidor',
      error: 'INTERNAL_ERROR'
    });
  }
});

/**
 * GET /health
 * 
 * Endpoint de status da API e verificação das ferramentas NBIS
 * Usado para monitoramento e verificação de dependências
 */
app.get('/health', async (req: Request, res: Response) => {
  try {
    const tools = await nbisService.checkTools();
    const isHealthy = tools.mindtct && tools.bozorth3;

    const response: ApiStatus = {
      service: 'Fingerprint Matching API',
      version: '1.0.0',
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      tools,
      endpoints: [
        {
          method: 'POST',
          path: '/generate-template',
          description: 'Gera template XYT a partir de arquivo WSQ'
        },
        {
          method: 'POST',
          path: '/match',
          description: 'Compara duas impressões digitais WSQ'
        },
        {
          method: 'GET',
          path: '/health',
          description: 'Status da API e ferramentas'
        }
      ]
    };

    const statusCode = isHealthy ? 200 : 503;
    res.status(statusCode).json(response);

  } catch (error) {
    console.error('[HEALTH] Erro:', error);
    res.status(500).json({
      service: 'Fingerprint Matching API',
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Falha ao verificar ferramentas NBIS'
    });
  }
});

/**
 * GET /
 * 
 * Documentação básica da API
 */
app.get('/', (req: Request, res: Response) => {
  res.json({
    service: 'Fingerprint Matching API Base',
    description: 'API base para implementações de biometria usando NBIS',
    version: '1.0.0',
    documentation: {
      endpoints: [
        'POST /generate-template - Gera template XYT',
        'POST /match - Matching entre impressões digitais',
        'GET /health - Status da API'
      ],
      formats: ['WSQ'],
      algorithms: ['NBIS mindtct', 'NBIS bozorth3']
    },
    links: {
      health: '/health',
      documentation: 'README.md'
    }
  });
});

// Middleware de tratamento de erros
app.use((error: any, req: Request, res: Response, next: any) => {
  console.error('[ERROR]', error);

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'Arquivo muito grande. Tamanho máximo: 5MB',
        error: 'FILE_TOO_LARGE'
      });
    }
  }

  res.status(500).json({
    success: false,
    message: 'Erro interno do servidor',
    error: 'INTERNAL_ERROR'
  });
});

// Inicialização da API
const startServer = async () => {
  try {
    // Verificar ferramentas NBIS na inicialização
    const tools = await nbisService.checkTools();
    
    if (!tools.mindtct || !tools.bozorth3) {
      console.error('❌ Ferramentas NBIS não encontradas!');
      console.error('mindtct:', tools.mindtct ? '✅' : '❌');
      console.error('bozorth3:', tools.bozorth3 ? '✅' : '❌');
      process.exit(1);
    }

    // Criar diretório de templates
    await ensureTemplatesDirectory();

    app.listen(PORT, () => {
      console.log('🚀 Fingerprint Matching API iniciada!');
      console.log(`� Servidor: http://localhost:${PORT}`);
      console.log(`� Health Check: http://localhost:${PORT}/health`);
      console.log('✅ Ferramentas NBIS verificadas');
      console.log('📁 Diretório templates: ./templates/');
    });

  } catch (error) {
    console.error('💥 Falha na inicialização:', error);
    process.exit(1);
  }
};

startServer();

export default app;
