/**
 * GT-NL: 智能Git助手
 * 通过自然语言理解简化Git操作，提供代码分析和安全保障
 */

import { Command } from 'commander';
import { initCLI } from './src/cli/index.ts';

// 初始化命令行界面
const program = new Command();
initCLI(program);

// 解析命令行参数
program.parse(process.argv);