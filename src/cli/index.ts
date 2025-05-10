/**
 * CLI模块入口
 * 定义命令行接口和交互逻辑
 */

import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { processNaturalLanguage } from '../core/nlp/processor.ts';
import { executeGitCommand, validateGitCommand } from '../core/git/executor.ts';
import { analyzeCodes } from '../core/analysis/analyzer.ts';
import { setLLMConfig, setAPIKey, initLLMService } from '../core/nlp/llm-service.ts';
import { initWorkflowEngine } from '../core/workflow/index.ts';

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
    .option('-i, --interactive', '使用交互式工作流模式进行操作')
    .action(async (args: string[], options: { interactive?: boolean }) => {
      const command = args.join(' ');
      
      if (!command) {
        // 如果没有提供命令，显示帮助
        program.help();
        return;
      }
      
      try {
        // 如果指定了交互式模式，使用工作流引擎处理
        if (options.interactive) {
          console.log(chalk.blue('正在以交互式模式处理: ') + chalk.bold(`"${command}"`));
          
          // 检查LLM服务是否初始化
          const llmAvailable = await initLLMService();
          if (!llmAvailable) {
            console.log(chalk.yellow('警告: LLM服务未配置，将使用基础工作流。'));
            console.log(chalk.yellow('建议: 使用 "gt config -k YOUR_API_KEY" 命令配置API密钥以获得更智能的工作流生成。'));
          }
          
          // 初始化工作流引擎
          const workflowEngine = initWorkflowEngine();
          
          // 处理用户输入
          await workflowEngine.processInput(command);
          return;
        }
        
        // 否则使用传统方式处理自然语言命令
        console.log(chalk.dim(`正在处理: "${command}"`));
        const gitCommand = await processNaturalLanguage(command);
        
        // 检查命令风险
        const risk = await validateGitCommand(gitCommand);
        
        // 预览命令
        console.log('');
        console.log(chalk.blue('即将执行:'), chalk.bold(gitCommand));
        
        // 根据风险级别显示不同的提示
        if (risk.level === 'high') {
          console.log(chalk.red('⚠️ 高风险命令:'), risk.description);
          if (risk.mitigation) {
            console.log(chalk.yellow('建议:'), risk.mitigation);
          }
          
          // 生成随机验证码
          const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
          
          // 请求用户输入验证码确认
          const { userCode } = await inquirer.prompt([{
            type: 'input',
            name: 'userCode',
            message: `为确保安全，请输入验证码 ${verificationCode} 以继续执行:`,
            validate: (input: string) => input === verificationCode ? true : '验证码不正确，请重新输入'
          }]);
          
          console.log(chalk.green('验证通过，继续执行...'));
        } else if (risk.level === 'medium') {
          console.log(chalk.yellow('⚠️ 中等风险命令:'), risk.description);
          if (risk.mitigation) {
            console.log(chalk.dim('建议:'), risk.mitigation);
          }
        } else {
          console.log(chalk.green('✓ 低风险命令:'), risk.description);
        }
        
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
          
          if (result.success) {
            console.log(chalk.green('执行成功!'));
            if (result.output) {
              console.log(result.output);
            }
          } else {
            console.error(chalk.red('执行失败:'), result.error);
          }
        } else {
          console.log(chalk.yellow('已取消执行'));
        }
      } catch (error: any) {
        console.error(chalk.red('处理失败:'), error.message || String(error));
      }
    });

  // 交互式工作流命令
  program
    .command('interactive')
    .description('以交互式步骤流程处理Git操作')
    .argument('<text>', '描述您想要执行的Git操作')
    .action(async (text: string) => {
      try {
        console.log(chalk.blue('正在以交互式模式处理: ') + chalk.bold(`"${text}"`));
        
        // 检查LLM服务是否初始化
        const llmAvailable = await initLLMService();
        if (!llmAvailable) {
          console.log(chalk.yellow('警告: LLM服务未配置，将使用基础工作流。'));
          console.log(chalk.yellow('建议: 使用 "gt config -k YOUR_API_KEY" 命令配置API密钥以获得更智能的工作流生成。'));
        }
        
        // 初始化工作流引擎
        const workflowEngine = initWorkflowEngine();
        
        // 处理用户输入
        await workflowEngine.processInput(text);
      } catch (error: any) {
        console.error(chalk.red('处理失败:'), error.message || String(error));
      }
    });

  // 工作流帮助命令
  program
    .command('workflow-help')
    .alias('whelp')
    .description('显示工作流步骤和退出选项的详细说明')
    .action(async () => {
      try {
        // 初始化工作流引擎
        const workflowEngine = initWorkflowEngine();
        
        // 显示工作流帮助信息
        await workflowEngine.showHelp();
      } catch (error: any) {
        console.error(chalk.red('显示帮助信息失败:'), error.message || String(error));
      }
    });

  // 配置命令
  program
    .command('config')
    .description('配置LLM服务参数')
    .option('-k, --key <apiKey>', 'OpenAI API密钥')
    .option('-m, --model <model>', 'LLM模型名称，默认为gpt-3.5-turbo')
    .option('-u, --base-url <url>', 'API基础URL，用于自定义端点')
    .option('--show', '显示当前配置')
    .action(async (options: { key?: string, model?: string, baseUrl?: string, show?: boolean }) => {
      try {
        // 初始化LLM服务以加载当前配置
        await initLLMService();
        
        if (options.show) {
          // 读取并显示当前配置
          try {
            const configPath = `${process.env.HOME || process.env.USERPROFILE}/.gt-nl/config.json`;
            const configData = await import('fs/promises').then(fs => fs.readFile(configPath, 'utf-8'));
            const config = JSON.parse(configData);
            
            console.log(chalk.blue('当前配置:'));
            console.log(`API密钥: ${config.apiKey ? `${config.apiKey.substring(0, 4)}...${config.apiKey.substring(config.apiKey.length - 4)}` : '未设置'}`);
            console.log(`模型: ${config.model || 'gpt-3.5-turbo (默认)'}`);
            console.log(`基础URL: ${config.baseUrl || '默认OpenAI端点'}`);
          } catch (error) {
            console.log(chalk.yellow('未找到配置文件或文件无效'));
          }
          return;
        }
        
        if (options.key || options.model || options.baseUrl) {
          // 如果提供了参数，直接设置
          const config: any = {};
          
          if (options.key) config.apiKey = options.key;
          if (options.model) config.model = options.model;
          if (options.baseUrl) config.baseUrl = options.baseUrl;
          
          await setLLMConfig(config);
          console.log(chalk.green('配置已更新!'));
          
          // 显示已设置的内容
          if (options.key) console.log('API密钥已设置');
          if (options.model) console.log(`模型已设置为: ${options.model}`);
          if (options.baseUrl) console.log(`基础URL已设置为: ${options.baseUrl}`);
        } else {
          // 如果没有提供参数，使用交互式界面
          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'apiKey',
              message: 'OpenAI API密钥:',
              validate: (input: string) => input ? true : '请输入有效的API密钥'
            },
            {
              type: 'input',
              name: 'model',
              message: 'LLM模型名称 (默认: gpt-3.5-turbo):',
              default: 'gpt-3.5-turbo'
            },
            {
              type: 'input',
              name: 'baseUrl',
              message: 'API基础URL (可选):',
            }
          ]);
          
          const config: any = {
            apiKey: answers.apiKey
          };
          
          if (answers.model) config.model = answers.model;
          if (answers.baseUrl) config.baseUrl = answers.baseUrl;
          
          await setLLMConfig(config);
          console.log(chalk.green('配置已更新!'));
        }
      } catch (error: any) {
        console.error(chalk.red('配置更新失败:'), error.message || String(error));
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
      console.log('');
      console.log(chalk.blue('交互式工作流示例:'));
      console.log('');
      console.log('  $ gt -i 帮我提交代码和生成提交消息');
      console.log('  $ gt interactive "提交所有修改并推送到远程"');
      console.log('  $ gt -i 检查仓库状态并选择性提交部分文件');
      console.log('  $ gt workflow-help 显示工作流步骤和退出选项的详细帮助');
    });
} 