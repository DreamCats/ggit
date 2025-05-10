#!/usr/bin/env node

/**
 * 测试包含特殊字符的提交消息处理
 * 
 * 使用方法:
 * 1. 运行本脚本: node tests/commit-message-test.js
 */

import { executeGitCommand } from '../src/core/git/executor.ts';
import chalk from 'chalk';
import inquirer from 'inquirer';

const TEST_COMMIT_MESSAGES = [
  'chore: 简单的提交消息', 
  'fix: 修复"引号bug"',
  'feat: 添加\'单引号\'功能',
  'refactor: 重构 "引号" 和 \'单引号\' 混合的代码',
  'test: 测试 `反引号` *星号* "双引号"'
];

async function testCommitMessages() {
  console.log(chalk.blue.bold('=== 提交消息特殊字符测试 ==='));
  
  // 检查git仓库状态
  const statusResult = await executeGitCommand('git status');
  if (!statusResult.success) {
    console.log(chalk.red('错误: 当前目录不是Git仓库，或Git未正确配置'));
    return;
  }
  
  // 显示测试提交消息
  console.log(chalk.yellow('\n测试提交消息:'));
  TEST_COMMIT_MESSAGES.forEach((msg, i) => {
    console.log(chalk.dim(`${i + 1}. ${msg}`));
  });
  
  // 让用户选择测试消息
  const { messageIndex, customMessage, useCustom } = await inquirer.prompt([
    {
      type: 'list',
      name: 'messageIndex',
      message: '请选择要测试的提交消息:',
      choices: TEST_COMMIT_MESSAGES.map((msg, i) => ({ name: msg, value: i })).concat([
        { name: '输入自定义提交消息', value: -1 }
      ])
    },
    {
      type: 'input',
      name: 'customMessage',
      message: '请输入自定义提交消息:',
      when: (answers) => answers.messageIndex === -1,
      validate: (input) => input.trim() ? true : '请输入有效的提交消息'
    },
    {
      type: 'confirm',
      name: 'useCustom',
      message: '是否使用自定义提交消息?',
      default: true,
      when: (answers) => answers.messageIndex === -1
    }
  ]);
  
  // 获取要测试的提交消息
  const messageToTest = messageIndex === -1 && useCustom
    ? customMessage
    : TEST_COMMIT_MESSAGES[messageIndex];
  
  console.log(chalk.blue.bold('\n测试提交消息:'), chalk.bold(messageToTest));
  
  // 确认是否要进行测试提交
  const { shouldProceed } = await inquirer.prompt([{
    type: 'confirm',
    name: 'shouldProceed',
    message: '此测试将在当前git仓库创建一个提交，确认继续吗?',
    default: false
  }]);
  
  if (!shouldProceed) {
    console.log(chalk.yellow('测试已取消'));
    return;
  }
  
  // 测试步骤1: 创建测试文件
  console.log(chalk.dim('1. 创建测试文件...'));
  const testFileResult = await executeGitCommand('echo "测试文件内容" > test-commit-message.txt');
  if (!testFileResult.success) {
    console.log(chalk.red('创建测试文件失败:'), testFileResult.error);
    return;
  }
  
  // 测试步骤2: 添加测试文件
  console.log(chalk.dim('2. 添加测试文件到暂存区...'));
  const addResult = await executeGitCommand('git add test-commit-message.txt');
  if (!addResult.success) {
    console.log(chalk.red('添加文件失败:'), addResult.error);
    return;
  }
  
  // 测试步骤3: 转义提交消息中的单引号，然后用单引号包裹整个消息
  console.log(chalk.dim('3. 提交测试文件...'));
  const escapedMessage = messageToTest.replace(/'/g, "'\\''");
  const commitResult = await executeGitCommand(`git commit -m '${escapedMessage}'`);
  
  if (commitResult.success) {
    console.log(chalk.green('✓ 提交成功!'));
    console.log(commitResult.output);
    
    // 显示提交历史以验证
    console.log(chalk.dim('\n验证提交历史:'));
    const logResult = await executeGitCommand('git log -1');
    if (logResult.success) {
      console.log(logResult.output);
    }
  } else {
    console.log(chalk.red('✗ 提交失败:'), commitResult.error);
  }
  
  // 询问是否要恢复
  const { shouldRevert } = await inquirer.prompt([{
    type: 'confirm',
    name: 'shouldRevert',
    message: '测试完成。是否要恢复（回退提交并删除测试文件）?',
    default: true
  }]);
  
  if (shouldRevert) {
    console.log(chalk.dim('正在恢复...'));
    await executeGitCommand('git reset --hard HEAD~1');
    console.log(chalk.green('已恢复到测试前状态'));
  }
  
  console.log(chalk.green.bold('\n测试完成!'));
}

// 运行测试
testCommitMessages().catch(console.error); 