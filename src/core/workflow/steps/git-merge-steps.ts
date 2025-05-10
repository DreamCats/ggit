/**
 * Git分支合并相关的工作流步骤
 */

import { WorkflowStep, WorkflowContext } from '../engine.ts';
import { executeGitCommand } from '../../git/executor.ts';
import inquirer from 'inquirer';
import chalk from 'chalk';

/**
 * 获取分支列表步骤
 * 获取所有本地分支并让用户选择要合并的分支和目标分支
 */
export const gitListBranchesStep: WorkflowStep = {
  id: 'git-list-branches',
  name: '获取分支列表',
  description: '获取所有本地分支并选择要合并的分支和目标分支',
  requiresUserInput: true,
  
  async execute(context: WorkflowContext): Promise<void> {
    // 获取当前分支
    const currentBranchResult = await executeGitCommand('git branch --show-current');
    if (!currentBranchResult.success) {
      throw new Error(`无法获取当前分支: ${currentBranchResult.error}`);
    }
    
    const currentBranch = currentBranchResult.output?.trim() || '';
    context.addToContext('currentBranch', currentBranch);
    console.log(chalk.dim(`当前分支: ${currentBranch}`));
    
    // 获取所有本地分支
    const branchesResult = await executeGitCommand('git branch');
    if (!branchesResult.success) {
      throw new Error(`无法获取分支列表: ${branchesResult.error}`);
    }
    
    // 解析分支列表
    const branches = branchesResult.output?.split('\n')
      .map(branch => branch.trim().replace(/^\*\s*/, ''))
      .filter(branch => branch)
      .filter(branch => branch !== currentBranch) || [];
    
    if (branches.length === 0) {
      console.log(chalk.yellow('没有其他分支可供合并'));
      context.addToContext('hasBranches', false);
      return;
    }
    
    context.addToContext('branches', branches);
    console.log(chalk.blue('可用分支:'));
    branches.forEach(branch => {
      console.log(`- ${branch}`);
    });
    
    // 询问用户选择要合并的源分支
    const { sourceBranch } = await inquirer.prompt([{
      type: 'list',
      name: 'sourceBranch',
      message: '请选择要合并的源分支:',
      choices: branches
    }]);
    
    context.addToContext('sourceBranch', sourceBranch);
    console.log(chalk.green(`已选择源分支: ${sourceBranch}`));
    
    // 询问用户选择合并的目标分支
    const allBranches = [...branches, currentBranch].filter(branch => branch !== sourceBranch);
    
    const { targetBranch } = await inquirer.prompt([{
      type: 'list',
      name: 'targetBranch',
      message: '请选择合并的目标分支:',
      choices: allBranches,
      default: currentBranch
    }]);
    
    context.addToContext('targetBranch', targetBranch);
    console.log(chalk.green(`已选择目标分支: ${targetBranch}`));
    
    // 如果目标分支不是当前分支，需要切换
    context.addToContext('needBranchSwitch', targetBranch !== currentBranch);
  },
  
  async shouldSkip(context: WorkflowContext): Promise<boolean> {
    return false; // 通常不跳过分支选择
  }
};

/**
 * 切换分支步骤
 * 如果需要切换到目标分支
 */
export const gitSwitchBranchStep: WorkflowStep = {
  id: 'git-switch-branch',
  name: '切换分支',
  description: '切换到目标分支',
  requiresUserInput: true,
  
  async execute(context: WorkflowContext): Promise<void> {
    const targetBranch = context.getFromContext('targetBranch');
    console.log(chalk.dim(`正在切换到分支: ${targetBranch}...`));
    
    // 检查是否有未提交的更改
    const statusResult = await executeGitCommand('git status --porcelain');
    
    if (statusResult.output && statusResult.output.trim()) {
      console.log(chalk.yellow('警告: 当前分支有未提交的更改'));
      
      const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: '如何处理未提交的更改?',
        choices: [
          { name: '暂存并提交更改', value: 'commit' },
          { name: '将更改暂存 (stash)', value: 'stash' },
          { name: '放弃更改 (慎重选择!)', value: 'discard' },
          { name: '取消分支切换', value: 'cancel' }
        ]
      }]);
      
      if (action === 'commit') {
        // 提交更改
        const { commitMessage } = await inquirer.prompt([{
          type: 'input',
          name: 'commitMessage',
          message: '请输入提交消息:',
          validate: (input: string) => input ? true : '提交消息不能为空'
        }]);
        
        const addResult = await executeGitCommand('git add -A');
        if (!addResult.success) {
          throw new Error(`添加文件失败: ${addResult.error}`);
        }
        
        try {
          const simpleGit = (await import('simple-git')).default();
          await simpleGit.commit(commitMessage);
          console.log(chalk.green('已提交所有更改'));
        } catch (error: any) {
          throw new Error(`提交失败: ${error.message}`);
        }
      } else if (action === 'stash') {
        // 使用stash保存更改
        const stashResult = await executeGitCommand('git stash save "自动保存的更改，准备合并分支"');
        if (!stashResult.success) {
          throw new Error(`无法暂存更改: ${stashResult.error}`);
        }
        console.log(chalk.green('已将更改保存到stash'));
        context.addToContext('hasStash', true);
      } else if (action === 'discard') {
        // 二次确认
        const { confirmDiscard } = await inquirer.prompt([{
          type: 'confirm',
          name: 'confirmDiscard',
          message: '确定要放弃所有未提交的更改? 此操作不可撤销!',
          default: false
        }]);
        
        if (!confirmDiscard) {
          console.log(chalk.yellow('已取消放弃更改操作'));
          context.addToContext('cancelBranchSwitch', true);
          return;
        }
        
        const resetResult = await executeGitCommand('git reset --hard HEAD');
        if (!resetResult.success) {
          throw new Error(`无法放弃更改: ${resetResult.error}`);
        }
        console.log(chalk.yellow('已放弃所有未提交的更改'));
      } else {
        // 取消切换
        console.log(chalk.yellow('已取消分支切换'));
        context.addToContext('cancelBranchSwitch', true);
        return;
      }
    }
    
    // 如果没有取消，执行切换
    if (!context.getFromContext('cancelBranchSwitch')) {
      const checkoutResult = await executeGitCommand(`git checkout ${targetBranch}`);
      if (!checkoutResult.success) {
        throw new Error(`切换分支失败: ${checkoutResult.error}`);
      }
      console.log(chalk.green(`已切换到分支: ${targetBranch}`));
    }
  },
  
  async shouldSkip(context: WorkflowContext): Promise<boolean> {
    const needBranchSwitch = context.getFromContext('needBranchSwitch');
    return !needBranchSwitch;
  }
};

/**
 * 预览合并更改步骤
 * 显示将要合并的变更内容
 */
export const gitMergePreviewStep: WorkflowStep = {
  id: 'git-merge-preview',
  name: '预览合并更改',
  description: '预览将要合并的变更内容',
  requiresUserInput: true,
  
  async execute(context: WorkflowContext): Promise<void> {
    const sourceBranch = context.getFromContext('sourceBranch');
    const targetBranch = context.getFromContext('targetBranch');
    
    console.log(chalk.dim(`正在获取 ${sourceBranch} 分支中的变更...`));
    
    // 计算两个分支之间的差异
    const diffCommand = `git log --oneline --graph --decorate --color=always ${targetBranch}..${sourceBranch}`;
    const diffResult = await executeGitCommand(diffCommand);
    
    if (!diffResult.success) {
      throw new Error(`无法获取分支差异: ${diffResult.error}`);
    }
    
    if (!diffResult.output || diffResult.output.trim() === '') {
      console.log(chalk.yellow(`分支 ${sourceBranch} 没有新的提交需要合并到 ${targetBranch}`));
      context.addToContext('hasChangesToMerge', false);
      return;
    }
    
    console.log(chalk.blue(`${sourceBranch} 中的新提交:`));
    console.log(diffResult.output);
    
    // 获取变更的文件列表
    const filesCommand = `git diff --name-status ${targetBranch}..${sourceBranch}`;
    const filesResult = await executeGitCommand(filesCommand);
    
    if (filesResult.success && filesResult.output) {
      console.log(chalk.blue('变更的文件:'));
      
      const fileChanges = filesResult.output.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const [status, ...path] = line.split(/\s+/);
          const filePath = path.join(' ');
          let statusText = '修改';
          
          if (status === 'A') statusText = '新增';
          else if (status === 'D') statusText = '删除';
          else if (status === 'M') statusText = '修改';
          else if (status === 'R') statusText = '重命名';
          
          return `  ${statusText}: ${filePath}`;
        });
      
      console.log(fileChanges.join('\n'));
    }
    
    context.addToContext('hasChangesToMerge', true);
  },
  
  async shouldSkip(context: WorkflowContext): Promise<boolean> {
    const cancelBranchSwitch = context.getFromContext('cancelBranchSwitch');
    return cancelBranchSwitch === true;
  }
};

/**
 * 执行合并步骤
 * 执行实际的合并操作
 */
export const gitMergeExecuteStep: WorkflowStep = {
  id: 'git-merge-execute',
  name: '执行合并',
  description: '将源分支合并到目标分支',
  requiresUserInput: true,
  
  async execute(context: WorkflowContext): Promise<void> {
    const sourceBranch = context.getFromContext('sourceBranch');
    const hasChangesToMerge = context.getFromContext('hasChangesToMerge');
    
    if (!hasChangesToMerge) {
      console.log(chalk.yellow('没有变更需要合并，跳过合并操作'));
      return;
    }
    
    // 询问合并选项
    const { mergeOption } = await inquirer.prompt([{
      type: 'list',
      name: 'mergeOption',
      message: '请选择合并方式:',
      choices: [
        { name: '创建合并提交 (--no-ff)', value: 'no-ff' },
        { name: '尝试快进合并 (--ff)', value: 'ff' },
        { name: '压缩所有提交为一个 (--squash)', value: 'squash' },
        { name: '取消合并', value: 'cancel' }
      ]
    }]);
    
    if (mergeOption === 'cancel') {
      console.log(chalk.yellow('已取消合并操作'));
      context.addToContext('cancelMerge', true);
      return;
    }
    
    let mergeCommand = `git merge ${sourceBranch}`;
    
    if (mergeOption === 'no-ff') {
      mergeCommand += ' --no-ff';
      
      // 询问提交消息
      const { commitMessage } = await inquirer.prompt([{
        type: 'input',
        name: 'commitMessage',
        message: '请输入合并提交消息:',
        default: `Merge branch '${sourceBranch}'`
      }]);
      
      if (commitMessage) {
        mergeCommand += ` -m '${commitMessage.replace(/'/g, "'\\''")}'`;
      }
    } else if (mergeOption === 'squash') {
      mergeCommand += ' --squash';
    }
    
    console.log(chalk.dim(`正在执行合并...`));
    const mergeResult = await executeGitCommand(mergeCommand);
    
    if (!mergeResult.success) {
      // 检查是否有冲突
      if (mergeResult.error && (
          mergeResult.error.includes('CONFLICT') || 
          mergeResult.error.includes('冲突') ||
          mergeResult.error.includes('Automatic merge failed'))
      ) {
        console.log(chalk.red('合并冲突!'));
        console.log(mergeResult.error);
        
        // 询问如何处理冲突
        const { conflictAction } = await inquirer.prompt([{
          type: 'list',
          name: 'conflictAction',
          message: '如何处理合并冲突?',
          choices: [
            { name: '手动解决冲突 (退出工作流)', value: 'manual' },
            { name: '放弃合并', value: 'abort' }
          ]
        }]);
        
        if (conflictAction === 'abort') {
          const abortResult = await executeGitCommand('git merge --abort');
          if (!abortResult.success) {
            throw new Error(`无法放弃合并: ${abortResult.error}`);
          }
          console.log(chalk.yellow('已放弃合并操作'));
        } else {
          console.log(chalk.blue('冲突的文件:'));
          const conflictFiles = await executeGitCommand('git diff --name-only --diff-filter=U');
          if (conflictFiles.success && conflictFiles.output) {
            console.log(conflictFiles.output);
          }
          
          console.log(chalk.yellow('请手动解决冲突，然后使用 git add 添加解决后的文件，最后执行 git commit 完成合并'));
          console.log(chalk.yellow('工作流将退出，以便您手动解决冲突'));
          context.addToContext('manualConflictResolution', true);
        }
        
        return;
      }
      
      throw new Error(`合并失败: ${mergeResult.error}`);
    }
    
    // 对于squash模式，需要额外的提交步骤
    if (mergeOption === 'squash') {
      console.log(chalk.blue('已将更改合并到工作区，需要额外提交以完成合并'));
      
      // 询问提交消息
      const { commitMessage } = await inquirer.prompt([{
        type: 'input',
        name: 'commitMessage',
        message: '请输入压缩合并的提交消息:',
        default: `Squashed commit of branch '${sourceBranch}'`
      }]);
      
      const addResult = await executeGitCommand('git add -A');
      if (!addResult.success) {
        throw new Error(`添加文件失败: ${addResult.error}`);
      }
      
      try {
        const simpleGit = (await import('simple-git')).default();
        await simpleGit.commit(commitMessage);
        console.log(chalk.green('已完成压缩合并并提交'));
      } catch (error: any) {
        throw new Error(`提交失败: ${error.message}`);
      }
    } else {
      console.log(chalk.green('合并成功!'));
      if (mergeResult.output) {
        console.log(mergeResult.output);
      }
    }
    
    // 检查是否需要恢复stash
    const hasStash = context.getFromContext('hasStash');
    if (hasStash) {
      const { restoreStash } = await inquirer.prompt([{
        type: 'confirm',
        name: 'restoreStash',
        message: '是否要恢复之前暂存的更改?',
        default: true
      }]);
      
      if (restoreStash) {
        const popResult = await executeGitCommand('git stash pop');
        if (popResult.success) {
          console.log(chalk.green('已恢复暂存的更改'));
        } else {
          console.log(chalk.yellow(`恢复暂存的更改时出现问题: ${popResult.error}`));
          console.log(chalk.yellow('您可以稍后使用 git stash pop 手动恢复'));
        }
      }
    }
  },
  
  async shouldSkip(context: WorkflowContext): Promise<boolean> {
    const cancelBranchSwitch = context.getFromContext('cancelBranchSwitch');
    const hasChangesToMerge = context.getFromContext('hasChangesToMerge');
    return cancelBranchSwitch === true || hasChangesToMerge === false;
  }
};

/**
 * 推送合并结果步骤
 * 询问是否要推送合并结果到远程仓库
 */
export const gitPushMergeStep: WorkflowStep = {
  id: 'git-push-merge',
  name: '推送合并结果',
  description: '将合并结果推送到远程仓库',
  requiresUserInput: true,
  
  async execute(context: WorkflowContext): Promise<void> {
    const targetBranch = context.getFromContext('targetBranch');
    const cancelMerge = context.getFromContext('cancelMerge');
    const manualConflictResolution = context.getFromContext('manualConflictResolution');
    
    if (cancelMerge || manualConflictResolution) {
      console.log(chalk.yellow('合并未完成，跳过推送操作'));
      return;
    }
    
    // 询问是否推送
    const { shouldPush } = await inquirer.prompt([{
      type: 'confirm',
      name: 'shouldPush',
      message: `是否将合并结果推送到远程的 ${targetBranch} 分支?`,
      default: false
    }]);
    
    if (!shouldPush) {
      console.log(chalk.dim('已跳过推送操作'));
      return;
    }
    
    // 获取远程仓库列表
    const remotesResult = await executeGitCommand('git remote');
    if (!remotesResult.success) {
      throw new Error(`无法获取远程仓库列表: ${remotesResult.error}`);
    }
    
    const remotes = remotesResult.output?.split('\n').filter(r => r.trim()) || [];
    
    if (remotes.length === 0) {
      console.log(chalk.yellow('没有配置远程仓库，无法推送'));
      return;
    }
    
    // 选择远程仓库
    let remoteName = 'origin';
    if (remotes.length > 1) {
      const { selectedRemote } = await inquirer.prompt([{
        type: 'list',
        name: 'selectedRemote',
        message: '请选择要推送到的远程仓库:',
        choices: remotes,
        default: 'origin'
      }]);
      
      remoteName = selectedRemote;
    }
    
    console.log(chalk.dim(`正在推送到 ${remoteName}/${targetBranch}...`));
    const pushResult = await executeGitCommand(`git push ${remoteName} ${targetBranch}`);
    
    if (!pushResult.success) {
      throw new Error(`推送失败: ${pushResult.error}`);
    }
    
    console.log(chalk.green('推送成功!'));
    if (pushResult.output) {
      console.log(pushResult.output);
    }
  },
  
  async shouldSkip(context: WorkflowContext): Promise<boolean> {
    const cancelBranchSwitch = context.getFromContext('cancelBranchSwitch');
    const cancelMerge = context.getFromContext('cancelMerge');
    const manualConflictResolution = context.getFromContext('manualConflictResolution');
    return cancelBranchSwitch === true || cancelMerge === true || manualConflictResolution === true;
  }
}; 