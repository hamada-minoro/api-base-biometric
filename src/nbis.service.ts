import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Configuração dos caminhos das ferramentas NBIS
 */
export interface NBISConfig {
  mindtct: string;  // Caminho para o executável mindtct
  bozorth3: string; // Caminho para o executável bozorth3
}

/**
 * Resultado da execução de um comando
 */
export interface CommandResult {
  stdout: string;
  stderr: string;
  code: number;
}

/**
 * Serviço para processamento biométrico usando NBIS
 * 
 * O NBIS (NIST Biometric Image Software) é uma suíte de ferramentas
 * desenvolvida pelo NIST para processamento de impressões digitais.
 * 
 * Principais funcionalidades:
 * - mindtct: Extração de minutiae de imagens WSQ
 * - bozorth3: Matching (comparação) entre templates de minutiae
 */
export class NBISService {
  private config: NBISConfig;

  constructor() {
    this.config = {
      mindtct: path.join(__dirname, '../bin/mindtct'),
      bozorth3: path.join(__dirname, '../bin/bozorth3'),
    };
  }

  /**
   * Executa um comando do sistema com timeout e tratamento de erros
   */
  private runCommand(command: string, args: string[], timeoutMs: number = 30000): Promise<CommandResult> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args);
      let stdout = '';
      let stderr = '';
      let isTimeout = false;

      // Timeout de segurança
      const timeout = setTimeout(() => {
        isTimeout = true;
        process.kill('SIGKILL');
        reject({
          error: 'Timeout na execução do comando',
          stdout,
          stderr,
          code: -1
        });
      }, timeoutMs);

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        clearTimeout(timeout);
        if (!isTimeout) {
          if (code === 0) {
            resolve({ stdout, stderr, code });
          } else {
            reject({ stdout, stderr, code });
          }
        }
      });

      process.on('error', (error) => {
        clearTimeout(timeout);
        if (!isTimeout) {
          reject({ 
            error: error.message, 
            stdout, 
            stderr, 
            code: -1 
          });
        }
      });
    });
  }

  /**
   * Extrai minutiae de um arquivo WSQ usando mindtct
   * 
   * @param wsqFile Caminho para o arquivo WSQ de entrada
   * @param outputXyt Caminho para o arquivo XYT de saída
   * @returns true se a extração foi bem-sucedida
   */
  async extractMinutiae(wsqFile: string, outputXyt: string): Promise<boolean> {
    try {
      // Verificar se arquivo WSQ existe e é legível
      await fs.access(wsqFile, fs.constants.R_OK);

      // Preparar diretório de saída
      const outputDir = path.dirname(outputXyt);
      await fs.mkdir(outputDir, { recursive: true });

      // Nome base para mindtct (sem extensão)
      const baseName = path.basename(outputXyt, '.xyt');
      const oroot = path.join(outputDir, baseName);

      // Executar mindtct com qualidade média (-m1)
      const args = ['-m1', wsqFile, oroot];
      console.log(`[NBIS] mindtct: ${args.join(' ')}`);
      
      await this.runCommand(this.config.mindtct, args);

      // Verificar se arquivo XYT foi criado
      const expectedXyt = `${oroot}.xyt`;
      
      try {
        await fs.access(expectedXyt, fs.constants.R_OK);
        
        // Mover para local correto se necessário
        if (expectedXyt !== outputXyt) {
          await fs.rename(expectedXyt, outputXyt);
        }

        console.log(`[NBIS] XYT criado: ${path.basename(outputXyt)}`);
        return true;

      } catch {
        console.error(`[NBIS] Arquivo XYT não foi criado: ${expectedXyt}`);
        return false;
      }

    } catch (error: any) {
      console.error('[NBIS] Erro na extração de minutiae:', error.error || error.message || error);
      return false;
    }
  }

  /**
   * Conta o número de minutiae em um arquivo XYT
   * 
   * @param xytFile Caminho para o arquivo XYT
   * @returns Número de minutiae encontradas
   */
  async countMinutiae(xytFile: string): Promise<number> {
    try {
      const content = await fs.readFile(xytFile, 'utf8');
      const lines = content.split('\n').filter(line => {
        const trimmed = line.trim();
        // Filtrar linhas vazias e comentários
        return trimmed && !trimmed.startsWith('#');
      });
      
      console.log(`[NBIS] Minutiae encontradas: ${lines.length}`);
      return lines.length;
      
    } catch (error) {
      console.error(`[NBIS] Erro ao contar minutiae em ${xytFile}:`, error);
      return 0;
    }
  }

  /**
   * Realiza matching entre dois arquivos XYT usando bozorth3
   * 
   * @param xyt1 Caminho para o primeiro arquivo XYT
   * @param xyt2 Caminho para o segundo arquivo XYT
   * @returns Score de matching (0 = sem match, maior = melhor match)
   */
  async matchFingerprints(xyt1: string, xyt2: string): Promise<number> {
    try {
      // Verificar se ambos os arquivos existem
      await Promise.all([
        fs.access(xyt1, fs.constants.R_OK),
        fs.access(xyt2, fs.constants.R_OK)
      ]);

      // Executar bozorth3 com modo prova (-p)
      const args = ['-p', xyt1, xyt2];
      console.log(`[NBIS] bozorth3: ${args.join(' ')}`);
      
      const result = await this.runCommand(this.config.bozorth3, args);
      
      const score = parseInt(result.stdout.trim());
      const finalScore = isNaN(score) ? 0 : score;
      
      console.log(`[NBIS] Score: ${finalScore}`);
      return finalScore;

    } catch (error: any) {
      console.error('[NBIS] Erro no matching:', error.error || error.message || error);
      return 0;
    }
  }

  /**
   * Verifica se as ferramentas NBIS estão disponíveis
   */
  async checkTools(): Promise<{ mindtct: boolean; bozorth3: boolean }> {
    const checkTool = async (toolPath: string): Promise<boolean> => {
      try {
        await fs.access(toolPath);
        return true;
      } catch {
        return false;
      }
    };

    return {
      mindtct: await checkTool(this.config.mindtct),
      bozorth3: await checkTool(this.config.bozorth3),
    };
  }
}
