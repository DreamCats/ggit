/**
 * GT-NL: 智能Git助手
 * 通过自然语言理解简化Git操作，提供代码分析和安全保障
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { initCLI } from './cli/index.ts';

async function main() {
  console.log(chalk.blue('GT-NL - 智能Git助手'));
  console.log(chalk.dim('版本 0.1.0'));
  console.log('');
  
  // 初始化命令行界面
  const program = new Command();
  initCLI(program);
  
  // 解析命令行参数
  await program.parseAsync(process.argv);
}

main().catch(error => {
  console.error(chalk.red('错误:'), error.message);
  process.exit(1);
}); 