#!/usr/bin/env node

/**
 * 测试无LLM的工作流功能
 * 
 * 使用方法:
 * 1. 运行本脚本: node tests/workflow-no-llm-test.js
 */

import { initWorkflowEngine } from '../src/core/workflow/index.ts';
import chalk from 'chalk';
import { executeGitCommand } from '../src/core/git/executor.ts';

// 测试命令集
const TEST_COMMANDS = [
  '提交当前所有修改',
  '统计代码变更',
  '提交并推送到远程',
  '检查仓库状态'
];

/**
 * 运行无LLM工作流测试
 */
async function runNoLLMWorkflowTest() {
  console.log(chalk.blue.bold('=== 无LLM服务的工作流测试 ==='));
  
  // 快速检查是否在Git仓库中
  const gitStatusResult = await executeGitCommand('git status');
  if (!gitStatusResult.success) {
    console.log(chalk.red('错误: 当前目录不是Git仓库，或Git未正确配置'));
    return;
  }
  
  console.log(chalk.dim('本测试将模拟未配置LLM服务的情况下使用工作流功能'));
  console.log(chalk.dim('工作流引擎应当能够提供基本功能，尽管没有智能分析能力'));
  
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
  console.log('');
  
  // 不初始化LLM服务，直接使用工作流引擎
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
runNoLLMWorkflowTest().catch(console.error); 