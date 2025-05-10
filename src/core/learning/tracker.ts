/**
 * 用户行为跟踪模块
 * 记录和分析用户操作
 */

import type { User, UserAction, UserBehaviorProfile } from '../../types/index.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// 存储路径配置
const STORAGE_DIR = path.join(os.homedir(), '.gt-nl');
const USER_ACTIONS_FILE = path.join(STORAGE_DIR, 'user-actions.json');

/**
 * 初始化存储目录
 */
async function initStorage(): Promise<void> {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  } catch (error) {
    console.error('初始化存储目录失败:', error);
  }
}

/**
 * 用户行为跟踪器
 */
export class BehaviorTracker {
  private actionHistory: UserAction[] = [];
  private initialized = false;
  
  /**
   * 初始化跟踪器
   */
  async init(): Promise<void> {
    if (this.initialized) return;
    
    await initStorage();
    await this.loadHistory();
    this.initialized = true;
  }
  
  /**
   * 记录用户操作
   * @param user 用户信息
   * @param action 操作信息
   */
  async recordAction(user: User, action: UserAction): Promise<void> {
    if (!this.initialized) await this.init();
    
    this.actionHistory.push(action);
    await this.saveHistory();
  }
  
  /**
   * 分析用户行为模式
   * @param user 用户信息
   * @returns 用户行为分析结果
   */
  analyzePatterns(user: User): UserBehaviorProfile {
    // 获取用户的操作历史
    const userActions = this.actionHistory.filter(action => action.userId === user.id);
    
    // 分析最常使用的命令
    const commandCounts = new Map<string, number>();
    for (const action of userActions) {
      const count = commandCounts.get(action.command) || 0;
      commandCounts.set(action.command, count + 1);
    }
    
    const frequentCommands = Array.from(commandCounts.entries())
      .map(([command, count]) => ({ command, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // 取前10个
    
    // 获取最后活动时间
    const lastAction = userActions.length > 0 
      ? userActions.reduce((latest, current) => 
          latest.timestamp > current.timestamp ? latest : current
        )
      : null;
    
    return {
      userId: user.id,
      frequentCommands,
      preferredFormats: {}, // 暂未实现格式偏好分析
      lastActive: lastAction ? lastAction.timestamp : new Date()
    };
  }
  
  /**
   * 获取使用建议
   * @param user 用户信息
   * @returns 个性化使用建议
   */
  getSuggestions(user: User): string[] {
    const profile = this.analyzePatterns(user);
    const suggestions: string[] = [];
    
    // 基于频繁使用的命令提供建议
    if (profile.frequentCommands.length > 0) {
      const mostUsed = profile.frequentCommands[0];
      if (mostUsed) {
        suggestions.push(`您最常使用"${mostUsed.command}"命令，可以通过快捷键设置简化操作。`);
      }
    }
    
    // 检查是否有使用高级功能
    const usesAdvancedFeatures = this.actionHistory.some(
      action => action.userId === user.id && action.command.includes('scan')
    );
    
    if (!usesAdvancedFeatures) {
      suggestions.push('尝试使用"scan"命令扫描代码库，发现潜在问题。');
    }
    
    return suggestions;
  }
  
  /**
   * 加载历史记录
   */
  private async loadHistory(): Promise<void> {
    try {
      const data = await fs.readFile(USER_ACTIONS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      
      // 转换日期字符串为Date对象
      this.actionHistory = parsed.map((action: any) => ({
        ...action,
        timestamp: new Date(action.timestamp)
      }));
    } catch (error) {
      // 文件可能不存在，使用空数组
      this.actionHistory = [];
    }
  }
  
  /**
   * 保存历史记录
   */
  private async saveHistory(): Promise<void> {
    try {
      await fs.writeFile(
        USER_ACTIONS_FILE,
        JSON.stringify(this.actionHistory, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('保存用户操作历史失败:', error);
    }
  }
} 