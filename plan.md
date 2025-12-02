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

### Phase 4: 执行引擎 (P0) ✅
- [x] 基础执行引擎
- [x] 执行状态管理
- [x] 暂停/继续/终止

### Phase 5: 流程控制节点 (P1) ✅
- [x] 条件判断节点
- [x] 循环节点
- [ ] 批量并发执行节点

### Phase 6: 文本处理节点 (P1) ✅
- [x] 内容提取节点
- [x] 文本拼接节点

### Phase 7: 变量系统 (P1) ✅
- [x] 变量设置/读取节点执行逻辑
- [x] 变量插值解析（`{{变量名}}`）
- [x] 对话历史上下文

### Phase 8: 设定库 (P1) ✅
- [x] 设定库 CRUD
- [x] 设定分类管理
- [x] 注入提示词配置
- [x] AI 节点引用设定

### Phase 9: 历史与导出 (P2)
- [ ] 执行历史记录
- [ ] 历史回溯查看
- [ ] 导出 TXT/Markdown

### Phase 10: 人工干预 (P2)
- [x] 暂停时编辑节点输出（executor.modifyNodeOutput 已实现）
- [ ] UI 层人工干预编辑器组件

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

### 条件判断节点 (condition) ✅
```typescript
interface ConditionConfig {
  input_source: 'previous' | 'variable';
  input_variable?: string;
  
  condition_type: 'keyword' | 'length' | 'regex' | 'ai_judge';
  
  // 关键词匹配
  keywords?: string[];
  keyword_mode?: 'any' | 'all' | 'none';
  
  // 长度判断
  length_operator?: '>' | '<' | '=' | '>=' | '<=';
  length_value?: number;
  
  // 正则匹配
  regex_pattern?: string;
  
  // AI 智能判断
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

### 文本提取节点 (text_extract) ✅
```typescript
interface TextExtractConfig {
  input_source: 'previous' | 'variable';
  input_variable?: string;
  extract_mode: 'regex' | 'start_end' | 'json_path';
  regex_pattern?: string;    // 正则模式：支持捕获组
  start_marker?: string;     // 起止模式：起始标记
  end_marker?: string;       // 起止模式：结束标记
  json_path?: string;        // JSON路径：如 data.items[0].title
}
```

### 文本拼接节点 (text_concat) ✅
```typescript
interface TextConcatConfig {
  sources: Array<{
    type: 'previous' | 'variable' | 'custom';
    variable?: string;
    custom?: string;         // 支持 {{变量}} 插值
  }>;
  separator: string;         // 拼接分隔符
}
```

### 循环节点 (loop) ✅
```typescript
interface LoopConfig {
  max_iterations: number;              // 最大迭代次数
  condition_type: 'count' | 'condition';
  condition?: ConditionConfig;         // 条件循环时的判断配置
}
```

### 批量并发执行节点 (batch) - 待实现
```typescript
interface BatchConfig {
  input_source: 'previous' | 'variable';
  input_variable?: string;
  split_mode: 'line' | 'separator' | 'json_array';
  separator?: string;
  target_nodes: string[];              // 节点ID列表
  concurrency: number;                 // 最大并发数
  output_mode: 'array' | 'concat';
  output_separator?: string;
}
```

---

## 设定库注入机制 ✅

每个设定分类可配置注入提示词模板（支持 Handlebars 语法）：

```handlebars
【角色设定】
{{#each items}}
{{name}}：{{content}}
{{/each}}
```

**实现位置**：`src/lib/engine/executor.ts` 中的 `generateSettingsInjection()` 方法

**注入流程**：
1. AI 节点配置中通过 `setting_ids` 选择要引用的设定
2. 执行时从 `settings` 和 `settingPrompts` 获取内容
3. 按分类渲染模板，拼接到提示词开头
4. 只注入 `enabled: true` 的设定

**模板变量**：
- `{{#each items}}...{{/each}}` - 遍历该分类下所有已启用设定
- `{{name}}` - 设定名称
- `{{content}}` - 设定内容
- `{{items}}` - 简单替换为 `名称：内容` 格式的列表

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
│   │   ├── NodeConfigDrawer.tsx  # 节点配置抽屉（接收 nodes 用于跳转选择）
│   │   └── configs/
│   │       ├── AIChatConfig.tsx      # AI 对话节点配置
│   │       ├── TextExtractConfig.tsx # 文本提取节点配置
│   │       ├── TextConcatConfig.tsx  # 文本拼接节点配置
│   │       ├── ConditionConfig.tsx   # 条件判断节点配置
│   │       └── LoopConfig.tsx        # 循环节点配置
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
│   ├── engine/                   # 执行引擎模块
│   │   ├── index.ts              # 模块入口
│   │   ├── context.ts            # 执行上下文
│   │   └── executor.ts           # 执行引擎核心
│   ├── db/index.ts               # 数据库操作模块
│   └── utils.ts                  # 工具函数 (cn)
│
├── pages/                        # 页面组件
│   ├── index.ts                  # 导出所有页面
│   ├── HomePage.tsx              # 首页/项目列表
│   ├── ProjectPage.tsx           # 项目详情页
│   ├── WorkflowPage.tsx          # 工作流编辑页
│   ├── SettingsPage.tsx          # 全局设置页
│   ├── SettingsLibraryPage.tsx   # 设定库页面
│   ├── NewProjectPage.tsx        # 新建项目页
│   └── NewWorkflowPage.tsx       # 新建工作流页
│
├── stores/                       # Zustand 状态管理
│   ├── theme-store.ts            # 主题状态
│   ├── project-store.ts          # 项目/工作流/节点状态
│   ├── execution-store.ts        # 执行状态管理
│   └── settings-store.ts         # 设定库状态管理
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

// 设定库操作
getSettings(projectId)                           // 获取项目所有设定
createSetting(projectId, category, name, content) // 创建设定
updateSetting(id, { name?, content?, enabled? }) // 更新设定
deleteSetting(id)                                // 删除设定

// 设定注入提示词
getSettingPrompts(projectId)                     // 获取项目所有提示词模板
upsertSettingPrompt(projectId, category, template) // 创建/更新提示词模板

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

**设定库状态 (`settings-store.ts`)**
```typescript
const {
  settings,                     // 设定列表
  settingPrompts,               // 设定注入提示词列表
  loadSettings,                 // 加载项目设定
  addSetting,                   // 添加设定
  editSetting,                  // 编辑设定
  removeSetting,                // 删除设定
  toggleSetting,                // 切换设定启用状态
  saveSettingPrompt,            // 保存注入提示词模板
  getSettingsByCategory,        // 按分类获取设定
  getEnabledSettings,           // 获取已启用设定
} = useSettingsStore()
```

### 4. 路由机制

使用简易路由（在 `MainLayout.tsx` 中实现）：

```typescript
'/'                                    -> HomePage
'/settings'                            -> SettingsPage
'/project/new'                         -> NewProjectPage
'/project/:id'                         -> ProjectPage
'/project/:id/settings'                -> SettingsLibraryPage  // 设定库
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

### 6. 执行引擎 (`src/lib/engine/`)

工作流执行引擎，支持顺序执行节点、暂停/继续/取消、流式输出。

```typescript
import { WorkflowExecutor, ExecutionContext } from '@/lib/engine'
import { useExecutionStore } from '@/stores/execution-store'

// 使用执行状态 Store
const {
  status,              // 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled' | 'timeout'
  nodeOutputs,         // 各节点输出列表
  finalOutput,         // 最终输出
  streamingContent,    // 当前流式内容
  startExecution,      // 开始执行
  pauseExecution,      // 暂停
  resumeExecution,     // 继续
  cancelExecution,     // 取消
} = useExecutionStore()

// 开始执行工作流（含设定注入）
await startExecution(workflow, nodes, globalConfig, initialInput, settings, settingPrompts)
```

**已支持的节点类型**：
- `input` - 输入节点（获取初始输入或默认值）
- `output` - 输出节点（返回上一节点输出）
- `ai_chat` - AI 对话节点（流式输出）
- `var_set` - 变量设置节点
- `var_get` - 变量读取节点
- `text_extract` - 文本提取节点（正则/起止标记/JSON路径）
- `text_concat` - 文本拼接节点（多来源拼接，支持变量插值）
- `condition` - 条件判断节点（关键词/长度/正则/AI判断，支持跳转/结束）
- `loop` - 循环节点（固定次数/条件循环）

**执行上下文功能**：
- 变量存储：`ctx.setVariable(name, value)` / `ctx.getVariable(name)`
- 变量插值：`ctx.interpolate('{{变量名}}')`，支持 `{{input}}`、`{{previous}}`
- 对话历史：`ctx.addToHistory(nodeId, message)` / `ctx.getHistory(nodeId, limit)`
- 循环控制：`ctx.incrementLoopCount(nodeId)` / `ctx.isLoopLimitReached(nodeId)`
- 超时检查：`ctx.isTimeout()`

**流程控制机制**：
- `shouldEnd` - 条件节点可触发工作流结束
- `jumpTarget` - 条件节点可跳转到指定节点
- `loopStartNode/loopStartIndex` - 循环节点控制流程回跳

**执行事件类型**：
```typescript
type ExecutionEventType =
  | 'execution_started' | 'execution_paused' | 'execution_resumed'
  | 'execution_completed' | 'execution_failed' | 'execution_cancelled' | 'execution_timeout'
  | 'node_started' | 'node_streaming' | 'node_completed' | 'node_failed' | 'node_skipped'
```

### 7. 设定库 (`src/stores/settings-store.ts`)

设定库用于管理小说创作的核心设定，支持 4 个分类：角色、世界观、笔触风格、大纲。

**分类常量**：
```typescript
type SettingCategory = 'character' | 'worldview' | 'style' | 'outline'
```

**设定注入机制**：
- 每个分类可配置注入提示词模板，支持 Handlebars 语法
- AI 节点通过 `setting_ids` 引用设定
- 执行时由 `executor.generateSettingsInjection()` 自动注入到提示词开头

**默认注入模板示例**：
```handlebars
【角色设定】
{{#each items}}
{{name}}：{{content}}
{{/each}}
```

**使用流程**：
1. 进入项目 → 点击"设定库"按钮 → 管理设定
2. 在 AI 节点配置中选择要引用的设定（Badge 多选）
3. 执行工作流时设定自动注入

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

### 批量并发执行节点 (batch) - Phase 5 遗留
- [ ] `src/components/node/configs/BatchConfig.tsx` - 批量执行节点配置表单
- [ ] `src/lib/engine/executor.ts` 中添加 `batch` 节点执行逻辑
- [ ] 实现并发控制和输出汇总

### 历史与导出 (Phase 9)
- [ ] 执行历史记录保存到数据库（使用 `executions` 和 `node_results` 表）
- [ ] 历史回溯查看页面
- [ ] 导出 TXT/Markdown 功能

### 人工干预编辑器 (Phase 10)
- [ ] UI 层人工干预编辑器组件（暂停时可编辑节点输出，底层 `executor.modifyNodeOutput` 已实现）

### 优化 (Phase 11)
- [ ] 提示词编辑器（变量高亮，如 `{{变量名}}`）
- [ ] 快捷键支持
- [ ] 节点复制/粘贴
