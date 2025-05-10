/**
 * Git操作相关的工作流步骤
 */

import { WorkflowStep, WorkflowContext } from '../engine.ts';
import { executeGitCommand, getGitDiff } from '../../git/executor.ts';
import { generateCommitMessage } from '../../nlp/llm-service.ts';
import inquirer from 'inquirer';
import chalk from 'chalk';

/**
 * Git状态检查步骤
 * 检查当前仓库状态并显示更改文件
 */
export const gitStatusStep: WorkflowStep = {
  id: 'git-status',
  name: '检查Git状态',
  description: '检查当前仓库状态并显示更改文件',
  requiresUserInput: true,
  
  async execute(context: WorkflowContext): Promise<void> {
    // 执行git status命令
    const result = await executeGitCommand('git status');
    
    if (!result.success) {
      throw new Error(`无法获取仓库状态: ${result.error}`);
    }
    
    // 保存状态结果到上下文
    context.addToContext('statusOutput', result.output || '');
    
    // 格式化输出以便更好地展示
    console.log(chalk.dim('仓库状态:'));
    console.log(result.output || '');
    
    // 检查是否有文件变更
    if ((result.output || '').includes('nothing to commit') || 
        (result.output || '').includes('没有可提交的内容')) {
      console.log(chalk.yellow('没有文件变更需要提交'));
      context.addToContext('hasChanges', false);
    } else {
      // 提取更改的文件列表
      const changedFiles = extractChangedFiles(result.output || '');
      context.addToContext('changedFiles', changedFiles);
      context.addToContext('hasChanges', true);
      
      // 显示更改的文件列表
      if (changedFiles.length > 0) {
        console.log(chalk.blue('更改的文件:'));
        changedFiles.forEach(file => {
          console.log(`- ${file}`);
        });
      }
    }
  },
  
  // 可以根据上下文决定是否跳过此步骤
  async shouldSkip(context: WorkflowContext): Promise<boolean> {
    return false; // 通常不跳过状态检查
  }
};

/**
 * Git差异分析步骤
 * 分析文件差异并生成提交消息建议
 */
export const gitDiffAnalysisStep: WorkflowStep = {
  id: 'git-diff-analysis',
  name: '分析变更内容',
  description: '分析文件差异并生成提交消息建议',
  requiresUserInput: true,
  
  async execute(context: WorkflowContext): Promise<void> {
    // 检查是否有变更
    const hasChanges = context.getFromContext('hasChanges');
    if (!hasChanges) {
      console.log(chalk.yellow('没有变更需要分析'));
      return;
    }
    
    // 获取diff内容
    console.log(chalk.dim('获取变更内容...'));
    const diffContent = await getGitDiff();
    
    if (!diffContent) {
      console.log(chalk.yellow('没有找到变更内容'));
      return;
    }
    
    // 保存diff内容到上下文
    context.addToContext('diffContent', diffContent);
    
    // 显示简化的diff内容
    const diffPreview = diffContent.split('\n').slice(0, 10).join('\n');
    console.log(chalk.dim('变更预览:'));
    console.log(chalk.dim(diffPreview));
    if (diffContent.split('\n').length > 10) {
      console.log(chalk.dim('... (更多变更未显示)'));
    }
    
    // 生成提交消息建议
    console.log(chalk.dim('正在分析变更内容，生成提交消息建议...'));
    try {
      const suggestedMessage = await generateCommitMessage(diffContent);
      context.addToContext('suggestedCommitMessage', suggestedMessage);
      
      console.log(chalk.green('建议的提交消息:'));
      console.log(chalk.bold(`"${suggestedMessage}"`));
      
      // 询问用户是否接受此提交消息或自行编辑
      const { commitMessageAction } = await inquirer.prompt([{
        type: 'list',
        name: 'commitMessageAction',
        message: '您想如何处理提交消息?',
        choices: [
          { name: '使用建议的提交消息', value: 'use' },
          { name: '编辑提交消息', value: 'edit' },
          { name: '手动输入新提交消息', value: 'new' }
        ]
      }]);
      
      let finalCommitMessage = suggestedMessage;
      
      if (commitMessageAction === 'edit') {
        // 编辑建议的消息
        const { editedMessage } = await inquirer.prompt([{
          type: 'input',
          name: 'editedMessage',
          message: '编辑提交消息:',
          default: suggestedMessage
        }]);
        finalCommitMessage = editedMessage;
      } else if (commitMessageAction === 'new') {
        // 用户输入全新的消息
        const { newMessage } = await inquirer.prompt([{
          type: 'input',
          name: 'newMessage',
          message: '输入新的提交消息:',
          validate: (input: string) => input ? true : '提交消息不能为空'
        }]);
        finalCommitMessage = newMessage;
      }
      
      // 保存最终的提交消息到上下文
      context.addToContext('finalCommitMessage', finalCommitMessage);
      
    } catch (error) {
      console.warn(chalk.yellow('无法生成提交消息建议:'), error);
      
      // 如果自动生成失败，请用户手动输入
      const { manualMessage } = await inquirer.prompt([{
        type: 'input',
        name: 'manualMessage',
        message: '请输入提交消息:',
        validate: (input: string) => input ? true : '提交消息不能为空'
      }]);
      
      context.addToContext('finalCommitMessage', manualMessage);
    }
  },
  
  // 根据是否有变更决定是否跳过此步骤
  async shouldSkip(context: WorkflowContext): Promise<boolean> {
    const hasChanges = context.getFromContext('hasChanges');
    return !hasChanges;
  }
};

/**
 * Git添加文件步骤
 * 将文件添加到暂存区
 */
export const gitAddStep: WorkflowStep = {
  id: 'git-add',
  name: '添加变更文件',
  description: '将变更的文件添加到Git暂存区',
  requiresUserInput: true,
  
  async execute(context: WorkflowContext): Promise<void> {
    // 获取更改的文件列表
    const changedFiles = context.getFromContext('changedFiles') || [];
    
    if (changedFiles.length === 0) {
      console.log(chalk.yellow('没有文件需要添加'));
      return;
    }
    
    // 询问用户添加所有文件还是选择性添加
    const { addOption } = await inquirer.prompt([{
      type: 'list',
      name: 'addOption',
      message: '您想如何添加文件?',
      choices: [
        { name: '添加所有变更文件', value: 'all' },
        { name: '选择要添加的文件', value: 'select' }
      ]
    }]);
    
    if (addOption === 'all') {
      // 添加所有文件
      console.log(chalk.dim('添加所有变更文件...'));
      const result = await executeGitCommand('git add -A');
      
      if (!result.success) {
        throw new Error(`添加文件失败: ${result.error}`);
      }
      
      console.log(chalk.green('已添加所有变更文件到暂存区'));
      context.addToContext('filesAdded', true);
      
    } else {
      // 让用户选择要添加的文件
      const { selectedFiles } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'selectedFiles',
        message: '选择要添加的文件:',
        choices: changedFiles.map(file => ({
          name: file,
          checked: true
        }))
      }]);
      
      if (selectedFiles.length === 0) {
        console.log(chalk.yellow('未选择任何文件'));
        context.addToContext('filesAdded', false);
        return;
      }
      
      // 添加选中的文件
      for (const file of selectedFiles as string[]) {
        console.log(chalk.dim(`添加文件: ${file}`));
        const result = await executeGitCommand(`git add "${file}"`);
        
        if (!result.success) {
          console.warn(chalk.yellow(`添加文件 ${file} 失败: ${result.error}`));
        }
      }
      
      console.log(chalk.green(`已添加 ${selectedFiles.length} 个文件到暂存区`));
      context.addToContext('filesAdded', true);
    }
  },
  
  // 根据是否有变更决定是否跳过此步骤
  async shouldSkip(context: WorkflowContext): Promise<boolean> {
    const hasChanges = context.getFromContext('hasChanges');
    return !hasChanges;
  }
};

/**
 * Git提交步骤
 * 提交暂存区的更改
 */
export const gitCommitStep: WorkflowStep = {
  id: 'git-commit',
  name: '提交变更',
  description: '提交暂存区的变更',
  requiresUserInput: true,
  
  async execute(context: WorkflowContext): Promise<void> {
    // 检查是否有文件被添加到暂存区
    const filesAdded = context.getFromContext('filesAdded');
    if (!filesAdded) {
      console.log(chalk.yellow('没有文件被添加到暂存区，无法提交'));
      return;
    }
    
    // 获取最终的提交消息
    const commitMessage = context.getFromContext('finalCommitMessage');
    if (!commitMessage) {
      throw new Error('未找到提交消息');
    }
    
    // 执行提交命令
    console.log(chalk.dim(`正在提交变更: "${commitMessage}"...`));
    const result = await executeGitCommand(`git commit -m "${commitMessage}"`);
    
    if (!result.success) {
      throw new Error(`提交失败: ${result.error}`);
    }
    
    console.log(chalk.green('提交成功!'));
    console.log(result.output);
    
    // 询问是否要推送到远程仓库
    const { shouldPush } = await inquirer.prompt([{
      type: 'confirm',
      name: 'shouldPush',
      message: '是否要将变更推送到远程仓库?',
      default: false
    }]);
    
    context.addToContext('shouldPush', shouldPush);
  },
  
  // 根据是否有文件被添加决定是否跳过此步骤
  async shouldSkip(context: WorkflowContext): Promise<boolean> {
    const filesAdded = context.getFromContext('filesAdded');
    return !filesAdded;
  }
};

/**
 * Git推送步骤
 * 将提交推送到远程仓库
 */
export const gitPushStep: WorkflowStep = {
  id: 'git-push',
  name: '推送到远程',
  description: '将提交推送到远程仓库',
  requiresUserInput: true,
  
  async execute(context: WorkflowContext): Promise<void> {
    // 获取当前分支
    const branchResult = await executeGitCommand('git branch --show-current');
    if (!branchResult.success) {
      throw new Error(`无法获取当前分支: ${branchResult.error}`);
    }
    
    const currentBranch = (branchResult.output || '').trim();
    console.log(chalk.dim(`当前分支: ${currentBranch}`));
    
    // 询问推送到哪个远程仓库
    const remoteResult = await executeGitCommand('git remote');
    if (!remoteResult.success) {
      throw new Error(`无法获取远程仓库列表: ${remoteResult.error}`);
    }
    
    const remotes = (remoteResult.output || '').trim().split('\n').filter(r => r);
    
    if (remotes.length === 0) {
      console.log(chalk.yellow('没有配置远程仓库，无法推送'));
      return;
    }
    
    let selectedRemote = 'origin';
    if (remotes.length > 1) {
      // 让用户选择远程仓库
      const { remote } = await inquirer.prompt([{
        type: 'list',
        name: 'remote',
        message: '选择要推送到的远程仓库:',
        choices: remotes
      }]);
      selectedRemote = remote;
    }
    
    // 执行推送命令
    console.log(chalk.dim(`正在推送到 ${selectedRemote}/${currentBranch}...`));
    const pushResult = await executeGitCommand(`git push ${selectedRemote} ${currentBranch}`);
    
    if (!pushResult.success) {
      throw new Error(`推送失败: ${pushResult.error}`);
    }
    
    console.log(chalk.green('推送成功!'));
    if (pushResult.output) {
      console.log(pushResult.output);
    }
  },
  
  // 根据用户选择决定是否跳过此步骤
  async shouldSkip(context: WorkflowContext): Promise<boolean> {
    const shouldPush = context.getFromContext('shouldPush');
    return !shouldPush;
  }
};

/**
 * 从git status输出中提取更改的文件列表
 * @param statusOutput git status命令的输出
 * @returns 更改的文件列表
 */
function extractChangedFiles(statusOutput: string): string[] {
  const lines = statusOutput.split('\n');
  const changedFiles: string[] = [];
  
  // 解析git status输出中的文件路径
  // 这里的实现比较简单，实际应用中需要更复杂的解析
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // 匹配"modified:"、"new file:"等后面的文件路径
    if (trimmedLine.startsWith('modified:') || 
        trimmedLine.startsWith('new file:') || 
        trimmedLine.startsWith('deleted:') ||
        trimmedLine.startsWith('修改:') || 
        trimmedLine.startsWith('新文件:') || 
        trimmedLine.startsWith('删除:')) {
      
      const parts = trimmedLine.split(':');
      if (parts.length >= 2) {
        const filePath = parts.slice(1).join(':').trim();
        changedFiles.push(filePath);
      }
    }
  }
  
  return changedFiles;
} 