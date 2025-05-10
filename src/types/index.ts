/**
 * 全局类型定义
 */

// 系统用户类型
export interface User {
  id: string;
  name: string;
  preferences: Record<string, any>;
}

// 用户操作记录
export interface UserAction {
  userId: string;
  command: string;
  timestamp: Date;
  result: 'success' | 'failure';
  context?: Record<string, any>;
}

// 用户行为分析结果
export interface UserBehaviorProfile {
  userId: string;
  frequentCommands: Array<{command: string, count: number}>;
  preferredFormats: Record<string, string>;
  lastActive: Date;
}

// 代码仓库相关类型
export interface Repository {
  path: string;
  gitConfig?: Record<string, string>;
}

// 团队约定类型
export interface ProjectConventions {
  branchNaming?: {
    pattern: string;
    examples: string[];
  };
  commitMessage?: {
    pattern: string;
    examples: string[];
  };
  codeStyle?: Record<string, any>;
} 