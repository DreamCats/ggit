/**
 * 工作流模块入口
 * 初始化并配置工作流引擎
 */

import { WorkflowEngine } from './engine.ts';
import { gitStatusStep, gitDiffAnalysisStep, gitAddStep, gitCommitStep, gitPushStep } from './steps/git-steps.ts';

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
  
  // 可以在此添加更多步骤...
}

// 初始化工作流引擎
export function initWorkflowEngine(): WorkflowEngine {
  registerAllSteps();
  return workflowEngine;
}

// 导出工作流引擎实例
export default workflowEngine; 