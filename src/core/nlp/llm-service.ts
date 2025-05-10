/**
 * LLM服务模块
 * 集成LangChain和外部LLM服务，提供更强大的自然语言理解能力
 */

import { ChatOpenAI } from "langchain/chat_models/openai";
import { 
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  SystemMessagePromptTemplate
} from "langchain/prompts";
import { LLMChain } from "langchain/chains";
import { StructuredOutputParser } from "langchain/output_parsers";
import { z } from "zod";
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// 定义LLM配置
const CONFIG_FILE = path.join(os.homedir(), '.gt-nl', 'config.json');
let API_KEY = '';
let MODEL_NAME = 'gpt-3.5-turbo';
let BASE_URL = '';

// 定义配置类型
interface LLMConfig {
  apiKey: string;
  model?: string;
  baseUrl?: string;
}

// 定义Git命令解析结果的格式
const gitCommandSchema = z.object({
  command: z.string().describe("生成的Git命令，如 'git add -A && git commit -m \"修复登录BUG\"'"),
  explanation: z.string().describe("简短解释为什么选择这个命令"),
  confidence: z.number().min(0).max(1).describe("命令匹配的置信度，0-1之间"),
  alternatives: z.array(z.string()).optional().describe("可选的替代命令")
});

// 定义工作流计划结果的格式
const workflowPlanSchema = z.object({
  steps: z.array(z.string()).describe("工作流步骤ID列表"),
  summary: z.string().describe("工作流计划的概述"),
  reasoning: z.string().describe("分析过程和理由")
});

// 定义类型
type GitCommandResult = z.infer<typeof gitCommandSchema>;
type WorkflowPlanResult = z.infer<typeof workflowPlanSchema>;

/**
 * 初始化LLM服务
 */
export async function initLLMService(): Promise<boolean> {
  try {
    // 检查配置文件是否存在
    try {
      const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
      const config = JSON.parse(configData) as LLMConfig;
      API_KEY = config.apiKey || '';
      MODEL_NAME = config.model || 'gpt-3.5-turbo';
      BASE_URL = config.baseUrl || '';
    } catch (error) {
      // 如果配置文件不存在或无效，保持默认值
    }
    
    return !!API_KEY;
  } catch (error) {
    console.error('初始化LLM服务失败:', error);
    return false;
  }
}

/**
 * 设置LLM配置
 * @param config LLM配置对象
 */
export async function setLLMConfig(config: LLMConfig): Promise<void> {
  API_KEY = config.apiKey;
  if (config.model) MODEL_NAME = config.model;
  if (config.baseUrl) BASE_URL = config.baseUrl;
  
  // 确保目录存在
  await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
  
  // 保存配置
  await fs.writeFile(
    CONFIG_FILE,
    JSON.stringify(config, null, 2),
    'utf-8'
  );
}

/**
 * 设置API密钥
 * @param apiKey OpenAI API密钥
 */
export async function setAPIKey(apiKey: string): Promise<void> {
  API_KEY = apiKey;
  
  // 确保目录存在
  await fs.mkdir(path.dirname(CONFIG_FILE), { recursive: true });
  
  // 读取现有配置
  let config: LLMConfig = { apiKey };
  try {
    const configData = await fs.readFile(CONFIG_FILE, 'utf-8');
    const existingConfig = JSON.parse(configData) as LLMConfig;
    config = { ...existingConfig, apiKey };
  } catch (error) {
    // 如果文件不存在，使用默认配置
  }
  
  // 保存配置
  await fs.writeFile(
    CONFIG_FILE,
    JSON.stringify(config, null, 2),
    'utf-8'
  );
}

/**
 * 生成Git命令
 * @param input 用户输入的自然语言指令
 * @returns 解析结果
 */
export async function generateGitCommand(input: string): Promise<GitCommandResult> {
  // 检查API密钥
  if (!API_KEY) {
    throw new Error('请先设置OpenAI API密钥');
  }
  
  try {
    // 初始化LLM
    const modelConfig: any = {
      modelName: MODEL_NAME,
      temperature: 0,
      openAIApiKey: API_KEY,
    };
    
    // 如果设置了BASE_URL，添加到配置中
    if (BASE_URL) {
      modelConfig.configuration = {
        baseURL: BASE_URL
      };
    }
    
    const model = new ChatOpenAI(modelConfig);
    
    // 创建输出解析器
    const parser = StructuredOutputParser.fromZodSchema(gitCommandSchema);
    
    // 创建提示模板
    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(
        `你是一个精通Git的助手，负责将用户的自然语言指令转换为正确的Git命令。
        请分析用户的意图，并生成最匹配的Git命令。
        
        请遵循以下规则：
        1. 只输出Git命令，不要解释如何执行
        2. 如果用户指令不明确，尽可能做出合理推断
        3. 对于高风险操作（如 git reset --hard），在解释中注明风险
        4. 输出格式必须符合以下JSON结构:
        {format_instructions}`
      ),
      HumanMessagePromptTemplate.fromTemplate("{input}")
    ]);
    
    // 格式化提示
    const formattedPrompt = await prompt.formatPromptValue({
      format_instructions: parser.getFormatInstructions(),
      input: input
    });
    
    // 使用格式化后的消息调用模型
    const result = await model.generatePrompt([formattedPrompt]);
    const message = result.generations[0][0].text;
    
    // 解析回复为JSON
    const parsedOutput = await parser.parse(message);
    return parsedOutput;
    
  } catch (error) {
    console.error('LLM处理失败:', error);
    throw new Error(`LLM处理失败: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * 生成工作流计划
 * @param input 用户输入
 * @returns 工作流计划
 */
export async function generateWorkflowPlan(input: string): Promise<WorkflowPlanResult> {
  // 检查API密钥
  if (!API_KEY) {
    console.warn('警告: 未设置OpenAI API密钥，无法使用LLM生成工作流计划');
    console.warn('请使用 "gt config -k YOUR_API_KEY" 命令设置API密钥');
    
    // 返回基础工作流计划
    const input_lower = input.toLowerCase();
    
    // 根据输入关键词选择合适的步骤
    if (input_lower.includes('统计') || input_lower.includes('代码行') || input_lower.includes('变更统计')) {
      return {
        steps: ['git-status', 'git-code-stats'],
        summary: '检查仓库状态并统计代码变更',
        reasoning: '根据输入中包含统计相关关键词，选择查看状态并统计代码变更的步骤。'
      };
    } else if (input_lower.includes('提交') && input_lower.includes('推送')) {
      return {
        steps: ['git-status', 'git-diff-analysis', 'git-add', 'git-commit', 'git-push'],
        summary: '检查仓库状态，添加变更文件，提交并推送到远程',
        reasoning: '根据输入中包含提交和推送关键词，选择完整的提交并推送工作流。'
      };
    } else if (input_lower.includes('提交')) {
      return {
        steps: ['git-status', 'git-diff-analysis', 'git-add', 'git-commit'],
        summary: '检查仓库状态，添加变更文件并提交',
        reasoning: '根据输入中包含提交关键词，选择查看状态并提交变更的工作流。'
      };
    } else {
      // 默认情况，至少检查状态
      return {
        steps: ['git-status'],
        summary: '检查仓库状态',
        reasoning: '无法确定具体意图，默认执行状态检查。'
      };
    }
  }
  
  try {
    // 初始化LLM
    const modelConfig: any = {
      modelName: MODEL_NAME,
      temperature: 0.2, // 允许一定的创造性
      openAIApiKey: API_KEY,
    };
    
    // 如果设置了BASE_URL，添加到配置中
    if (BASE_URL) {
      modelConfig.configuration = {
        baseURL: BASE_URL
      };
    }
    
    const model = new ChatOpenAI(modelConfig);
    
    // 创建输出解析器
    const parser = StructuredOutputParser.fromZodSchema(workflowPlanSchema);
    
    // 创建提示模板
    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(
        `你是一个分析用户意图并生成工作流计划的专家。根据用户的输入，生成一个分步骤的工作流计划。

        可用的工作流步骤ID：
        - git-status: 检查Git仓库状态和变更文件
        - git-diff-analysis: 分析变更内容并生成提交消息建议
        - git-add: 将变更文件添加到暂存区
        - git-commit: 提交变更
        - git-push: 推送到远程仓库
        - git-code-stats: 统计变更的代码行数，按文件类型和文件分类展示
        
        你需要根据用户的意图，选择合适的步骤并按照逻辑顺序排列。
        
        例如：
        1. 用户想要"提交当前修改"，应该包含：git-status -> git-diff-analysis -> git-add -> git-commit
        2. 用户想要"检查状态"，只需要：git-status
        3. 用户想要"提交并推送"，应该包含：git-status -> git-diff-analysis -> git-add -> git-commit -> git-push
        4. 用户想要"统计代码变更"，应该包含：git-status -> git-code-stats
        5. 用户想要"查看代码统计并提交"，应该包含：git-status -> git-code-stats -> git-diff-analysis -> git-add -> git-commit
        
        请分析用户的意图，并生成合适的工作流计划。如果用户明确提到了统计代码行数或查看代码变更统计，一定要包含git-code-stats步骤。
        
        输出必须符合以下JSON结构:
        {format_instructions}`
      ),
      HumanMessagePromptTemplate.fromTemplate("{input}")
    ]);
    
    // 格式化提示
    const formattedPrompt = await prompt.formatPromptValue({
      format_instructions: parser.getFormatInstructions(),
      input: input
    });
    
    // 使用格式化后的消息调用模型
    const result = await model.generatePrompt([formattedPrompt]);
    const message = result.generations[0][0].text;
    
    // 解析回复为JSON
    return await parser.parse(message);
    
  } catch (error) {
    console.error('生成工作流计划失败:', error);
    
    // 基于输入内容提供一个合理的回退方案
    const input_lower = input.toLowerCase();
    
    if (input_lower.includes('统计') || input_lower.includes('代码行') || input_lower.includes('变更统计')) {
      return {
        steps: ['git-status', 'git-code-stats'],
        summary: '检查仓库状态并统计代码变更',
        reasoning: '根据输入中包含统计相关关键词，选择查看状态并统计代码变更的步骤。'
      };
    } else if (input_lower.includes('提交') && input_lower.includes('推送')) {
      return {
        steps: ['git-status', 'git-diff-analysis', 'git-add', 'git-commit', 'git-push'],
        summary: '检查仓库状态，添加变更文件，提交并推送到远程',
        reasoning: '根据输入中包含提交和推送关键词，选择完整的提交并推送工作流。'
      };
    } else if (input_lower.includes('提交')) {
      return {
        steps: ['git-status', 'git-diff-analysis', 'git-add', 'git-commit'],
        summary: '检查仓库状态，添加变更文件并提交',
        reasoning: '由于LLM处理失败，根据输入中包含提交关键词，提供一个基本的提交工作流。'
      };
    } else {
      // 默认工作流
      return {
        steps: ['git-status', 'git-diff-analysis', 'git-add', 'git-commit'],
        summary: '检查状态并提交所有变更',
        reasoning: '由于无法分析用户意图，提供一个基本的提交工作流作为默认选项。'
      };
    }
  }
}

/**
 * 根据Git diff内容生成提交消息
 * @param diffContent Git diff的内容
 * @returns 生成的提交消息
 */
export async function generateCommitMessage(diffContent: string): Promise<string> {
  // 检查API密钥
  if (!API_KEY) {
    throw new Error('请先设置OpenAI API密钥');
  }
  
  try {
    // 初始化LLM
    const modelConfig: any = {
      modelName: MODEL_NAME,
      temperature: 0.2, // 稍微增加一点创造性
      openAIApiKey: API_KEY,
      maxTokens: 100, // 限制输出长度，提交消息应当简洁
    };
    
    // 如果设置了BASE_URL，添加到配置中
    if (BASE_URL) {
      modelConfig.configuration = {
        baseURL: BASE_URL
      };
    }
    
    const model = new ChatOpenAI(modelConfig);
    
    // 创建输出解析器
    const parser = StructuredOutputParser.fromZodSchema(
      z.object({
        commitMessage: z.string().describe('Git提交消息，不包含引号'),
        type: z.enum(['feat', 'fix', 'docs', 'style', 'refactor', 'test', 'chore']).optional().describe('提交类型（可选）')
      })
    );
    
    // 截断过长的diff内容，防止超出token限制
    const truncatedDiff = diffContent.length > 3000 
      ? diffContent.substring(0, 3000) + "\n... [diff内容过长，已截断]" 
      : diffContent;
    
    // 创建提示模板
    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(
        `根据提供的Git diff内容，生成一个简洁、描述性强的提交消息。
        
        请遵循以下规则：
        1. 消息应简洁明了，通常不超过50个字符
        2. 使用祈使句（命令式），如"修复"而不是"修复了"
        3. 可以选择性地识别提交类型（feat, fix, docs, style, refactor, test, chore）
        4. 不要在消息中包含引号
        5. 如果是多语言环境，优先使用中文
        
        以下是Git diff内容:
        
        {diffContent}
        
        {format_instructions}`
      )
    ]);
    
    // 格式化提示
    const formattedPrompt = await prompt.formatPromptValue({
      format_instructions: parser.getFormatInstructions(),
      diffContent: truncatedDiff
    });
    
    // 使用格式化后的消息调用模型
    const result = await model.generatePrompt([formattedPrompt]);
    const message = result.generations[0][0].text;
    
    // 解析回复为JSON
    const parsedOutput = await parser.parse(message);
    
    // 如果有提交类型，则添加到消息前面
    if (parsedOutput.type) {
      return `${parsedOutput.type}: ${parsedOutput.commitMessage}`;
    }
    
    return parsedOutput.commitMessage;
  } catch (error) {
    console.error('生成提交消息失败:', error);
    // 失败时返回默认消息
    return "更新";
  }
}

/**
 * 分析Git命令的风险
 * @param command Git命令
 * @returns 风险分析结果
 */
export async function analyzeCommandRisk(command: string): Promise<{
  riskLevel: 'low' | 'medium' | 'high';
  explanation: string;
}> {
  // 检查API密钥
  if (!API_KEY) {
    // 如果没有API密钥，使用本地规则进行分析
    return analyzeCommandRiskLocally(command);
  }
  
  try {
    // 初始化LLM
    const modelConfig: any = {
      modelName: MODEL_NAME,
      temperature: 0,
      openAIApiKey: API_KEY,
    };
    
    // 如果设置了BASE_URL，添加到配置中
    if (BASE_URL) {
      modelConfig.configuration = {
        baseURL: BASE_URL
      };
    }
    
    const model = new ChatOpenAI(modelConfig);
    
    // 创建输出解析器
    const parser = StructuredOutputParser.fromZodSchema(
      z.object({
        riskLevel: z.enum(['low', 'medium', 'high']).describe('命令的风险级别'),
        explanation: z.string().describe('风险分析解释')
      })
    );
    
    // 创建提示模板
    const prompt = ChatPromptTemplate.fromMessages([
      SystemMessagePromptTemplate.fromTemplate(
        `分析以下Git命令的风险级别。
        请考虑命令可能导致的数据丢失风险、是否可撤销、对仓库历史的影响等。
        
        风险级别定义：
        - low: 安全操作，不会导致数据丢失，可以轻易撤销
        - medium: 需要谨慎操作，可能会改变仓库状态，但通常可撤销
        - high: 高风险操作，可能导致数据丢失，难以撤销
        
        请分析命令: {command}
        
        {format_instructions}`
      )
    ]);
    
    // 格式化提示
    const formattedPrompt = await prompt.formatPromptValue({
      format_instructions: parser.getFormatInstructions(),
      command: command
    });
    
    // 使用格式化后的消息调用模型
    const result = await model.generatePrompt([formattedPrompt]);
    const message = result.generations[0][0].text;
    
    // 解析回复为JSON
    return await parser.parse(message);
    
  } catch (error) {
    console.error('分析命令风险失败:', error);
    // 失败时使用本地规则
    return analyzeCommandRiskLocally(command);
  }
}

// 本地分析命令风险
function analyzeCommandRiskLocally(command: string): {
  riskLevel: 'low' | 'medium' | 'high';
  explanation: string;
} {
  // 高风险命令关键词
  const highRiskPatterns = [
    'reset --hard',
    'clean -fd',
    'push --force',
    'push -f',
    'branch -D'
  ];

  // 中等风险命令关键词
  const mediumRiskPatterns = [
    'reset',
    'rebase',
    'checkout -b',
    'branch -d',
    'stash drop'
  ];

  // 判断风险级别
  for (const pattern of highRiskPatterns) {
    if (command.includes(pattern)) {
      return {
        riskLevel: 'high',
        explanation: '此命令可能会导致数据丢失或破坏仓库历史'
      };
    }
  }

  for (const pattern of mediumRiskPatterns) {
    if (command.includes(pattern)) {
      return {
        riskLevel: 'medium',
        explanation: '此命令会改变仓库状态，但通常可以恢复'
      };
    }
  }

  return {
    riskLevel: 'low',
    explanation: '此命令是安全的，不会导致数据丢失'
  };
} 