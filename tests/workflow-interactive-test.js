#!/usr/bin/env node

/**
 * 测试带有退出选项的交互式工作流
 * 
 * 使用方法:
 * 1. 确保已配置LLM服务 (gt config -k "your-api-key")
 * 2. 运行本脚本: node tests/workflow-interactive-test.js
 */

import { initWorkflowEngine } from '../src/core/workflow/index.ts';
import { initLLMService } from '../src/core/nlp/llm-service.ts';
import chalk from 'chalk';
import { executeGitCommand } from '../src/core/git/executor.ts';

// 测试命令集
const TEST_COMMANDS = [
  '提交当前所有修改',
  '统计代码变更并提交',
  '查看代码行数统计，然后选择性提交部分文件',
  '检查状态、统计代码并提交推送'
];

/**
 * 显示工作流帮助信息
 */
function showHelpInfo() {
  console.log(chalk.blue.bold('\n=== 工作流退出选项说明 ==='));
  console.log(chalk.dim('在执行工作流的过程中，您可以随时选择以下操作:'));
  console.log('');
  console.log(chalk.green('• 继续执行当前步骤:') + ' 完成当前步骤并继续工作流');
  console.log(chalk.yellow('• 跳过当前步骤:') + ' 跳过当前步骤，进入下一步');
  console.log(chalk.red('• 退出工作流:') + ' 立即结束整个工作流');
  console.log('');
  console.log(chalk.dim('在各个步骤中还有更多特定的选项，可以控制工作流的进程。'));
  console.log(chalk.dim('请在交互过程中查看选项并做出选择。'));
  console.log('');
}

/**
 * 运行工作流测试
 */
async function runInteractiveWorkflowTest() {
  console.log(chalk.blue.bold('=== 带退出选项的交互式工作流测试 ==='));
  
  // 检查是否在Git仓库中
  const gitStatusResult = await executeGitCommand('git status');
  if (!gitStatusResult.success) {
    console.log(chalk.red('错误: 当前目录不是Git仓库，或Git未正确配置'));
    return;
  }
  
  // 初始化LLM服务
  const llmAvailable = await initLLMService();
  if (!llmAvailable) {
    console.log(chalk.yellow('警告: LLM服务未配置，一些高级功能可能无法使用'));
    console.log(chalk.yellow('提示: 使用 "gt config -k YOUR_API_KEY" 设置API密钥'));
  } else {
    console.log(chalk.green('✓ LLM服务已初始化'));
  }
  
  // 显示测试命令列表
  console.log(chalk.yellow('\n可用测试命令:'));
  TEST_COMMANDS.forEach((cmd, i) => {
    console.log(chalk.dim(`${i + 1}. ${cmd}`));
  });
  
  // 显示交互式工作流帮助
  showHelpInfo();
  
  // 导入inquirer
  const inquirer = (await import('inquirer')).default;
  
  // 让用户选择要测试的命令
  const { commandIndex, customCommand, useCustom } = await inquirer.prompt([
    {
      type: 'list',
      name: 'commandIndex',
      message: '请选择要测试的命令:',
      choices: TEST_COMMANDS.map((cmd, i) => ({ name: cmd, value: i })).concat([
        { name: '输入自定义命令', value: -1 }
      ])
    },
    {
      type: 'input',
      name: 'customCommand',
      message: '请输入自定义命令:',
      when: (answers) => answers.commandIndex === -1,
      validate: (input) => input.trim() ? true : '请输入有效的命令'
    },
    {
      type: 'confirm',
      name: 'useCustom',
      message: '是否使用自定义命令?',
      default: true,
      when: (answers) => answers.commandIndex === -1
    }
  ]);
  
  // 获取要测试的命令
  const commandToTest = commandIndex === -1 && useCustom
    ? customCommand
    : TEST_COMMANDS[commandIndex];
  
  console.log(chalk.blue.bold('\n开始测试命令:'), chalk.bold(commandToTest));
  console.log(chalk.dim('工作流即将开始执行，请跟随步骤进行交互...'));
  console.log(chalk.dim('在每个步骤中，您都可以选择继续、跳过或退出'));
  console.log('');
  
  // 执行工作流
  try {
    // 初始化工作流引擎
    const workflowEngine = initWorkflowEngine();
    
    await workflowEngine.processInput(commandToTest);
    console.log(chalk.green.bold('\n测试完成!'));
  } catch (error) {
    console.error(chalk.red('\n测试失败:'), error);
  }
}

// 运行测试
runInteractiveWorkflowTest().catch(console.error); 