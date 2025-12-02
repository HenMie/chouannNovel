# ChouannNovel - AI小说创作工作流软件

## 项目概述

ChouannNovel 是一个基于 Tauri 的桌面应用，用于辅助 AI 小说创作。用户可以创建多个工作流，每个工作流包含多个可配置的节点（AI对话、文本处理、条件判断等），实现自动化的小说创作流程。

## 技术栈

| 层级 | 技术选型 |
|------|----------|
| 桌面框架 | Tauri v2 |
| 前端框架 | React 19 + TypeScript |
| 状态管理 | Zustand |
| 组件库 | shadcn/ui |
| 图标库 | Lucide React |
| 动画库 | Framer Motion |
| 数据库 | SQLite (Tauri SQL插件) |
| 样式 | Tailwind CSS |
| AI SDK | Vercel AI SDK (ai, @ai-sdk/openai, @ai-sdk/google, @ai-sdk/anthropic) |

## 核心功能

### 1. 项目管理
- 多项目管理（每个项目对应一部小说）
- 项目 CRUD 操作
- 本地 SQLite 存储

### 2. 工作流系统
- 每个项目可包含多个工作流
- 列表表单式编辑界面
- 节点可拖拽排序
- 支持循环和条件分支

### 3. 节点类型

| 类型 | 节点 | 说明 |
|------|------|------|
| 输入输出 | `input` | 用户输入节点 |
| | `output` | 输出节点 |
| AI | `ai_chat` | AI对话节点 |
| 文本处理 | `text_extract` | 内容提取 |
| | `text_concat` | 文本拼接 |
| 流程控制 | `condition` | 条件判断 |
| | `loop` | 循环控制 |
| | `batch` | 批量并发执行 |
| 变量 | `var_set` | 设置变量 |
| | `var_get` | 读取变量 |

### 4. AI服务支持
- OpenAI (GPT-4o, GPT-4o-mini, o1等)
- Google Gemini (gemini-2.0-flash, gemini-2.5-pro等)
- Anthropic Claude (claude-sonnet-4, claude-3.5-haiku等)
- 全局统一 API Key 配置
- 根据模型动态启用参数（temperature, max_tokens, top_p, thinking_level）

### 5. 设定库
- 分类：角色、世界观、笔触风格、大纲
- 每个分类可单独启用/关闭
- 可设定各分类的注入提示词模板
- 在 AI 节点中引用设定

### 6. 执行引擎
- 流式输出显示
- 支持暂停/继续/终止
- 人工干预编辑
- 循环保护（最大次数、超时限制）
- 执行历史记录与回溯

### 7. 变量系统
- 变量插值语法：`{{变量名}}`
- 可引用上一节点输出
- 可读写自定义变量
- 单次执行内的对话历史上下文

### 8. 界面特性
- 浅色/深色主题，默认跟随系统
- 实时流式输出
- 每个节点输出可查看
- 导出 TXT/Markdown

---

## 数据模型

### projects 项目表
```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### workflows 工作流表
```sql
CREATE TABLE workflows (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  loop_max_count INTEGER DEFAULT 10,
  timeout_seconds INTEGER DEFAULT 300,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

### nodes 节点表
```sql
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  config TEXT NOT NULL, -- JSON
  order_index INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);
```

### settings 设定库表
```sql
CREATE TABLE settings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  category TEXT NOT NULL, -- character/worldview/style/outline
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

### setting_prompts 设定注入提示词表
```sql
CREATE TABLE setting_prompts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  category TEXT NOT NULL,
  prompt_template TEXT NOT NULL, -- 注入提示词模板
  enabled INTEGER DEFAULT 1,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
```

### global_config 全局配置表
```sql
CREATE TABLE global_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ai_providers TEXT NOT NULL, -- JSON
  theme TEXT DEFAULT 'system',
  default_loop_max INTEGER DEFAULT 10,
  default_timeout INTEGER DEFAULT 300
);
```

### executions 执行记录表
```sql
CREATE TABLE executions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  status TEXT NOT NULL, -- running/paused/completed/failed/cancelled/timeout
  input TEXT,
  final_output TEXT,
  variables_snapshot TEXT, -- JSON
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);
```

### node_results 节点执行结果表
```sql
CREATE TABLE node_results (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  iteration INTEGER DEFAULT 1,
  input TEXT,
  output TEXT,
  status TEXT NOT NULL,
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME,
  FOREIGN KEY (execution_id) REFERENCES executions(id) ON DELETE CASCADE
);
```

---

## 开发计划

### Phase 1: 基础架构 (P0) ✅
- [x] 创建计划文档
- [x] 初始化 Tauri + React 项目
- [x] 配置 Tailwind CSS + shadcn/ui
- [x] 配置 SQLite 数据库
- [x] 实现基础布局组件
- [x] 实现明暗主题切换

### Phase 2: 项目与工作流 (P0) ✅
- [x] 项目 CRUD
- [x] 工作流 CRUD
- [x] 节点 CRUD
- [x] 节点拖拽排序

### Phase 3: AI节点 (P0) ✅
- [x] 全局 API 配置页面
- [x] AI 服务封装 (OpenAI/Gemini/Claude)
- [x] AI 对话节点配置表单
- [x] 流式输出显示

### Phase 4: 执行引擎 (P0) 🚧
- [ ] 基础执行引擎
- [ ] 执行状态管理
- [ ] 暂停/继续/终止

### Phase 5: 流程控制节点 (P1)
- [ ] 条件判断节点
- [ ] 循环节点
- [ ] 批量并发执行节点

### Phase 6: 文本处理节点 (P1)
- [ ] 内容提取节点
- [ ] 文本拼接节点

### Phase 7: 变量系统 (P1)
- [ ] 变量设置/读取节点
- [ ] 变量插值解析
- [ ] 对话历史上下文

### Phase 8: 设定库 (P1)
- [ ] 设定库 CRUD
- [ ] 设定分类管理
- [ ] 注入提示词配置
- [ ] AI 节点引用设定

### Phase 9: 历史与导出 (P2)
- [ ] 执行历史记录
- [ ] 历史回溯查看
- [ ] 导出 TXT/Markdown

### Phase 10: 人工干预 (P2)
- [ ] 暂停时编辑节点输出
- [ ] 修改后继续执行

### Phase 11: 优化 (P3)
- [ ] 提示词编辑器（变量高亮）
- [ ] 快捷键支持
- [ ] 节点复制/粘贴
- [ ] 性能优化

---

## 节点配置详情

### AI对话节点 (ai_chat)
```typescript
interface AIChatConfig {
  provider: 'openai' | 'gemini' | 'claude';
  model: string;
  prompt: string;                    // 支持 {{变量}} 插值
  
  // 模型参数 (根据模型动态启用)
  temperature?: number;              // 0-2
  max_tokens?: number;
  top_p?: number;
  thinking_level?: 'low' | 'high';   // Gemini专用
  
  // 上下文设置
  enable_history: boolean;
  history_count: number;
  
  // 设定引用
  setting_ids: string[];
  
  // 数据源
  input_source: 'previous' | 'variable' | 'custom';
  input_variable?: string;
  custom_input?: string;
}
```

### 条件判断节点 (condition)
```typescript
interface ConditionConfig {
  input_source: 'previous' | 'variable';
  input_variable?: string;
  
  condition_type: 'keyword' | 'length' | 'regex' | 'ai_judge';
  
  // 各类型配置...
  keywords?: string[];
  keyword_mode?: 'any' | 'all' | 'none';
  
  length_operator?: '>' | '<' | '=' | '>=' | '<=';
  length_value?: number;
  
  regex_pattern?: string;
  
  ai_prompt?: string;
  ai_provider?: string;
  ai_model?: string;
  
  // 流程控制
  true_action: 'next' | 'jump' | 'end';
  true_target?: string;              // 跳转目标节点ID
  false_action: 'next' | 'jump' | 'end';
  false_target?: string;
}
```

### 批量并发执行节点 (batch)
```typescript
interface BatchConfig {
  // 输入：将输入拆分为多个任务
  input_source: 'previous' | 'variable';
  input_variable?: string;
  split_mode: 'line' | 'separator' | 'json_array';
  separator?: string;
  
  // 要并发执行的节点
  target_nodes: string[];            // 节点ID列表
  
  // 并发控制
  concurrency: number;               // 最大并发数
  
  // 输出汇总
  output_mode: 'array' | 'concat';
  output_separator?: string;
}
```

---

## 设定库注入机制

每个设定分类可配置注入提示词模板：

```
【角色设定】
{{#each characters}}
角色名：{{name}}
{{content}}
{{/each}}

【世界观设定】
{{worldview}}

【笔触风格】
{{style}}

【大纲】
{{outline}}
```

AI节点执行时，根据引用的设定自动拼接到提示词中。

---

## 已实现项目结构

```
src/
├── components/
│   ├── layout/                   # 布局组件
│   │   ├── Header.tsx            # 顶部导航栏（含主题切换）
│   │   ├── MainLayout.tsx        # 主布局（含简易路由）
│   │   └── Sidebar.tsx           # 侧边栏（项目树）
│   ├── node/                     # 节点相关组件
│   │   ├── NodeConfigDrawer.tsx  # 节点配置抽屉
│   │   └── configs/
│   │       └── AIChatConfig.tsx  # AI 对话节点配置表单
│   ├── execution/                # 执行相关组件
│   │   └── StreamingOutput.tsx   # 流式输出显示
│   └── ui/                       # shadcn/ui 组件
│       ├── button.tsx, card.tsx, dialog.tsx, ...
│       ├── slider.tsx, switch.tsx  # 新增
│       └── ...
│
├── lib/
│   ├── ai/                       # AI 服务模块 (Vercel AI SDK)
│   │   ├── index.ts              # 统一入口
│   │   └── types.ts              # 类型定义
│   ├── db/index.ts               # 数据库操作模块
│   └── utils.ts                  # 工具函数 (cn)
│
├── pages/                        # 页面组件
│   ├── index.ts                  # 导出所有页面
│   ├── HomePage.tsx              # 首页/项目列表
│   ├── ProjectPage.tsx           # 项目详情页
│   ├── WorkflowPage.tsx          # 工作流编辑页
│   ├── SettingsPage.tsx          # 全局设置页
│   ├── NewProjectPage.tsx        # 新建项目页
│   └── NewWorkflowPage.tsx       # 新建工作流页
│
├── stores/                       # Zustand 状态管理
│   ├── theme-store.ts            # 主题状态
│   └── project-store.ts          # 项目/工作流/节点状态
│
├── types/
│   └── index.ts                  # TypeScript 类型定义
│
├── App.tsx                       # 应用入口
├── main.tsx                      # React 入口
└── index.css                     # Tailwind CSS + 主题变量
```

---

## 关键模块说明

### 1. AI 服务 (`src/lib/ai/`)

使用 **Vercel AI SDK** 统一封装，支持 OpenAI、Gemini、Claude 三种提供商。

```typescript
import { chat, chatStream, getAvailableModels, getModelConfig } from '@/lib/ai'

// 获取可用模型列表（根据全局配置）
const models = getAvailableModels(globalConfig)

// 非流式请求
const response = await chat({
  provider: 'openai',
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
  temperature: 0.7,
  maxTokens: 4096,
}, globalConfig)

// 流式请求
await chatStream({
  provider: 'claude',
  model: 'claude-sonnet-4-20250514',
  messages: [...],
}, globalConfig, (chunk) => {
  if (!chunk.done) {
    console.log(chunk.content)  // 流式输出内容
  }
})
```

**支持的模型**：
- OpenAI: `gpt-4o`, `gpt-4o-mini`, `o1`, `o1-mini`
- Gemini: `gemini-2.0-flash-exp`, `gemini-2.5-pro-preview-06-05`, `gemini-1.5-pro`
- Claude: `claude-sonnet-4-20250514`, `claude-3-5-haiku-20241022`, `claude-3-5-sonnet-20241022`

### 2. 数据库操作 (`src/lib/db/index.ts`)

```typescript
import { getDatabase, generateId } from '@/lib/db'

// 项目操作
getProjects()                                    // 获取所有项目
createProject(name, description?)                // 创建项目
updateProject(id, { name?, description? })       // 更新项目
deleteProject(id)                                // 删除项目

// 工作流操作
getWorkflows(projectId)                          // 获取项目下所有工作流
createWorkflow(projectId, name, description?)    // 创建工作流
deleteWorkflow(id)                               // 删除工作流

// 节点操作
getNodes(workflowId)                             // 获取工作流下所有节点
createNode(workflowId, type, name, config?)      // 创建节点
updateNode(id, { name?, config? })               // 更新节点
deleteNode(id)                                   // 删除节点
reorderNodes(workflowId, nodeIds[])              // 重新排序节点

// 全局配置
getGlobalConfig()                                // 获取全局配置
updateGlobalConfig({ ai_providers?, theme?, ... }) // 更新全局配置
```

### 3. 状态管理 (`src/stores/`)

**项目状态 (`project-store.ts`)**
```typescript
const {
  projects, currentProject, workflows, currentWorkflow, nodes,
  loadProjects, createProject, setCurrentProject,
  loadNodes, createNode, updateNode, reorderNodes,
} = useProjectStore()
```

**主题状态 (`theme-store.ts`)**
```typescript
const { theme, setTheme } = useThemeStore()
// theme: 'light' | 'dark' | 'system'
```

### 4. 路由机制

使用简易路由（在 `MainLayout.tsx` 中实现）：

```typescript
'/'                                    -> HomePage
'/settings'                            -> SettingsPage
'/project/new'                         -> NewProjectPage
'/project/:id'                         -> ProjectPage
'/project/:id/workflow/new'            -> NewWorkflowPage
'/project/:id/workflow/:wid'           -> WorkflowPage

// 导航: onNavigate('/project/xxx')
```

### 5. 节点拖拽排序

使用 `@dnd-kit` 实现：

```typescript
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
```

---

## 开发注意事项

### 数据库连接
- 数据库文件：`chouann_novel.db`（存储在 Tauri 应用数据目录）
- 连接字符串：`sqlite:chouann_novel.db`
- 迁移在 `src-tauri/src/lib.rs` 中定义

### 路径别名
```typescript
import { something } from '@/lib/utils'  // -> src/lib/utils
```

### 添加 shadcn 组件
```bash
npx shadcn@latest add <component-name>
```

### 类型定义
所有类型定义在 `src/types/index.ts`，包括：
- `Project`, `Workflow`, `WorkflowNode`
- `NodeType`, `NodeConfig` 及各节点配置类型
- `Setting`, `SettingPrompt`, `GlobalConfig`
- `Execution`, `NodeResult`

### 主题切换
主题通过在 `<html>` 元素上添加 `light` 或 `dark` class 实现，CSS 变量在 `src/index.css` 中定义。

### Toast 通知
```typescript
import { toast } from 'sonner'
toast.success('操作成功')
toast.error('操作失败')
```

---

## 待开发功能清单

### Phase 4: 执行引擎
- [ ] `src/lib/engine/executor.ts` - 执行引擎核心
- [ ] `src/lib/engine/context.ts` - 执行上下文
- [ ] `src/stores/execution-store.ts` - 执行状态管理
- [ ] 暂停/继续/终止控制逻辑

### Phase 7: 变量系统
- [ ] `src/lib/utils/interpolate.ts` - 变量插值解析（`{{变量名}}`）

### Phase 8: 设定库
- [ ] `src/pages/SettingsLibraryPage.tsx` - 设定库页面
- [ ] `src/components/settings/` - 设定库相关组件
