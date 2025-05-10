/**
 * 代码分析模块
 * 扫描代码库，分析安全风险和代码质量问题
 */

import fs from 'fs/promises';
import path from 'path';

export interface AnalysisOptions {
  security?: boolean;  // 是否进行安全分析
  quality?: boolean;   // 是否进行质量分析
  standard?: boolean;  // 是否进行规范检查
}

export interface CodeIssue {
  id: string;
  type: 'security' | 'quality' | 'standard';
  severity: 'high' | 'medium' | 'low' | 'info';
  description: string;
  file: string;
  line?: number;
  column?: number;
  solution?: string;
}

export interface AnalysisResult {
  issueCount: number;
  issues: CodeIssue[];
  scanTime: Date;
  summary: {
    securityIssues: number;
    qualityIssues: number;
    standardIssues: number;
  }
}

/**
 * 扫描代码库
 * @param targetPath 目标路径
 * @param options 分析选项
 * @returns 分析结果
 */
export async function analyzeCodes(
  targetPath: string, 
  options: AnalysisOptions = {}
): Promise<AnalysisResult> {
  // 设置默认选项
  const analysisOptions: AnalysisOptions = {
    security: options.security ?? true,
    quality: options.quality ?? true,
    standard: options.standard ?? true
  };

  console.log(`开始扫描路径: ${targetPath}`);
  console.log(`扫描选项: 安全=${analysisOptions.security}, 质量=${analysisOptions.quality}, 规范=${analysisOptions.standard}`);

  // 文件扫描
  const filePaths = await scanFiles(targetPath);
  console.log(`找到${filePaths.length}个文件进行分析`);

  // 模拟分析过程
  // 实际项目中会接入ESLint, SonarJS等工具进行真正的代码分析
  const issues: CodeIssue[] = await mockAnalysis(filePaths, analysisOptions);

  // 生成分析结果
  const result: AnalysisResult = {
    issueCount: issues.length,
    issues,
    scanTime: new Date(),
    summary: {
      securityIssues: issues.filter(issue => issue.type === 'security').length,
      qualityIssues: issues.filter(issue => issue.type === 'quality').length,
      standardIssues: issues.filter(issue => issue.type === 'standard').length
    }
  };

  return result;
}

/**
 * 扫描指定路径下的所有文件
 * @param targetPath 目标路径
 * @returns 文件路径列表
 */
async function scanFiles(targetPath: string): Promise<string[]> {
  const filePaths: string[] = [];
  const ignorePatterns = [
    'node_modules',
    '.git',
    'dist',
    'build'
  ];

  async function scan(dirPath: string) {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      // 跳过忽略的目录
      if (entry.isDirectory() && ignorePatterns.includes(entry.name)) {
        continue;
      }
      
      if (entry.isDirectory()) {
        await scan(fullPath);
      } else {
        // 只分析特定类型的文件
        if (fullPath.match(/\.(js|ts|jsx|tsx|vue|php|py|java|rb|go|c|cpp|cs)$/)) {
          filePaths.push(fullPath);
        }
      }
    }
  }

  await scan(targetPath);
  return filePaths;
}

/**
 * 模拟代码分析过程
 * @param filePaths 文件路径列表
 * @param options 分析选项
 * @returns 找到的问题列表
 */
async function mockAnalysis(
  filePaths: string[],
  options: AnalysisOptions
): Promise<CodeIssue[]> {
  // 在实际项目中，这里会调用真正的代码分析工具
  // 这里仅模拟返回结果用于演示
  
  const mockIssues: CodeIssue[] = [];
  const securityPatterns = [
    { pattern: /exec\s*\(/i, description: '潜在的命令注入风险' },
    { pattern: /eval\s*\(/i, description: '使用了不安全的eval()' },
    { pattern: /password.*=.*(['"]).*\1/i, description: '硬编码的密码' }
  ];
  
  const qualityPatterns = [
    { pattern: /function\s*\w+\s*\([^)]{100,}/i, description: '函数参数过多' },
    { pattern: /for\s*\([^)]+\)\s*\{\s*for\s*\(/i, description: '嵌套循环可能导致性能问题' },
    { pattern: /\/\/\s*TODO/i, description: '未完成的TODO任务' }
  ];
  
  for (const filePath of filePaths) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      
      // 安全检查
      if (options.security) {
        for (const pattern of securityPatterns) {
          for (let i = 0; i < lines.length; i++) {
            if (pattern.pattern.test(lines[i])) {
              mockIssues.push({
                id: `SEC${Math.floor(Math.random() * 1000)}`,
                type: 'security',
                severity: 'high',
                description: pattern.description,
                file: filePath,
                line: i + 1,
                solution: '考虑使用更安全的替代方案'
              });
            }
          }
        }
      }
      
      // 质量检查
      if (options.quality) {
        for (const pattern of qualityPatterns) {
          for (let i = 0; i < lines.length; i++) {
            if (pattern.pattern.test(lines[i])) {
              mockIssues.push({
                id: `QUAL${Math.floor(Math.random() * 1000)}`,
                type: 'quality',
                severity: 'medium',
                description: pattern.description,
                file: filePath,
                line: i + 1,
                solution: '考虑重构此代码段'
              });
            }
          }
        }
      }
      
      // 规范检查
      if (options.standard) {
        // 检查文件是否有正确的头部注释
        if (!content.startsWith('/**')) {
          mockIssues.push({
            id: `STD${Math.floor(Math.random() * 1000)}`,
            type: 'standard',
            severity: 'low',
            description: '文件缺少标准的头部注释',
            file: filePath,
            solution: '添加符合项目规范的文件头注释'
          });
        }
      }
    } catch (error) {
      console.error(`分析文件 ${filePath} 时出错:`, error);
    }
  }
  
  return mockIssues;
} 