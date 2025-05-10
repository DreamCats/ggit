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
          { name: '手动输入新提交消息', value: 'new' },
          { name: '取消操作', value: 'cancel' }
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
      } else if (commitMessageAction === 'cancel') {
        console.log(chalk.yellow('已取消提交消息生成'));
        context.addToContext('cancelOperation', true);
        return;
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
        { name: '选择要添加的文件', value: 'select' },
        { name: '取消添加操作', value: 'cancel' }
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
      
    } else if (addOption === 'select') {
      // 让用户选择要添加的文件
      const { selectedFiles } = await inquirer.prompt([{
        type: 'checkbox',
        name: 'selectedFiles',
        message: '选择要添加的文件:',
        choices: changedFiles.map((file: string) => ({
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
    } else {
      // 用户取消添加
      console.log(chalk.yellow('已取消添加文件操作'));
      context.addToContext('filesAdded', false);
      context.addToContext('cancelOperation', true);
      return;
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
    const { pushAction } = await inquirer.prompt([{
      type: 'list',
      name: 'pushAction',
      message: '提交后的操作?',
      choices: [
        { name: '推送到远程仓库', value: 'push' },
        { name: '不推送，继续下一步操作', value: 'continue' },
        { name: '结束工作流', value: 'end' }
      ],
      default: 'continue'
    }]);
    
    if (pushAction === 'push') {
      context.addToContext('shouldPush', true);
    } else if (pushAction === 'end') {
      context.addToContext('shouldPush', false);
      context.addToContext('cancelOperation', true);
    } else {
      context.addToContext('shouldPush', false);
    }
  },
  
  // 根据是否有文件被添加决定是否跳过此步骤
  async shouldSkip(context: WorkflowContext): Promise<boolean> {
    const filesAdded = context.getFromContext('filesAdded');
    const cancelOperation = context.getFromContext('cancelOperation');
    return !filesAdded || cancelOperation === true;
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
    const cancelOperation = context.getFromContext('cancelOperation');
    return !shouldPush || cancelOperation === true;
  }
};

/**
 * Git代码统计步骤
 * 统计当前变更的代码行数
 */
export const gitCodeStatsStep: WorkflowStep = {
  id: 'git-code-stats',
  name: '统计代码变更',
  description: '分析并统计当前变更的代码行数',
  requiresUserInput: true,
  
  async execute(context: WorkflowContext): Promise<void> {
    // 检查是否有变更
    const hasChanges = context.getFromContext('hasChanges');
    if (!hasChanges) {
      console.log(chalk.yellow('没有变更需要统计'));
      return;
    }
    
    console.log(chalk.dim('正在统计代码变更情况...'));
    
    // 统计暂存区的变更
    const stagedStatsResult = await executeGitCommand('git diff --cached --numstat');
    
    // 统计未暂存的变更
    const unstagedStatsResult = await executeGitCommand('git diff --numstat');
    
    // 解析结果
    const stagedStats = stagedStatsResult.success ? parseNumStats(stagedStatsResult.output || '') : [];
    const unstagedStats = unstagedStatsResult.success ? parseNumStats(unstagedStatsResult.output || '') : [];
    
    // 合并统计数据
    const allStats = [...stagedStats, ...unstagedStats];
    
    // 计算总数
    const totals = allStats.reduce((acc, stat) => {
      acc.added += stat.added;
      acc.deleted += stat.deleted;
      return acc;
    }, { added: 0, deleted: 0 });
    
    // 分类统计
    const statsByExtension = allStats.reduce((acc: Record<string, {added: number, deleted: number}>, stat) => {
      const ext = getFileExtension(stat.file);
      if (!acc[ext]) {
        acc[ext] = { added: 0, deleted: 0 };
      }
      acc[ext].added += stat.added;
      acc[ext].deleted += stat.deleted;
      return acc;
    }, {});
    
    // 保存统计结果到上下文
    context.addToContext('codeStats', {
      totals,
      statsByExtension,
      stagedStats,
      unstagedStats,
      allStats
    });
    
    // 显示统计结果
    console.log('');
    console.log(chalk.blue.bold('代码变更统计:'));
    console.log('');
    
    // 显示总计
    console.log(chalk.blue('总计:'));
    console.log(`  ${chalk.green('+')} ${totals.added} 行添加`);
    console.log(`  ${chalk.red('-')} ${totals.deleted} 行删除`);
    console.log(`  ${chalk.yellow('=')} ${totals.added - totals.deleted} 行净增减`);
    console.log('');
    
    // 显示按文件类型分类的统计
    console.log(chalk.blue('按文件类型分类:'));
    Object.entries(statsByExtension)
      .sort((a, b) => (b[1].added + b[1].deleted) - (a[1].added + a[1].deleted))
      .forEach(([ext, stats]) => {
        console.log(`  ${chalk.yellow(ext || '无扩展名')}:`);
        console.log(`    ${chalk.green('+')} ${stats.added} 行添加, ${chalk.red('-')} ${stats.deleted} 行删除`);
      });
    console.log('');
    
    // 显示变更最多的文件
    console.log(chalk.blue('变更最多的文件 (前5个):'));
    allStats
      .sort((a, b) => (b.added + b.deleted) - (a.added + a.deleted))
      .slice(0, 5)
      .forEach(stat => {
        console.log(`  ${stat.file}:`);
        console.log(`    ${chalk.green('+')} ${stat.added} 行添加, ${chalk.red('-')} ${stat.deleted} 行删除`);
      });
    
    // 询问是否显示详细统计
    const { detailAction } = await inquirer.prompt([{
      type: 'list',
      name: 'detailAction',
      message: '是否需要更多详情?',
      choices: [
        { name: '显示所有文件的详细变更统计', value: 'show' },
        { name: '继续下一步', value: 'continue' },
        { name: '结束统计', value: 'end' }
      ],
      default: 'continue'
    }]);
    
    if (detailAction === 'show' && allStats.length > 0) {
      console.log('');
      console.log(chalk.blue('所有文件变更详情:'));
      
      allStats.forEach(stat => {
        console.log(`  ${stat.file}:`);
        console.log(`    ${chalk.green('+')} ${stat.added} 行添加, ${chalk.red('-')} ${stat.deleted} 行删除`);
      });
    } else if (detailAction === 'end') {
      console.log(chalk.yellow('已结束统计'));
    }
  },
  
  // 根据是否有变更决定是否跳过此步骤
  async shouldSkip(context: WorkflowContext): Promise<boolean> {
    const hasChanges = context.getFromContext('hasChanges');
    return !hasChanges;
  }
};

/**
 * 解析git diff --numstat的输出，提取添加、删除行数和文件名
 * @param output git diff --numstat的输出
 * @returns 解析后的统计数据
 */
function parseNumStats(output: string): Array<{added: number, deleted: number, file: string}> {
  const stats: Array<{added: number, deleted: number, file: string}> = [];
  
  if (!output) return stats;
  
  const lines = output.split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 3) {
      const added = parts[0] === '-' ? 0 : parseInt(parts[0], 10) || 0;
      const deleted = parts[1] === '-' ? 0 : parseInt(parts[1], 10) || 0;
      const file = parts.slice(2).join(' ');
      
      stats.push({ added, deleted, file });
    }
  }
  
  return stats;
}

/**
 * 从文件路径中提取文件扩展名
 * @param filePath 文件路径
 * @returns 文件扩展名 (不含点号，例如'js'、'ts'等)，无扩展名则返回空字符串
 */
function getFileExtension(filePath: string): string {
  const match = filePath.match(/\.([^./\\]+)$/);
  return match ? match[1].toLowerCase() : '';
}

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