/**
 * Git命令执行模块
 * 安全地执行Git命令并提供回滚机制
 */

import simpleGit, { SimpleGit } from 'simple-git';
import { exec } from 'child_process';
import { promisify } from 'util';

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
 * 验证Git命令的风险级别
 * @param command Git命令
 * @returns 风险评估结果
 */
export function validateGitCommand(command: string): GitCommandRisk {
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
 * 安全地执行Git命令
 * @param command Git命令
 * @returns 执行结果
 */
export async function executeGitCommand(command: string): Promise<ExecutionResult> {
  // 执行命令
  try {
    // 如果是git命令，使用simple-git
    if (command.startsWith('git ')) {
      const git: SimpleGit = simpleGit();
      const gitCommand = command.substring(4); // 去掉"git "前缀
      
      // 获取命令的第一个部分
      const gitCommandParts = gitCommand.split(' ');
      const mainCommand = gitCommandParts[0];
      
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
    } else {
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
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || '执行命令失败'
    };
  }
} 