/**
 * 工作流模块入口
 * 初始化并配置工作流引擎
 */

import { WorkflowEngine } from './engine.ts';
import { 
  gitStatusStep, 
  gitDiffAnalysisStep, 
  gitAddStep, 
  gitCommitStep, 
  gitPushStep,
  gitCodeStatsStep
} from './steps/git-steps.ts';
import {
  gitListBranchesStep,
  gitSwitchBranchStep,
  gitMergePreviewStep,
  gitMergeExecuteStep,
  gitPushMergeStep
} from './steps/git-merge-steps.ts';

// 创建工作流引擎单例
const workflowEngine = new WorkflowEngine();

// 注册所有工作流步骤
function registerAllSteps() {
  // 注册Git相关步骤
  workflowEngine.registerStep(gitStatusStep);
  workflowEngine.registerStep(gitDiffAnalysisStep);
  workflowEngine.registerStep(gitAddStep);
  workflowEngine.registerStep(gitCommitStep);
  workflowEngine.registerStep(gitPushStep);
  workflowEngine.registerStep(gitCodeStatsStep);
  
  // 注册分支合并相关步骤
  workflowEngine.registerStep(gitListBranchesStep);
  workflowEngine.registerStep(gitSwitchBranchStep);
  workflowEngine.registerStep(gitMergePreviewStep);
  workflowEngine.registerStep(gitMergeExecuteStep);
  workflowEngine.registerStep(gitPushMergeStep);
  
  // 可以在此添加更多步骤...
}

// 初始化工作流引擎
export function initWorkflowEngine(): WorkflowEngine {
  registerAllSteps();
  return workflowEngine;
}

// 导出工作流引擎实例
export default workflowEngine; 