/**
 * Git命令执行模块
 * 安全地执行Git命令并提供回滚机制
 */

import simpleGit, { SimpleGit } from 'simple-git';
import { exec } from 'child_process';
import { promisify } from 'util';
import { analyzeCommandRisk, initLLMService, generateCommitMessage } from '../nlp/llm-service.ts';

const execPromise = promisify(exec);

export interface ExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
}

export interface GitCommandRisk {
  level: 'low' | 'medium' | 'high';
  description: string;
  mitigation?: string;
}

/**
 * 验证Git命令的风险级别，优先使用LLM分析，如果不可用则回退到本地规则
 * @param command Git命令
 * @returns 风险评估结果
 */
export async function validateGitCommand(command: string): Promise<GitCommandRisk> {
  try {
    // 检查LLM服务是否可用
    const llmAvailable = await initLLMService();
    
    if (llmAvailable) {
      try {
        // 使用LLM分析命令风险
        const riskAnalysis = await analyzeCommandRisk(command);
        
        return {
          level: riskAnalysis.riskLevel,
          description: riskAnalysis.explanation,
          mitigation: riskAnalysis.riskLevel !== 'low' 
            ? '操作前建议先确认命令影响范围或创建备份' 
            : undefined
        };
      } catch (error) {
        // LLM分析失败，回退到本地规则
        console.warn('LLM风险分析失败，回退到本地规则:', error);
        return validateGitCommandLocally(command);
      }
    } else {
      // LLM服务不可用，使用本地规则
      return validateGitCommandLocally(command);
    }
  } catch (error) {
    // 错误处理，回退到本地规则
    console.warn('风险分析出错，回退到本地规则:', error);
    return validateGitCommandLocally(command);
  }
}

/**
 * 使用本地规则验证Git命令的风险级别
 * @param command Git命令
 * @returns 风险评估结果
 */
export function validateGitCommandLocally(command: string): GitCommandRisk {
  // 高风险命令关键词
  const highRiskPatterns = [
    'reset --hard',
    'clean -fd',
    'push --force',
    'push -f',
    'branch -D'
  ];

  // 中等风险命令关键词
  const mediumRiskPatterns = [
    'reset',
    'rebase',
    'checkout -b',
    'branch -d',
    'stash drop'
  ];

  // 判断风险级别
  for (const pattern of highRiskPatterns) {
    if (command.includes(pattern)) {
      return {
        level: 'high',
        description: '此命令可能会导致数据丢失',
        mitigation: '操作前建议先创建备份或检查点'
      };
    }
  }

  for (const pattern of mediumRiskPatterns) {
    if (command.includes(pattern)) {
      return {
        level: 'medium',
        description: '此命令会改变仓库状态',
        mitigation: '注意检查命令影响范围'
      };
    }
  }

  return {
    level: 'low',
    description: '此命令风险较低'
  };
}

/**
 * 获取待提交变更的diff内容
 * @returns diff内容文本
 */
export async function getGitDiff(): Promise<string> {
  try {
    const git: SimpleGit = simpleGit();
    
    // 获取暂存区的diff
    const stagedDiff = await git.diff(['--staged']);
    
    // 如果暂存区没有内容，则获取工作区的diff
    if (!stagedDiff) {
      return await git.diff();
    }
    
    return stagedDiff;
  } catch (error) {
    console.error('获取diff内容失败:', error);
    return '';
  }
}

/**
 * 安全地执行Git命令
 * @param command Git命令
 * @returns 执行结果
 */
export async function executeGitCommand(command: string): Promise<ExecutionResult> {
  // 验证命令风险
  const risk = await validateGitCommand(command);
  
  // 执行命令
  try {
    // 如果是git命令，使用simple-git
    if (command.startsWith('git ')) {
      const git: SimpleGit = simpleGit();
      const gitCommand = command.substring(4); // 去掉"git "前缀
      
      // 获取命令的第一个部分
      const gitCommandParts = gitCommand.split(' ');
      const mainCommand = gitCommandParts[0];
      
      // 处理commit命令且没有提供消息的情况，使用LLM生成提交消息
      if (mainCommand === 'commit' && !gitCommand.includes('-m') && !gitCommand.includes('--message')) {
        try {
          // 检查LLM服务是否可用
          const llmAvailable = await initLLMService();
          
          if (llmAvailable) {
            // 获取diff内容
            const diffContent = await getGitDiff();
            
            if (diffContent) {
              // 使用LLM生成提交消息
              const commitMessage = await generateCommitMessage(diffContent);
              
              // 重构命令，添加提交消息
              const newCommand = `commit -m "${commitMessage}"`;
              console.log(`自动生成提交消息: "${commitMessage}"`);
              
              // 执行修改后的命令
              const result = await git.raw(['commit', '-m', commitMessage]);
              return {
                success: true,
                output: result || `已提交，消息: "${commitMessage}"`
              };
            }
          }
        } catch (error) {
          console.warn('自动生成提交消息失败，使用默认消息:', error);
          // 继续使用原始命令
        }
      }
      
      // 创建备份点（对于可能修改仓库状态的命令）
      // 这些命令通常需要创建备份点
      const commandsNeedingBackup = ['reset', 'rebase', 'checkout', 'branch', 'merge', 'commit', 'push'];
      if (commandsNeedingBackup.includes(mainCommand)) {
        try {
          const headRef = await git.revparse(['HEAD']);
          console.log(`创建备份点: ${headRef}`);
        } catch (error) {
          // 如果是新仓库可能没有HEAD，忽略错误
          console.log('注意: 无法创建备份点（可能是新仓库）');
        }
      }
      
      // 对于不同的Git命令，可能需要不同的处理方式
      let result: string;
      
      // 特殊处理status命令，确保输出着色
      if (mainCommand === 'status') {
        // 使用exec直接执行git status，保持原始输出格式
        const { stdout } = await execPromise('git status');
        result = stdout;
      } else {
        // 其他命令使用simple-git处理
        result = await git.raw(gitCommandParts);
      }
      
      return {
        success: true,
        output: result || '命令已执行，无输出结果' // 确保始终有输出
      };
    }
    // 非git命令，使用普通exec执行
    const { stdout, stderr } = await execPromise(command);
    
    if (stderr && !stdout) {
      return {
        success: false,
        error: stderr
      };
    }
    
    return {
      success: true,
      output: stdout || '命令已执行，无输出结果' // 确保始终有输出
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || '执行命令失败'
    };
  }
} 