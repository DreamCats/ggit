/**
 * 工作流引擎模块
 * 负责处理多步骤交互式命令执行
 */

import inquirer from 'inquirer';
import chalk from 'chalk';
import { generateWorkflowPlan } from '../nlp/llm-service.ts';

// 工作流步骤接口
export interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  execute: (context: WorkflowContext) => Promise<void>;
  shouldSkip?: (context: WorkflowContext) => Promise<boolean>;
  requiresUserInput?: boolean;
}

// 工作流上下文，用于在步骤之间传递数据
export interface WorkflowContext {
  originalInput: string;
  steps: WorkflowStep[];
  currentStepIndex: number;
  data: Record<string, any>;
  addToContext: (key: string, value: any) => void;
  getFromContext: (key: string) => any;
}

// 工作流计划接口
export interface WorkflowPlan {
  steps: WorkflowStep[];
  summary: string;
}

/**
 * 工作流引擎类
 * 负责解析用户输入、生成执行计划、按步骤执行操作
 */
export class WorkflowEngine {
  private registeredSteps: Map<string, WorkflowStep> = new Map();
  
  /**
   * 注册工作流步骤
   * @param step 工作流步骤
   */
  registerStep(step: WorkflowStep): void {
    this.registeredSteps.set(step.id, step);
  }
  
  /**
   * 根据ID获取步骤
   * @param id 步骤ID
   * @returns 工作流步骤
   */
  getStepById(id: string): WorkflowStep | undefined {
    return this.registeredSteps.get(id);
  }
  
  /**
   * 处理用户输入并执行相应的工作流
   * @param input 用户输入
   */
  async processInput(input: string): Promise<void> {
    try {
      console.log(chalk.dim('正在分析您的请求...'));
      
      // 生成工作流计划
      const plan = await this.generatePlan(input);
      
      if (!plan || plan.steps.length === 0) {
        console.log(chalk.yellow('无法理解您的请求，请尝试更明确的表达'));
        return;
      }
      
      // 显示计划摘要
      console.log(chalk.blue('我将帮您完成以下步骤:'));
      console.log(chalk.dim(plan.summary));
      console.log('');
      
      // 创建工作流上下文
      const context: WorkflowContext = {
        originalInput: input,
        steps: plan.steps,
        currentStepIndex: 0,
        data: {},
        addToContext: (key: string, value: any) => {
          context.data[key] = value;
        },
        getFromContext: (key: string) => context.data[key]
      };
      
      // 执行工作流
      await this.executeWorkflow(context);
      
    } catch (error: any) {
      console.error(chalk.red('执行工作流时发生错误:'), error.message || String(error));
    }
  }
  
  /**
   * 生成工作流计划
   * @param input 用户输入
   * @returns 工作流计划
   */
  private async generatePlan(input: string): Promise<WorkflowPlan> {
    // 使用LLM生成工作流计划
    const planResult = await generateWorkflowPlan(input);
    
    // 将步骤ID转换为实际步骤
    const steps = planResult.steps
      .map((stepId: string) => this.getStepById(stepId))
      .filter((step): step is WorkflowStep => !!step);
    
    return {
      steps,
      summary: planResult.summary
    };
  }
  
  /**
   * 执行工作流
   * @param context 工作流上下文
   */
  private async executeWorkflow(context: WorkflowContext): Promise<void> {
    // 按顺序执行每个步骤
    for (let i = 0; i < context.steps.length; i++) {
      context.currentStepIndex = i;
      const step = context.steps[i];
      
      // 检查是否应该跳过此步骤
      if (step.shouldSkip && await step.shouldSkip(context)) {
        console.log(chalk.dim(`跳过步骤: ${step.name}`));
        continue;
      }
      
      // 显示当前步骤信息
      console.log(chalk.blue(`\n【${i + 1}/${context.steps.length}】${step.name}`));
      console.log(chalk.dim(step.description));
      
      // 如果步骤需要用户确认，询问用户
      if (step.requiresUserInput) {
        const { action } = await inquirer.prompt([{
          type: 'list',
          name: 'action',
          message: '如何处理此步骤?',
          choices: [
            { name: '继续执行此步骤', value: 'continue' },
            { name: '跳过此步骤', value: 'skip' },
            { name: '退出工作流', value: 'exit' }
          ]
        }]);
        
        if (action === 'skip') {
          console.log(chalk.yellow('已跳过此步骤'));
          continue;
        } else if (action === 'exit') {
          console.log(chalk.yellow('已退出工作流'));
          return;
        }
      }
      
      // 执行步骤
      try {
        await step.execute(context);
        console.log(chalk.green(`✓ ${step.name} 完成`));
      } catch (error: any) {
        console.error(chalk.red(`执行步骤 "${step.name}" 时发生错误:`), error.message || String(error));
        
        // 询问用户是否继续
        const { errorAction } = await inquirer.prompt([{
          type: 'list',
          name: 'errorAction',
          message: '遇到错误，如何继续?',
          choices: [
            { name: '继续执行后续步骤', value: 'continue' },
            { name: '退出工作流', value: 'exit' }
          ],
          default: 'exit'
        }]);
        
        if (errorAction === 'exit') {
          console.log(chalk.yellow('已取消执行'));
          break;
        }
      }
    }
    
    console.log(chalk.green('\n✓ 所有步骤已完成!'));
  }
  
  /**
   * 显示工作流帮助信息
   * 列出所有注册的工作流步骤及退出选项
   */
  async showHelp(): Promise<void> {
    console.log(chalk.blue.bold('工作流帮助信息'));
    console.log(chalk.dim('GT-NL 提供了一系列交互式工作流步骤，可以帮助您更好地理解和控制Git操作。'));
    console.log('');
    
    // 显示所有注册的工作流步骤
    console.log(chalk.blue('可用工作流步骤:'));
    
    if (this.registeredSteps.size === 0) {
      console.log(chalk.yellow('  未注册任何工作流步骤'));
    } else {
      // 对步骤进行分类整理
      const gitSteps: WorkflowStep[] = [];
      const otherSteps: WorkflowStep[] = [];
      
      this.registeredSteps.forEach(step => {
        if (step.id.startsWith('git-')) {
          gitSteps.push(step);
        } else {
          otherSteps.push(step);
        }
      });
      
      // 显示Git相关步骤
      if (gitSteps.length > 0) {
        console.log(chalk.blue('Git操作步骤:'));
        gitSteps.forEach(step => {
          console.log(`  ${chalk.green(step.id)} - ${step.name}`);
          console.log(`    ${chalk.dim(step.description)}`);
        });
        console.log('');
      }
      
      // 显示其他步骤
      if (otherSteps.length > 0) {
        console.log(chalk.blue('其他工作流步骤:'));
        otherSteps.forEach(step => {
          console.log(`  ${chalk.green(step.id)} - ${step.name}`);
          console.log(`    ${chalk.dim(step.description)}`);
        });
        console.log('');
      }
    }
    
    // 显示交互式选项说明
    console.log(chalk.blue('交互式选项:'));
    console.log(`  ${chalk.green('继续执行此步骤')} - 执行当前步骤`);
    console.log(`  ${chalk.green('跳过此步骤')} - 跳过当前步骤并继续下一步`);
    console.log(`  ${chalk.green('退出工作流')} - 立即结束整个工作流`);
    console.log('');
    
    // 显示错误处理选项
    console.log(chalk.blue('错误处理选项:'));
    console.log(`  ${chalk.green('继续执行后续步骤')} - 忽略当前错误并继续执行后续步骤`);
    console.log(`  ${chalk.green('退出工作流')} - 终止工作流执行`);
    console.log('');
    
    // 显示使用示例
    console.log(chalk.blue('使用示例:'));
    console.log(`  ${chalk.green('gt -i "提交当前代码"')} - 交互式提交代码`);
    console.log(`  ${chalk.green('gt interactive "统计代码变更并提交"')} - 分析代码统计并交互式提交`);
    console.log(`  ${chalk.green('gt -i "检查仓库状态"')} - 交互式检查Git状态`);
  }
} 