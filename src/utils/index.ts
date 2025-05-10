/**
 * 工具函数模块
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * 判断目录是否为Git仓库
 * @param directory 目录路径
 * @returns 是否为Git仓库
 */
export async function isGitRepository(directory: string): Promise<boolean> {
  try {
    const gitDir = path.join(directory, '.git');
    const stats = await fs.stat(gitDir);
    return stats.isDirectory();
  } catch (error) {
    return false;
  }
}

/**
 * 获取当前工作目录
 * @returns 当前工作目录路径
 */
export function getCurrentWorkingDirectory(): string {
  return process.cwd();
}

/**
 * 格式化耗时
 * @param milliseconds 毫秒数
 * @returns 格式化后的耗时字符串
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  } else if (milliseconds < 60000) {
    return `${(milliseconds / 1000).toFixed(2)}s`;
  } else {
    const minutes = Math.floor(milliseconds / 60000);
    const seconds = ((milliseconds % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * 截断过长字符串
 * @param str 需要截断的字符串
 * @param maxLength 最大长度
 * @returns 截断后的字符串
 */
export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - 3) + '...';
}

/**
 * 安全解析JSON
 * @param str JSON字符串
 * @param defaultValue 解析失败时的默认值
 * @returns 解析结果
 */
export function safeJsonParse<T>(str: string, defaultValue: T): T {
  try {
    return JSON.parse(str) as T;
  } catch (error) {
    return defaultValue;
  }
}

/**
 * 延迟执行
 * @param ms 延迟毫秒数
 * @returns Promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 检查命令是否可用
 * @param command 命令名
 * @returns 是否可用
 */
export async function isCommandAvailable(command: string): Promise<boolean> {
  try {
    // 命令检查方式根据平台不同而不同
    const cmd = process.platform === 'win32' 
      ? `where ${command}`
      : `which ${command}`;
    
    await execAsync(cmd);
    return true;
  } catch (error) {
    return false;
  }
} 