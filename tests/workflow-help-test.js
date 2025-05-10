#!/usr/bin/env node

/**
 * 测试工作流帮助功能
 * 
 * 使用方法:
 * 1. 运行本脚本: node tests/workflow-help-test.js
 */

import { initWorkflowEngine } from '../src/core/workflow/index.ts';
import chalk from 'chalk';

/**
 * 运行工作流帮助测试
 */
async function runWorkflowHelpTest() {
  console.log(chalk.blue.bold('=== 工作流帮助功能测试 ==='));
  
  // 初始化工作流引擎
  const workflowEngine = initWorkflowEngine();
  console.log(chalk.green('✓ 工作流引擎已初始化'));
  
  console.log(chalk.dim('\n显示工作流帮助信息...\n'));
  
  // 显示工作流帮助信息
  try {
    await workflowEngine.showHelp();
    console.log(chalk.green.bold('\n测试完成!'));
  } catch (error) {
    console.error(chalk.red('\n测试失败:'), error);
  }
}

// 运行测试
runWorkflowHelpTest().catch(console.error); 