/**
 * CLI模块入口
 * 定义命令行接口和交互逻辑
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { processNaturalLanguage } from '../core/nlp/processor.ts';
import { executeGitCommand } from '../core/git/executor.ts';
import { analyzeCodes } from '../core/analysis/analyzer.ts';

/**
 * 初始化CLI界面
 * @param program Commander实例
 */
export function initCLI(program: Command): void {
  program
    .name('gt')
    .description('GT-NL 智能Git助手，通过自然语言实现Git操作')
    .version('0.1.0');

  // 自然语言命令（默认命令）
  program
    .argument('[command...]', '通过自然语言描述要执行的Git操作')
    .action(async (args: string[]) => {
      const command = args.join(' ');
      
      if (!command) {
        // 如果没有提供命令，显示帮助
        program.help();
        return;
      }
      
      try {
        // 处理自然语言命令
        console.log(chalk.dim(`正在处理: "${command}"`));
        const gitCommand = await processNaturalLanguage(command);
        
        // 预览命令
        console.log('');
        console.log(chalk.blue('即将执行:'), chalk.bold(gitCommand));
        
        // 请求确认
        const { confirmed } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirmed',
          message: '确认执行?',
          default: true
        }]);
        
        if (confirmed) {
          // 执行命令
          const result = await executeGitCommand(gitCommand);
          console.log(chalk.green('执行成功!'));
          if (result.output) {
            console.log(result.output);
          }
        } else {
          console.log(chalk.yellow('已取消执行'));
        }
      } catch (error: any) {
        console.error(chalk.red('处理失败:'), error.message || String(error));
      }
    });

  // 代码分析命令
  program
    .command('scan')
    .description('扫描代码库，识别安全风险、代码质量问题等')
    .option('-s, --security', '仅扫描安全风险')
    .option('-q, --quality', '仅扫描代码质量问题')
    .option('-p, --path <path>', '指定扫描路径', '.')
    .action(async (options: { security?: boolean, quality?: boolean, path: string }) => {
      try {
        console.log(chalk.blue('开始扫描代码...'));
        const results = await analyzeCodes(options.path, {
          security: options.security,
          quality: options.quality
        });
        
        console.log('');
        console.log(chalk.green('扫描完成!'));
        
        // 显示扫描结果
        // 暂未实现具体显示逻辑
        console.log('发现问题总数:', results.issueCount);
      } catch (error: any) {
        console.error(chalk.red('扫描失败:'), error.message || String(error));
      }
    });

  // 帮助命令（列出常用Git操作示例）
  program
    .command('examples')
    .description('显示自然语言命令示例')
    .action(() => {
      console.log(chalk.blue('自然语言命令示例:'));
      console.log('');
      console.log('  $ gt 提交所有修改，备注修复登录BUG');
      console.log('  $ gt 创建一个名为feature/user-auth的新分支');
      console.log('  $ gt 对比昨天和今天的改动');
      console.log('  $ gt 切换到master分支并拉取最新代码');
      console.log('  $ gt 撤销最近的一次提交但保留代码');
    });
} 