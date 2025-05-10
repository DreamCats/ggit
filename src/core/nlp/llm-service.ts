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

// 定义类型
type GitCommandResult = z.infer<typeof gitCommandSchema>;

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
    console.error('风险分析失败:', error);
    // 如果LLM分析失败，回退到本地规则
    return analyzeCommandRiskLocally(command);
  }
}

/**
 * 使用本地规则分析命令风险
 * @param command Git命令
 * @returns 风险分析结果
 */
function analyzeCommandRiskLocally(command: string): {
  riskLevel: 'low' | 'medium' | 'high';
  explanation: string;
} {
  // 高风险命令关键词
  const highRiskPatterns = [
    { pattern: 'reset --hard', explanation: '硬重置会丢失所有未提交的修改' },
    { pattern: 'clean -fd', explanation: '强制删除未跟踪的文件和目录' },
    { pattern: 'push --force', explanation: '强制推送可能覆盖远程仓库历史' },
    { pattern: 'push -f', explanation: '强制推送可能覆盖远程仓库历史' },
    { pattern: 'branch -D', explanation: '强制删除分支，即使有未合并的更改' }
  ];

  // 中等风险命令关键词
  const mediumRiskPatterns = [
    { pattern: 'reset', explanation: '重置操作可能会改变工作区状态' },
    { pattern: 'rebase', explanation: '变基操作会重写提交历史' },
    { pattern: 'checkout -b', explanation: '创建并切换分支，暂存区会随之变化' },
    { pattern: 'branch -d', explanation: '删除已合并的分支' },
    { pattern: 'stash drop', explanation: '删除存储的工作状态' }
  ];

  // 判断风险级别
  for (const { pattern, explanation } of highRiskPatterns) {
    if (command.includes(pattern)) {
      return {
        riskLevel: 'high',
        explanation
      };
    }
  }

  for (const { pattern, explanation } of mediumRiskPatterns) {
    if (command.includes(pattern)) {
      return {
        riskLevel: 'medium',
        explanation
      };
    }
  }

  return {
    riskLevel: 'low',
    explanation: '此命令是安全操作，不会导致数据丢失'
  };
} 