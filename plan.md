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

## 目录结构

```
src/
├── app/                          # 页面路由
│   ├── layout.tsx
│   ├── page.tsx                  # 首页/项目列表
│   ├── settings/                 # 全局设置页
│   └── project/
│       └── [id]/
│           ├── page.tsx          # 项目详情
│           ├── settings/         # 设定库
│           └── workflow/
│               └── [wid]/
│                   ├── page.tsx  # 工作流编辑
│                   └── history/  # 执行历史
│
├── components/
│   ├── ui/                       # shadcn 组件
│   ├── layout/                   # 布局组件
│   ├── project/                  # 项目相关组件
│   ├── workflow/                 # 工作流相关组件
│   ├── node/                     # 节点相关组件
│   │   ├── NodeCard.tsx
│   │   ├── NodeConfigDrawer.tsx
│   │   └── configs/              # 各类型节点配置表单
│   ├── execution/                # 执行相关组件
│   └── settings/                 # 设定库组件
│
├── lib/
│   ├── db/                       # 数据库操作
│   ├── engine/                   # 执行引擎
│   │   ├── executor.ts
│   │   ├── context.ts
│   │   └── nodes/                # 各节点执行逻辑
│   ├── ai/                       # AI服务封装
│   │   └── providers/
│   └── utils/
│
├── stores/                       # Zustand 状态管理
├── hooks/                        # 自定义 Hooks
├── types/                        # TypeScript 类型
└── styles/
    └── globals.css
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

### Phase 3: AI节点 (P0) 🚧
- [x] 全局 API 配置页面
- [ ] AI 服务封装 (OpenAI/Gemini/Claude)
- [ ] AI 对话节点配置表单
- [ ] 流式输出显示

### Phase 4: 执行引擎 (P0)
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

## UI设计要点

1. **布局**: 三栏式布局 - 左侧项目树、中间工作流编辑、底部输出面板
2. **主题**: 支持浅色/深色/跟随系统，使用 CSS 变量实现
3. **动画**: 使用 Framer Motion 实现流畅的过渡动画
4. **响应式**: 支持窗口大小调整，面板可折叠
5. **流式输出**: 打字机效果显示 AI 输出

---

## E2E 测试要点

- 项目 CRUD 操作
- 工作流 CRUD 操作
- 节点添加/编辑/删除/排序
- 工作流执行（包含各类节点）
- 执行控制（暂停/继续/终止）
- 设定库管理
- 导出功能
- 主题切换

