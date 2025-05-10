# GT-NL 智能Git助手

GT-NL是一个基于自然语言交互的Git操作助手，旨在通过自然语言理解简化Git操作、提供代码分析和安全保障。

## 功能特点

- **自然语言交互**：使用自然语言描述操作意图，自动转化为正确的Git命令
- **智能代码分析**：扫描代码库，识别安全漏洞、代码质量问题和规范违反
- **风险操作防护**：对危险操作进行风险评估和拦截，提供操作回退能力
- **学习适应系统**：根据用户习惯优化语义解析，适应团队开发规范
- **智能提交消息**：当没有指定提交消息时，自动根据修改内容生成描述性的提交消息

## 快速开始

### 安装依赖

```bash
# 使用Bun安装依赖
bun install
```

### 开发

```bash
# 开发模式启动
bun run dev
```

### 构建

```bash
# 构建项目
bun run build
```

## 使用示例

```bash
# 提交所有修改
gt 提交所有修改，备注修复登录BUG

# 不指定提交消息，将自动生成
gt 提交当前所有修改

# 创建分支
gt 创建一个名为feature/user-auth的新分支

# 对比修改
gt 对比昨天和今天的改动

# 代码扫描
gt scan --security

# 配置LLM服务
gt config
```

## 配置LLM服务

GT-NL使用OpenAI或兼容接口的LLM服务进行自然语言理解。您可以通过以下方式配置LLM服务参数：

```bash
# 设置API密钥
gt config -k "your-api-key"

# 设置模型名称（默认为gpt-3.5-turbo）
gt config -m "gpt-4"

# 设置自定义API端点（对于兼容OpenAI接口的本地或其他服务）
gt config -u "http://your-api-server/v1"

# 设置多个参数
gt config -k "your-api-key" -m "gpt-4" -u "http://your-api-server/v1"

# 查看当前配置
gt config --show

# 交互式配置
gt config
```

配置信息保存在用户主目录的 `.gt-nl/config.json` 文件中。

## 智能提交消息

GT-NL可以自动根据修改内容生成提交消息，无需手动输入。当用户执行提交命令但没有指定消息时，系统会：

1. 分析Git暂存区的差异内容（diff）
2. 使用LLM生成一个简洁、描述性强的提交消息
3. 自动识别提交类型（feat, fix, docs等）并添加到消息前面

使用此功能的方式：

```bash
# 方式1：使用自然语言命令，不指定提交消息
gt 提交所有修改

# 方式2：明确要求自动生成提交消息
gt 提交并自动生成消息

# 方式3：直接使用Git命令（系统会拦截并自动生成消息）
gt git add -A && git commit
```

要使用此功能，需要确保已配置LLM服务（通过`gt config`设置API密钥）。如果LLM服务不可用，系统将使用默认消息"更新"。

## 系统要求

- Bun >= 1.0.0
- Node.js >= 16.0.0 (兼容模式)
- Git >= 2.20.0

## 文档

- [产品需求文档](prd.md)
- [技术架构文档](技术架构.md)

## 项目结构

```
gt-nl/
├── src/                    # 源代码目录
│   ├── cli/                # 命令行接口
│   ├── core/               # 核心处理逻辑
│   │   ├── nlp/            # 自然语言处理模块
│   │   ├── git/            # Git命令执行模块
│   │   ├── analysis/       # 代码分析模块
│   │   └── learning/       # 学习适应系统
│   ├── utils/              # 工具函数
│   └── types/              # TypeScript类型定义
├── tests/                  # 测试文件
└── docs/                   # 文档目录
```

## 许可证

MIT

