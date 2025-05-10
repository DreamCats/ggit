#!/usr/bin/env bun

/**
 * 命令风险分析测试脚本
 * 用于验证analyzeCommandRisk功能是否正常工作
 */

import { analyzeCommandRisk, initLLMService } from '../src/core/nlp/llm-service.ts';
import chalk from 'chalk';

const TEST_COMMANDS = [
  'git status',                     // 低风险
  'git commit -m "Fix login bug"',  // 低风险
  'git checkout -b feature/auth',   // 中等风险
  'git reset HEAD~1',               // 中等风险
  'git reset --hard HEAD~3',        // 高风险
  'git push --force origin main',   // 高风险
  'git clean -fd'                   // 高风险
];

async function main() {
  console.log(chalk.blue('测试命令风险分析功能'));
  console.log('');
  
  try {
    // 初始化LLM服务
    console.log(chalk.dim('初始化LLM服务...'));
    const initialized = await initLLMService();
    
    if (!initialized) {
      console.log(chalk.yellow('注意: LLM服务初始化失败，将使用本地规则进行分析'));
    } else {
      console.log(chalk.green('✓ LLM服务初始化成功'));
    }
    
    console.log('');
    
    // 测试每个命令
    for (const [index, command] of TEST_COMMANDS.entries()) {
      console.log(chalk.dim(`测试 ${index + 1}/${TEST_COMMANDS.length}: "${command}"`));
      
      try {
        console.time('执行时间');
        const result = await analyzeCommandRisk(command);
        console.timeEnd('执行时间');
        
        console.log(chalk.green('✓ 风险分析完成'));
        console.log('');
        
        // 根据风险级别设置颜色
        let riskColor;
        switch (result.riskLevel) {
          case 'high':
            riskColor = chalk.red;
            break;
          case 'medium':
            riskColor = chalk.yellow;
            break;
          case 'low':
            riskColor = chalk.green;
            break;
        }
        
        console.log(chalk.blue('风险级别:'), riskColor(result.riskLevel));
        console.log(chalk.blue('解释:'), result.explanation);
        
        console.log('\n' + '-'.repeat(50) + '\n');
      } catch (error) {
        console.error(chalk.red(`错误: 分析命令 "${command}" 失败`));
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