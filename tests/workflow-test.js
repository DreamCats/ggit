#!/usr/bin/env node

/**
 * 测试交互式工作流功能
 * 
 * 使用方法:
 * 1. 确保已配置LLM服务 (gt config -k "your-api-key")
 * 2. 运行本脚本: node tests/workflow-test.js
 */

import { initWorkflowEngine } from '../src/core/workflow/index.ts';
import { initLLMService } from '../src/core/nlp/llm-service.ts';
import chalk from 'chalk';

// 测试命令集
const TEST_COMMANDS = [
  '提交当前所有修改',
  '帮我检查仓库状态',
  '提交代码并推送到远程仓库',
  '提交并给修改文件生成一个好的提交消息'
];

/**
 * 运行工作流测试
 */
async function runWorkflowTest() {
  console.log(chalk.blue.bold('=== 交互式工作流测试 ==='));
  
  // 初始化LLM服务
  const llmAvailable = await initLLMService();
  if (!llmAvailable) {
    console.log(chalk.red('错误: LLM服务未配置，请先运行 "gt config -k YOUR_API_KEY" 设置API密钥'));
    return;
  }
  
  console.log(chalk.green('✓ LLM服务已初始化'));
  
  // 初始化工作流引擎
  const workflowEngine = initWorkflowEngine();
  console.log(chalk.green('✓ 工作流引擎已初始化'));
  
  // 显示测试命令列表
  console.log(chalk.yellow('\n可用测试命令:'));
  TEST_COMMANDS.forEach((cmd, i) => {
    console.log(chalk.dim(`${i + 1}. ${cmd}`));
  });
  
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
  
  // 执行工作流
  try {
    await workflowEngine.processInput(commandToTest);
    console.log(chalk.green.bold('\n测试完成!'));
  } catch (error) {
    console.error(chalk.red('\n测试失败:'), error);
  }
}

// 运行测试
runWorkflowTest().catch(console.error); 