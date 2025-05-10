/**
 * 自然语言处理模块
 * 将用户自然语言指令转换为Git命令
 */

import { generateGitCommand, initLLMService } from './llm-service.ts';

interface NLPResult {
  command: string;
  confidence: number;
  alternativeCommands?: string[];
}

interface IntentMatch {
  intent: string;
  confidence: number;
  parameters: Record<string, string>;
}

interface CommandTemplate {
  template: string;
  requiresParams: string[];
  description: string;
  examples: string[];
  paramExtractors?: Record<string, (input: string) => string | null>;
  customHandler?: (params: Record<string, string>, input: string) => string;
}

/**
 * 处理自然语言指令
 * @param input 用户输入的自然语言指令
 * @returns 转换后的Git命令
 */
export async function processNaturalLanguage(input: string): Promise<string> {
  try {
    // 检查LLM服务是否可用
    const llmAvailable = await initLLMService();
    
    // 如果LLM服务可用，优先使用LLM生成Git命令
    if (llmAvailable) {
      try {
        const result = await generateGitCommand(input);
        
        // 如果置信度高于0.7，直接使用LLM生成的命令
        if (result.confidence > 0.7) {
          return result.command;
        }
        
        // 置信度不高时，尝试使用规则匹配并比较结果
        const ruleBasedCommand = await processNaturalLanguageWithRules(input);
        
        // 如果规则匹配的命令和LLM生成的命令相同或者置信度大于0.5，使用LLM生成的命令
        if (ruleBasedCommand === result.command || result.confidence > 0.5) {
          return result.command;
        }
        
        // 否则使用规则匹配的命令
        return ruleBasedCommand;
      } catch (error) {
        // LLM生成失败，回退到规则匹配
        console.warn('LLM生成命令失败，回退到规则匹配:', error);
        return processNaturalLanguageWithRules(input);
      }
    } else {
      // LLM服务不可用，使用规则匹配
      return processNaturalLanguageWithRules(input);
    }
  } catch (error) {
    // 错误处理
    throw new Error(`处理自然语言指令失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 使用规则匹配处理自然语言指令
 * @param input 用户输入的自然语言指令
 * @returns 转换后的Git命令
 */
async function processNaturalLanguageWithRules(input: string): Promise<string> {
  // 标准化输入文本
  const normalizedInput = normalizeInput(input);
  
  // 解析意图和参数
  const intentMatch = extractIntent(normalizedInput);
  
  if (!intentMatch) {
    throw new Error('无法理解您的指令，请尝试更明确的表达或查看帮助示例');
  }
  
  // 根据意图生成命令
  const gitCommand = generateCommand(intentMatch, normalizedInput);
  
  return gitCommand;
}

/**
 * 标准化输入文本
 * @param input 原始输入
 * @returns 标准化后的文本
 */
function normalizeInput(input: string): string {
  return input
    .toLowerCase()
    .replace(/，/g, ',')
    .replace(/：/g, ':')
    .replace(/。/g, '.')
    .trim();
}

/**
 * 提取意图和参数
 * @param input 标准化后的输入
 * @returns 意图匹配结果
 */
function extractIntent(input: string): IntentMatch | null {
  // 意图匹配模式
  const intentPatterns: Record<string, RegExp[]> = {
    'commit': [
      /提交.*(?:修改|变更|代码|文件)/,
      /保存.*(?:修改|变更|工作)/,
      /提交代码/,
      /commit/
    ],
    'push': [
      /推送.*(?:到|至|远程|仓库|分支)/,
      /上传.*(?:代码|修改|分支)/,
      /push/
    ],
    'pull': [
      /拉取.*(?:代码|更新|远程|分支)/,
      /获取.*(?:最新|代码|更新)/,
      /同步.*(?:远程|代码)/,
      /pull/
    ],
    'branch-create': [
      /创建.*(?:新)?.*(?:分支)/,
      /新建.*(?:分支)/,
      /建立.*(?:分支)/
    ],
    'branch-switch': [
      /切换.*(?:到|至).*(?:分支)/,
      /(?:去|到).*(?:分支)/,
      /checkout/
    ],
    'branch-delete': [
      /删除.*(?:分支)/,
      /移除.*(?:分支)/
    ],
    'branch-list': [
      /(?:列出|查看|显示).*(?:所有|全部)?分支/,
      /(?:分支列表|分支情况)/
    ],
    'merge': [
      /合并.*(?:分支|代码)/,
      /将.*(?:分支|代码).*合并/,
      /merge/
    ],
    'status': [
      /(?:查看|检查|显示).*(?:状态|情况|修改)/,
      /(?:状态|情况|修改|status)/
    ],
    'stash': [
      /暂存.*(?:修改|工作)/,
      /保存工作状态/,
      /stash/
    ],
    'stash-apply': [
      /应用.*(?:暂存|修改)/,
      /恢复.*(?:暂存|修改)/,
      /stash apply/,
      /取出.*stash/
    ],
    'log': [
      /(?:查看|显示).*(?:日志|历史|提交记录|log)/,
      /(?:日志|历史|log)/,
      /(?:提交历史|commit.*history)/
    ],
    'reset': [
      /(?:撤销|回退|复原|重置).*(?:修改|提交|代码)/,
      /(?:reset|还原)/
    ],
    'init': [
      /(?:初始化|创建).*(?:仓库|代码库|储存库|repo)/,
      /(?:init|新建仓库)/
    ],
    'diff': [
      /(?:比较|对比|查看).*(?:差异|区别|变化)/,
      /(?:diff|文件变化)/
    ],
    'remote-add': [
      /(?:添加|新增).*(?:远程|仓库地址)/,
      /(?:设置|配置).*(?:远程|地址)/
    ]
  };

  // 尝试匹配意图
  let bestMatch: IntentMatch | null = null;
  let highestConfidence = 0;

  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    for (const pattern of patterns) {
      if (pattern.test(input)) {
        // 简单起见，每个匹配的模式贡献0.25的置信度，但不超过1
        const matchConfidence = Math.min(1, 0.25 + highestConfidence);
        
        if (matchConfidence > highestConfidence) {
          highestConfidence = matchConfidence;
          bestMatch = {
            intent,
            confidence: matchConfidence,
            parameters: {}
          };
        }
      }
    }
  }

  // 如果找到意图匹配，提取参数
  if (bestMatch) {
    bestMatch.parameters = extractParameters(bestMatch.intent, input);
  }

  return bestMatch;
}

/**
 * 提取命令参数
 * @param intent 意图
 * @param input 用户输入
 * @returns 参数对象
 */
function extractParameters(intent: string, input: string): Record<string, string> {
  const params: Record<string, string> = {};

  // 提取提交消息
  if (intent === 'commit') {
    // 尝试多种格式提取提交信息
    const msgPatterns = [
      /[,，:：][\s]*(.*?)(?:$|[。.])/,  // "提交代码，修复登录问题"
      /['"""'](.*?)['"""']/,            // "提交'修复登录问题'"
      /提交.*(?:为|作为|内容为)[\s]*(.*?)(?:$|[。.])/  // "提交代码为修复登录问题"
    ];
    
    for (const pattern of msgPatterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        params.message = match[1].trim();
        break;
      }
    }
    
    // 如果没有提取到消息，使用默认消息
    if (!params.message) {
      params.message = "更新";
    }
    
    // 检查是否指定了特定文件
    const filePattern = /(?:文件|file)[s:：\s]+([^\s,，.。]+)/i;
    const fileMatch = input.match(filePattern);
    if (fileMatch && fileMatch[1]) {
      params.files = fileMatch[1];
    }
  }
  
  // 提取分支名称
  if (['branch-create', 'branch-switch', 'branch-delete', 'merge'].includes(intent)) {
    const branchPatterns = [
      /(?:分支|branch)[名叫为是:：\s]+([^\s,，.。]+)/i,  // "分支名为feature"
      /[为到][\s]*([^\s,，.。]+)(?:分支)?/,              // "切换到feature分支"
      /(?:名为|名叫|叫做|叫)[\s]*([^\s,，.。]+)(?:的?分支)?/  // "创建名为feature的分支"
    ];
    
    for (const pattern of branchPatterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        params.branch = match[1].trim();
        break;
      }
    }
  }
  
  // 提取远程仓库参数
  if (['push', 'pull', 'remote-add'].includes(intent)) {
    // 提取远程仓库名
    const remotePattern = /(?:远程|remote)[名叫为是:：\s]+([^\s,，.。]+)/i;
    const remoteMatch = input.match(remotePattern);
    if (remoteMatch && remoteMatch[1]) {
      params.remote = remoteMatch[1].trim();
    }
    
    // 提取URL
    const urlPattern = /(?:地址|url|链接)[名叫为是:：\s]+([^\s,，.。]+)/i;
    const urlMatch = input.match(urlPattern);
    if (urlMatch && urlMatch[1]) {
      params.url = urlMatch[1].trim();
    }
  }
  
  // 提取日志相关参数
  if (intent === 'log') {
    // 提取日志数量限制
    const limitPattern = /(?:最近|last|限制|limit)[为:：\s]*(\d+)/i;
    const limitMatch = input.match(limitPattern);
    if (limitMatch && limitMatch[1]) {
      params.limit = limitMatch[1];
    }
    
    // 提取作者
    const authorPattern = /(?:作者|author)[为是:：\s]+([^\s,，.。]+)/i;
    const authorMatch = input.match(authorPattern);
    if (authorMatch && authorMatch[1]) {
      params.author = authorMatch[1].trim();
    }
  }

  return params;
}

/**
 * 生成Git命令
 * @param intentMatch 意图匹配结果
 * @param originalInput 原始输入
 * @returns Git命令
 */
function generateCommand(intentMatch: IntentMatch, originalInput: string): string {
  const { intent, parameters } = intentMatch;
  
  // 命令模板定义
  const commandTemplates: Record<string, CommandTemplate> = {
    'commit': {
      template: 'git add {files} && git commit -m "{message}"',
      requiresParams: ['message'],
      description: '提交代码修改',
      examples: ['提交所有修改，备注修复登录问题', '提交代码：优化性能'],
      customHandler: (params) => {
        const files = params.files || '-A';
        return `git add ${files} && git commit -m "${params.message}"`;
      }
    },
    'push': {
      template: 'git push {remote} {branch}',
      requiresParams: [],
      description: '推送代码到远程仓库',
      examples: ['推送代码到远程', '推送到origin主分支'],
      customHandler: (params) => {
        const remote = params.remote || '';
        const branch = params.branch || '';
        return `git push ${remote} ${branch}`.trim();
      }
    },
    'pull': {
      template: 'git pull {remote} {branch}',
      requiresParams: [],
      description: '从远程仓库拉取代码',
      examples: ['拉取最新代码', '从远程获取更新'],
      customHandler: (params) => {
        const remote = params.remote || '';
        const branch = params.branch || '';
        return `git pull ${remote} ${branch}`.trim();
      }
    },
    'branch-create': {
      template: 'git checkout -b {branch}',
      requiresParams: ['branch'],
      description: '创建并切换到新分支',
      examples: ['创建新分支feature', '创建名为fix-bug的分支']
    },
    'branch-switch': {
      template: 'git checkout {branch}',
      requiresParams: ['branch'],
      description: '切换到指定分支',
      examples: ['切换到master分支', '切换到develop']
    },
    'branch-delete': {
      template: 'git branch -d {branch}',
      requiresParams: ['branch'],
      description: '删除指定分支',
      examples: ['删除feature分支', '删除名为old-branch的分支']
    },
    'branch-list': {
      template: 'git branch',
      requiresParams: [],
      description: '列出所有本地分支',
      examples: ['列出所有分支', '查看分支列表'],
      customHandler: (params) => {
        if (originalInput.includes('远程') || originalInput.includes('所有')) {
          return 'git branch -a';
        }
        return 'git branch';
      }
    },
    'merge': {
      template: 'git merge {branch}',
      requiresParams: ['branch'],
      description: '合并指定分支到当前分支',
      examples: ['合并feature分支', '将develop分支合并到当前分支']
    },
    'status': {
      template: 'git status',
      requiresParams: [],
      description: '查看仓库状态',
      examples: ['查看状态', '检查修改情况']
    },
    'stash': {
      template: 'git stash',
      requiresParams: [],
      description: '暂存当前工作区修改',
      examples: ['暂存当前修改', '保存工作状态'],
      customHandler: (params) => {
        if (originalInput.includes('保存') && originalInput.includes('消息')) {
          const messageMatch = originalInput.match(/消息[是为:：\s]+([^,，.。]+)/);
          if (messageMatch && messageMatch[1]) {
            return `git stash save "${messageMatch[1].trim()}"`;
          }
        }
        return 'git stash';
      }
    },
    'stash-apply': {
      template: 'git stash apply',
      requiresParams: [],
      description: '应用最近的一次暂存',
      examples: ['应用暂存的修改', '恢复之前的工作状态']
    },
    'log': {
      template: 'git log',
      requiresParams: [],
      description: '查看提交历史',
      examples: ['查看提交日志', '显示提交历史'],
      customHandler: (params) => {
        let command = 'git log';
        
        if (params.limit) {
          command += ` -n ${params.limit}`;
        }
        
        if (params.author) {
          command += ` --author="${params.author}"`;
        }
        
        if (originalInput.includes('简洁') || originalInput.includes('简短')) {
          command += ' --oneline';
        }
        
        if (originalInput.includes('图形') || originalInput.includes('图表')) {
          command += ' --graph';
        }
        
        return command;
      }
    },
    'reset': {
      template: 'git reset',
      requiresParams: [],
      description: '重置当前修改',
      examples: ['撤销最近的提交', '重置工作区'],
      customHandler: (params) => {
        if (originalInput.includes('硬') || originalInput.includes('hard')) {
          return 'git reset --hard HEAD';
        } else if (originalInput.includes('软') || originalInput.includes('soft')) {
          return 'git reset --soft HEAD^';
        } else if (originalInput.includes('最近') && originalInput.includes('提交')) {
          return 'git reset HEAD^';
        } else if (originalInput.includes('保留') && originalInput.includes('代码')) {
          return 'git reset --soft HEAD^';
        } else {
          return 'git reset';
        }
      }
    },
    'init': {
      template: 'git init',
      requiresParams: [],
      description: '初始化Git仓库',
      examples: ['初始化仓库', '创建新的Git仓库']
    },
    'diff': {
      template: 'git diff',
      requiresParams: [],
      description: '查看文件差异',
      examples: ['查看修改差异', '对比文件变化'],
      customHandler: (params) => {
        // 检查是否是比较特定文件
        const filePattern = /(?:文件|file)[s:：\s]+([^\s,，.。]+)/i;
        const fileMatch = originalInput.match(filePattern);
        if (fileMatch && fileMatch[1]) {
          return `git diff ${fileMatch[1].trim()}`;
        }
        
        // 检查是否是比较特定提交
        if (originalInput.includes('之间') || originalInput.includes('比较')) {
          // 这里可以进一步解析，目前简化处理
          return 'git diff HEAD^ HEAD';
        }
        
        return 'git diff';
      }
    },
    'remote-add': {
      template: 'git remote add {remote} {url}',
      requiresParams: ['remote', 'url'],
      description: '添加远程仓库',
      examples: ['添加远程仓库地址', '设置远程仓库为github']
    }
  };

  // 获取命令模板
  const template = commandTemplates[intent];
  if (!template) {
    throw new Error(`不支持的命令: ${intent}`);
  }

  // 检查是否缺少必需参数
  for (const param of template.requiresParams) {
    if (!parameters[param]) {
      throw new Error(`命令缺少必要参数: ${param}，请提供更具体的指令`);
    }
  }

  // 使用自定义处理函数或模板生成命令
  if (template.customHandler) {
    return template.customHandler(parameters, originalInput);
  } else {
    let command = template.template;
    for (const [key, value] of Object.entries(parameters)) {
      command = command.replace(`{${key}}`, value);
    }
    return command;
  }
} 