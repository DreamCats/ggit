#!/usr/bin/env bun

/**
 * LLM生成Git命令测试脚本
 * 用于验证generateGitCommand功能是否正常工作
 */

import { generateGitCommand, initLLMService } from '../src/core/nlp/llm-service.ts';
import chalk from 'chalk';

const TEST_COMMANDS = [
  '查看状态',
  '提交所有修改，备注修复登录BUG',
  '创建一个名为feature/auth的新分支',
  '查看最近10次提交记录，使用简洁格式',
  '切换到主分支并拉取最新代码'
];

async function main() {
  console.log(chalk.blue('测试LLM生成Git命令功能'));
  console.log('');
  
  try {
    // 初始化LLM服务
    console.log(chalk.dim('初始化LLM服务...'));
    const initialized = await initLLMService();
    
    if (!initialized) {
      console.error(chalk.red('错误: LLM服务初始化失败，请先设置API密钥'));
      console.log(chalk.yellow('提示: 运行 `bun run src/index.ts config` 设置API密钥'));
      process.exit(1);
    }
    
    console.log(chalk.green('✓ LLM服务初始化成功'));
    console.log('');
    
    // 测试每个命令
    for (const [index, command] of TEST_COMMANDS.entries()) {
      console.log(chalk.dim(`测试 ${index + 1}/${TEST_COMMANDS.length}: "${command}"`));
      
      try {
        console.time('执行时间');
        const result = await generateGitCommand(command);
        console.timeEnd('执行时间');
        
        console.log(chalk.green('✓ 命令生成成功'));
        console.log('');
        console.log(chalk.blue('生成的Git命令:'), chalk.bold(result.command));
        console.log(chalk.blue('解释:'), result.explanation);
        console.log(chalk.blue('置信度:'), result.confidence);
        
        if (result.alternatives && result.alternatives.length > 0) {
          console.log(chalk.blue('备选命令:'));
          result.alternatives.forEach((alt, i) => {
            console.log(`  ${i + 1}. ${alt}`);
          });
        }
        
        console.log('\n' + '-'.repeat(50) + '\n');
      } catch (error) {
        console.error(chalk.red(`错误: 处理命令 "${command}" 失败`));
        console.error(error);
        console.log('\n' + '-'.repeat(50) + '\n');
      }
    }
    
    console.log(chalk.green('所有测试完成!'));
    
  } catch (error) {
    console.error(chalk.red('测试过程中发生错误:'), error);
    process.exit(1);
  }
}

main(); 