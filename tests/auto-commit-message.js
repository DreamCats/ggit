#!/usr/bin/env node

/**
 * 测试自动生成提交消息功能
 * 
 * 使用方法:
 * 1. 确保已配置LLM服务 (gt config -k "your-api-key")
 * 2. 对文件进行修改
 * 3. 运行本脚本: node tests/auto-commit-message.js
 */

import { executeGitCommand, getGitDiff } from '../src/core/git/executor.ts';
import { generateCommitMessage, initLLMService } from '../src/core/nlp/llm-service.ts';
import { processNaturalLanguage } from '../src/core/nlp/processor.ts';

// 颜色函数
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  underscore: '\x1b[4m',
  blink: '\x1b[5m',
  reverse: '\x1b[7m',
  hidden: '\x1b[8m',
  
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

/**
 * 测试从自然语言生成Git命令（不指定提交消息）
 */
async function testNaturalLanguageToCommit() {
  console.log(`${colors.blue}${colors.bright}测试自然语言处理（不指定提交消息）${colors.reset}`);
  
  try {
    // 测试自然语言处理
    const input = "提交当前所有修改";
    console.log(`${colors.dim}用户输入: "${input}"${colors.reset}`);
    
    const command = await processNaturalLanguage(input);
    console.log(`${colors.green}生成命令: ${command}${colors.reset}`);
    
    console.log(`\n${colors.yellow}此命令将在执行时自动生成提交消息${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}测试失败: ${error.message}${colors.reset}`);
  }
}

/**
 * 测试直接从diff生成提交消息
 */
async function testGenerateCommitMessage() {
  console.log(`\n${colors.blue}${colors.bright}测试从diff内容生成提交消息${colors.reset}`);
  
  try {
    // 初始化LLM服务
    const llmAvailable = await initLLMService();
    
    if (!llmAvailable) {
      console.log(`${colors.yellow}LLM服务未配置，请先设置API密钥: gt config -k "your-api-key"${colors.reset}`);
      return;
    }
    
    // 获取diff内容
    console.log(`${colors.dim}获取Git仓库diff内容...${colors.reset}`);
    const diffContent = await getGitDiff();
    
    if (!diffContent) {
      console.log(`${colors.yellow}没有待提交的修改，请先修改文件${colors.reset}`);
      return;
    }
    
    // 显示部分diff内容
    const previewLines = diffContent.split('\n').slice(0, 5).join('\n');
    console.log(`${colors.dim}diff预览:\n${previewLines}\n...${colors.reset}`);
    
    // 生成提交消息
    console.log(`${colors.dim}生成提交消息...${colors.reset}`);
    const commitMessage = await generateCommitMessage(diffContent);
    
    // 显示结果
    console.log(`${colors.green}生成的提交消息: "${commitMessage}"${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}测试失败: ${error.message}${colors.reset}`);
  }
}

/**
 * 测试执行不带消息的提交命令
 */
async function testExecuteCommitWithoutMessage() {
  console.log(`\n${colors.blue}${colors.bright}测试执行提交命令（不指定消息）${colors.reset}`);
  
  try {
    // 初始化LLM服务
    const llmAvailable = await initLLMService();
    
    if (!llmAvailable) {
      console.log(`${colors.yellow}LLM服务未配置，无法自动生成提交消息${colors.reset}`);
      return;
    }
    
    console.log(`${colors.dim}添加所有修改到暂存区...${colors.reset}`);
    await executeGitCommand('git add -A');
    
    console.log(`${colors.dim}执行不带消息的提交命令...${colors.reset}`);
    console.log(`${colors.yellow}注意: 在实际场景中，这将自动生成提交消息${colors.reset}`);
    console.log(`${colors.yellow}本测试不会实际执行提交，以避免影响您的仓库${colors.reset}`);
    
    // 在实际场景中，这将自动生成提交消息
    // const result = await executeGitCommand('git commit');
    // console.log(`${colors.green}执行结果: ${result.output}${colors.reset}`);
  } catch (error) {
    console.error(`${colors.red}测试失败: ${error.message}${colors.reset}`);
  }
}

/**
 * 主函数
 */
async function main() {
  console.log(`${colors.bright}===== 自动生成提交消息功能测试 =====${colors.reset}\n`);
  
  // 测试从自然语言生成Git命令
  await testNaturalLanguageToCommit();
  
  // 测试从diff生成提交消息
  await testGenerateCommitMessage();
  
  // 测试执行不带消息的提交命令
  await testExecuteCommitWithoutMessage();
  
  console.log(`\n${colors.bright}===== 测试完成 =====${colors.reset}`);
}

// 执行主函数
main().catch(error => {
  console.error(`${colors.red}执行失败: ${error.message}${colors.reset}`);
}); 