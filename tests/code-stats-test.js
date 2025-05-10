#!/usr/bin/env node

/**
 * 测试代码统计功能
 * 
 * 使用方法:
 * 1. 确保已配置LLM服务 (gt config -k "your-api-key")
 * 2. 运行本脚本: node tests/code-stats-test.js
 */

import { initWorkflowEngine } from '../src/core/workflow/index.ts';
import { initLLMService } from '../src/core/nlp/llm-service.ts';
import { executeGitCommand } from '../src/core/git/executor.ts';
import chalk from 'chalk';

/**
 * 运行代码统计测试
 */
async function runCodeStatsTest() {
  console.log(chalk.blue.bold('=== 代码统计功能测试 ==='));
  
  // 初始化LLM服务
  const llmAvailable = await initLLMService();
  if (!llmAvailable) {
    console.log(chalk.yellow('警告: LLM服务未配置，功能可能受限'));
  }
  
  // 快速检查是否在Git仓库中
  const gitStatusResult = await executeGitCommand('git status');
  if (!gitStatusResult.success) {
    console.log(chalk.red('错误: 当前目录不是Git仓库，或Git未正确配置'));
    return;
  }
  
  // 获取测试命令
  const testCommands = [
    '统计一下当前代码变更情况',
    '帮我计算代码行数',
    '我想查看代码变更统计信息并提交',
    '生成当前修改的代码统计报告'
  ];
  
  console.log(chalk.yellow('\n可用的测试命令:'));
  testCommands.forEach((cmd, i) => {
    console.log(`${i + 1}. ${cmd}`);
  });
  
  // 使用 inquirer 让用户选择测试命令
  const inquirer = (await import('inquirer')).default;
  const { selectedCommand } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedCommand',
      message: '请选择要测试的命令:',
      choices: testCommands.map((cmd, i) => ({ name: cmd, value: cmd }))
    }
  ]);
  
  console.log(chalk.blue.bold(`\n执行命令: ${selectedCommand}`));
  
  // 初始化工作流引擎
  const workflowEngine = initWorkflowEngine();
  
  try {
    // 执行选择的命令
    await workflowEngine.processInput(selectedCommand);
    console.log(chalk.green.bold('\n测试完成!'));
  } catch (error) {
    console.error(chalk.red('\n测试失败:'), error);
  }
}

// 运行测试
runCodeStatsTest().catch(error => {
  console.error(chalk.red('测试过程中发生错误:'), error);
}); 