[根目录](../CLAUDE.md) > **src** (前端应用)

# 前端应用模块 (src/)

> 最后更新: 2026-02-12 04:07:00

## 模块职责

前端 React SPA 应用, 提供 ChouannNovel 的全部用户界面: 项目管理、工作流可视化编辑、AI 节点配置、执行监控（流式输出）、设定库管理（层级树形结构）、全局设置（AI 连接测试+模型管理）等。运行在 Tauri WebView 中, 同时支持纯 Web 浏览器降级运行。

## 入口与启动

| 文件 | 说明 |
|------|------|
| `src/main.tsx` | React 应用入口, 挂载 `<App />` 到 `#root` |
| `src/App.tsx` | 根组件, 初始化主题/禁用右键菜单, 渲染 `MainLayout` |
| `src/components/layout/MainLayout.tsx` | 主布局 (~230行), 自定义路由 (基于 state + regex), 侧边栏自动隐藏 (项目页面), F1 快捷键打开帮助 |

### 路由结构 (MainLayout 内部 state 路由)

| 路径模式 | 页面 | 文件 |
|----------|------|------|
| `/` | 首页 | `pages/HomePage.tsx` |
| `/project/:id` | 项目详情 | `pages/ProjectPage.tsx` |
| `/project/:id/edit` | 编辑项目 | `pages/EditProjectPage.tsx` |
| `/project/:id/workflow/:wid` | 工作流编辑 | `pages/WorkflowPage.tsx` |
| `/project/:id/workflow/new` | 新建工作流 | `pages/NewWorkflowPage.tsx` |
| `/project/:id/workflow/:wid/edit` | 编辑工作流 | `pages/EditWorkflowPage.tsx` |
| `/project/:id/workflow/:wid/history` | 执行历史 | `pages/ExecutionHistoryPage.tsx` |
| `/project/:id/settings` | 项目设定库 | `pages/SettingsLibraryPage.tsx` |
| `/settings` | 全局设置 (AI 配置) | `pages/SettingsPage.tsx` |
| `/project/new` | 新建项目 | `pages/NewProjectPage.tsx` |

### 页面组件详情

| 页面 | Props | 核心功能 | 复杂度 |
|------|-------|----------|--------|
| `HomePage` | `onNavigate` | 项目列表仪表盘 | 中 |
| `ProjectPage` | `projectId, onNavigate` | 项目详情, 工作流列表 | 中 |
| `WorkflowPage` | `projectId, workflowId, onNavigate` | 工作流编辑器 (节点树+配置+执行输出) | 高 |
| `SettingsPage` | `onNavigate` | AI 提供商配置 (API Key/Base URL/连接测试/模型管理), 通用设置 (主题/执行参数), ~878行 | 高 |
| `SettingsLibraryPage` | `projectId, onNavigate, initialTab?` | 设定库管理 (三栏布局: 导航树+设定列表/树+详情面板), ~1650行 | 高 |
| `ExecutionHistoryPage` | `projectId, workflowId, workflowName, onNavigate` | 执行记录列表和详情查看 | 中 |
| `NewProjectPage` | `onNavigate` | 创建项目表单 (名称+描述) | 低 |
| `EditProjectPage` | `projectId, onNavigate` | 编辑项目表单, 加载已有数据 | 低 |
| `NewWorkflowPage` | `projectId, onNavigate` | 创建工作流表单 | 低 |
| `EditWorkflowPage` | `projectId, workflowId, onNavigate` | 编辑工作流表单, 支持从 DB 或 Store 获取数据, Skeleton 加载态 | 低 |

## 对外接口

前端不直接暴露 API, 通过以下方式与外部交互:

1. **Tauri SQL Plugin**: 通过 `@tauri-apps/plugin-sql` 访问 SQLite 数据库
2. **Tauri FS Plugin**: 通过 `@tauri-apps/plugin-fs` 读写本地文件 (导入/导出)
3. **Tauri Dialog Plugin**: 通过 `@tauri-apps/plugin-dialog` 打开文件选择对话框
4. **Tauri HTTP Plugin**: 通过 `@tauri-apps/plugin-http` 发送 HTTP 请求 (AI API 调用, 绕过 CORS)
5. **AI API**: 通过 Vercel AI SDK 调用 OpenAI / Google / Anthropic API

## 关键依赖与配置

### 路径别名

- `@/*` -> `./src/*` (在 `tsconfig.json` 和 `vite.config.ts` 中配置)

### 状态管理 (Zustand Stores)

| Store | 文件 | 职责 |
|-------|------|------|
| `useProjectStore` | `stores/project-store.ts` | 项目/工作流/节点 CRUD, 复制粘贴, 拖拽排序 |
| `useExecutionStore` | `stores/execution-store.ts` | 工作流执行生命周期, 流式输出, 暂停/取消 |
| `useSettingsStore` | `stores/settings-store.ts` | 设定库 CRUD, 筛选/排序, 设定提示词, **层级树构建** |
| `useThemeStore` | `stores/theme-store.ts` | 主题切换 (light/dark/system) |
| `useTourStore` | `stores/tour-store.ts` | 新手引导教程状态 (模块化, 支持完成/重置) |

#### Settings Store 层级能力

- `getSettingTree(category)`: 根据 `parent_id` 构建递归树结构 (`SettingTreeNode[]`), 按 `order_index` 排序
- `addSetting(category, name, content, parentId?)`: 支持指定父设定, 自动计算同级 `order_index`
- `editSetting(id, { parent_id })`: 支持修改父设定 (移动层级)
- `removeSetting(id)`: 级联删除所有子设定
- `batchToggleSettings(ids, enabled)` / `batchRemoveSettings(ids)`: 批量操作
- 导出类型: `SettingTreeNode`, `SettingFilterStatus`, `SettingSortBy`, `SettingSortOrder`

### AI 服务层 (`lib/ai/`)

- `types.ts`: AI 消息、请求/响应类型、Thinking 配置
- `index.ts` (~624行): 统一入口; `chat()` (非流式), `chatStream()` (流式回调), `chatStreamIterable()` (流式生成器); 内置模型列表 `BUILTIN_MODELS`; 提供商工厂 `createModel()`

**CORS 解决方案**: 通过 `getCustomFetch()` 在 Tauri 环境下动态加载 `@tauri-apps/plugin-http` 的 fetch, 传入各 SDK 的 `fetch` 参数, 绕过 WebView 的 CORS 限制。Web 环境自动降级为原生 fetch。

**流式错误捕获**: `chatStream()` 和 `chatStreamIterable()` 通过 `streamText()` 的 `onError` 回调捕获错误, 在流结束后检查并重新抛出。这修复了 Vercel AI SDK 默认仅 `console.error` 而不抛出异常的行为。

**连接测试**: `testProviderConnection()` 支持用户指定测试模型, 包含友好的中文错误信息解析 (`parseConnectionError`)。在 `SettingsPage` 中, 每个提供商卡片提供测试按钮和模型选择下拉框, 测试结果返回延迟信息。

**Base URL 智能补全**: `normalizeBaseUrl()` 根据提供商自动补全 API 路径后缀 (openai: `/v1`, gemini: `/v1beta`, claude: `/v1`)。

支持的内置模型:
- Gemini 3 Pro Preview (thinkingLevel), Gemini 2.5 Pro (thinkingBudget), Gemini 2.5 Flash (thinkingBudget, 可禁用)
- GPT-5.1, GPT-5, GPT-5 Mini
- Claude Opus 4.5 (effort), Claude Sonnet 4.5 (effort), Claude Haiku 4.5

### Markdown 解析工具 (`lib/markdown-headings.ts`)

- `parseContentToSections(content)`: 将 Markdown 文本按标题层级 (`# ~ ######`) 解析为树形 `ContentSection[]` 结构
- `extractHeadings(sections)`: 从树中扁平化提取所有标题 (用于 TOC)
- 用于 `SettingsLibraryPage` 右侧详情面板中设定内容的可折叠树形展示

### 执行引擎 (`lib/engine/`)

- `context.ts`: `ExecutionContext` 类 -- 管理变量、节点输出、对话历史、循环计数、超时检查; 支持 `{{变量}}` 和 `{{@nodeId}}` 插值
- `executor.ts`: `WorkflowExecutor` 类 -- 按顺序执行节点, 支持暂停/恢复/取消, 事件驱动 (EventListener), 设定注入, 块结构跳转

### 数据库层 (`lib/db/`)

- `types.ts`: `SqlClient` 接口 (select/execute)
- `index.ts`: 所有数据库 CRUD 方法, 双环境适配 (Tauri SQL + web-sqlite), 写队列串行化; `createSetting` 现在支持 `parentId` 和 `orderIndex` 参数; `updateSetting` 支持更新 `parent_id` 和 `order_index`
- `web-sqlite.ts`: 纯 Web 环境降级方案, 使用 sql.js (WASM) 实现

## 组件详情

### SettingsPage.tsx (全局设置页面, ~878行)

两栏布局架构:

```
+-------------------+-----------------------------------------------+
| 左侧: 导航        | 右侧: 配置内容                                 |
| (w-64, border-r)  | (flex-1, 最大宽度 3xl)                         |
| - AI 服务 Tab     | AI: 提供商卡片 (Gemini/OpenAI/Claude)          |
| - 通用设置 Tab    | 通用: 主题选择器 + 执行参数 + 版本信息          |
+-------------------+-----------------------------------------------+
```

**AI 服务配置**:
- 每个提供商一个 Card, 包含: API Key (密码输入+复制), Base URL (带默认值提示), 启用/禁用开关
- **连接测试**: 每个提供商提供测试按钮 + 模型选择下拉框 (内置模型+已启用自定义模型), 测试时显示 spinner, 成功返回延迟 ms, 失败显示友好中文错误
- **模型管理** (可折叠区域): 内置模型列表 (Switch 启用/禁用), 自定义模型 CRUD (ID+名称表单, Switch 启用/禁用, 删除按钮), Badge 显示已启用模型数

**通用设置**:
- 主题选择器: 3 列卡片 (浅色/深色/跟随系统), 点击切换
- 执行设置: 默认循环上限 (1-100), 默认超时时间 (30-3600秒)
- 版本信息: 通过 `@tauri-apps/api/app` 获取版本号

### SettingsLibraryPage.tsx (设定库页面, ~1650行)

三栏布局架构:

```
+-------------------+---------------------+------------------+
| 左侧: 标题导航    | 中间: 设定列表/树    | 右侧: 详情面板    |
| (w-44, sticky)    | (flex-1)             | (w-80, sticky)   |
| NavTreeItem 递归   | SettingTreeItem 递归 | SettingContentTree|
| 或 NavItem 扁平    | 或 VirtualSettingsList| 可折叠标题树     |
+-------------------+---------------------+------------------+
```

**两种展示模式**:
- **默认(树形)模式**: 无搜索/筛选时, 左侧和中间都以树形结构展示 (基于 `getSettingTree()`)
- **搜索/筛选(扁平)模式**: 搜索或筛选时, 切换为扁平列表 (基于 `getFilteredAndSortedSettings()`)

**关键内部组件**:

| 组件 | 用途 |
|------|------|
| `SettingTreeItem` | 递归渲染设定树节点, 含折叠/展开、右键菜单、添加子设定、启用/禁用开关 |
| `NavTreeItem` / `NavItem` | 左侧导航树递归组件 / 扁平导航项 |
| `SettingContentTree` / `ContentTreeNode` | 右侧详情面板: 将设定内容按 Markdown 标题解析为可折叠树形展示 |
| `VirtualSettingsList` | 扁平列表模式下的虚拟滚动列表 (@tanstack/react-virtual), 设定 <20 时直接渲染 |
| `SettingCard` / `SettingCardVirtual` | 设定卡片 (含动画版/无动画版) |

**功能特性**:
- 4 个分类 Tab (角色/世界观/笔触风格/大纲)
- 批量选择模式 (Checkbox + Shift 范围选 + Ctrl+A 全选)
- 批量操作 (启用/禁用/删除)
- 筛选 (全部/已启用/已禁用) + 排序 (名称/创建时间/更新时间, 升/降序)
- 添加子设定 (通过父设定选择器, 防循环引用检查)
- Sheet 抽屉编辑 (含 Markdown 工具栏: 粗体/斜体/列表/代码/引用)
- 注入提示词模板编辑 (含变量快速插入和预览)
- 右键菜单 (编辑/添加子设定/启用-禁用/删除)
- 快捷键 (Ctrl+A 全选, Delete 删除, Escape 退出选择)

### 布局组件 (`components/layout/`)

| 组件 | 行数 | 职责 |
|------|------|------|
| `MainLayout` | ~230 | 自定义路由系统: currentPath state + regex 匹配, 渲染 Sidebar + 页面; **项目页面侧边栏自动隐藏**: `isProjectPage` 判断 `/project/*` 路径时隐藏侧边栏, 左侧 2px 热区触发 overlay 显示, 200ms 延迟隐藏防止误触, 路由变化自动关闭 overlay; 管理 F1 快捷键 + ShortcutsDialog, 延迟加载工作流名称 |
| `Sidebar` | 480 | 项目树视图: 搜索过滤, 展开/折叠/全展开/全折叠, 项目+工作流右键菜单(编辑/删除), CreateProjectDialog + CreateWorkflowDialog, Tour 引导入口, F1 键盘提示 |
| `Header` | ~70 | **面包屑导航** (Breadcrumb 组件), 接受 `breadcrumbs` prop (含 label + href) 替代简单 title, 支持 `onNavigate` 回调点击导航; 也向后兼容 `title` prop |
| `AppErrorBoundary` | 85 | Class Component 错误边界, 捕获渲染异常, 显示友好错误页(重试/刷新), 使用 `logError` 记录 |
| `GlobalErrorListener` | 32 | 监听 `unhandledrejection` 和全局 `error` 事件, 调用 `handleUnexpectedError` 统一处理 |

### 节点组件 (`components/node/`)

#### WorkflowNodeTree.tsx (1361行)

最复杂的 UI 组件, 负责工作流节点的可视化列表渲染和交互:

- **拖拽排序**: 使用 dnd-kit (DndContext + SortableContext + DragOverlay), 支持键盘传感器
- **块结构**: `calculateNodeLevels()` 计算每个节点的嵌套层级, 渲染缩进线 (颜色按块类型区分: 粉色=循环, 靛蓝=并发, 黄色=条件)
- **折叠/展开**: 块开始节点可折叠, 隐藏内部节点直到对应的块结束节点
- **多选**: 支持 Ctrl+Click 切换选择、Shift+Click 范围选择、全选/清除, 批量复制/删除
- **右键菜单**: ContextMenu 提供配置/复制/粘贴/选中/删除操作
- **节点描述**: `getNodeDescription()` 为每种节点类型生成友好的配置摘要, 支持 `{{变量}}` 引用的友好显示
- **变量引用格式化**: `formatVariableReferences()` 将 `{{@nodeId}}` 转为 `{{节点名 > 描述}}`
- **节点类型配置**: `nodeTypeConfig` 记录 16 种节点类型的标签/图标/颜色/块属性
- 导出: `WorkflowNodeTree` 组件 + `nodeTypeConfig` 常量

#### NodeConfigDrawer.tsx (600行)

统一的节点配置侧边栏 (Sheet 弹出面板):

- 根据 `node.type` 路由到对应的配置表单组件 (switch-case)
- 支持 16 种节点类型, 其中 9 种有独立的 Config 组件, 5 种(loop_end/parallel_end/condition_else/condition_end 及 unknown)使用内联提示
- `start` 节点: 默认值配置 + 自定义全局变量(增删改)
- `output` 节点: 输出格式选择 (纯文本/Markdown)
- `var_update` 节点: 变量选择 + PromptInputField 值输入 (手动/变量模式)
- 快捷键: Ctrl+S 保存, Escape 关闭
- 加载全局配置 (AI 模型列表) 供 AIChatConfig 和 ConditionConfig 使用

#### 节点配置面板 (`configs/`)

| 组件 | 文件 | 行数 | 核心功能 |
|------|------|------|----------|
| `AIChatConfigForm` | AIChatConfig.tsx | ~500 | 模型选择(按提供商分组), 系统/用户提示词(PromptEditor), 温度/Token/TopP 滑块, 对话历史, 设定注入 |
| `TextExtractConfigForm` | TextExtractConfig.tsx | ~250 | 4种提取模式(正则/起止标记/JSON路径/MD转文本), PromptInputField 输入源 |
| `TextConcatConfigForm` | TextConcatConfig.tsx | ~300 | 动态来源列表(增删), 分隔符配置(换行/双换行/无/自定义), 旧格式数据迁移 |
| `ConditionConfigForm` | ConditionConfig.tsx | 412 | 4种条件类型(关键词/长度/正则/AI判断), true/false 动作路由(next/jump/end), 跳转目标选择 |
| `ConditionIfConfigForm` | ConditionIfConfig.tsx | ~350 | 同上4种条件但无动作路由(使用结构化if/else/endif块), 含帮助 Tooltip |
| `LoopConfigForm` | LoopConfig.tsx | ~250 | 两种循环(count/condition), 条件子类型(keyword/length/regex), 最大迭代1-100 |
| `LoopStartConfigForm` | LoopStartConfig.tsx | ~350 | 同上但使用 Slider(1-50), 条件子类型含 ai_judge, Badge 代码提示(for/while) |
| `ParallelConfigForm` | ParallelConfig.tsx | ~120 | 并发数 Slider(1-10), 输出模式(array/concat), 可选分隔符 |
| `BatchConfigForm` | BatchConfig.tsx | 304 | 分割模式(行/分隔符/JSON数组), 并发数(1-10), 目标节点多选, 输出模式+分隔符 |

### 执行组件 (`components/execution/`)

#### StreamingOutput.tsx (605行)

包含 4 个导出组件:

1. **`StreamingOutput`**: 流式输出显示, 自动滚动, Markdown 渲染(lazy-load), 复制按钮, 流式光标(` `)
2. **`NodeOutputPanel`**: 单个节点输出面板, 支持编辑模式(暂停时人工干预), 可折叠的解析配置详情(ResolvedConfigDisplay), 运行状态指示
3. **`ResolvedConfigDisplay`**: 显示节点执行时的实际配置(提供商/模型/温度/提示词/提取模式/条件类型/拼接来源等)
4. **`ExecutionOutputPanel`**: 汇总所有节点输出 + 最终输出面板

#### WorkflowGuide.tsx (259行)

包含 2 个导出组件:

1. **`WorkflowGuide`**: 空闲时的操作指引, 显示快捷键列表(运行/暂停/停止/撤销/复制/粘贴)、AI 配置提示(未配置时警告)、操作小提示
2. **`CollapsedOutputIndicator`**: 输出面板折叠时的迷你状态指示器, 竖排显示执行状态(就绪/执行中/已暂停/完成/失败/已取消/超时)

### 帮助组件 (`components/help/`)

| 组件 | 行数 | 职责 |
|------|------|------|
| `ShortcutsDialog` | 167 | 上下文感知的快捷键帮助弹窗(Dialog), 根据当前路径显示对应作用域的快捷键, 自动去重, 支持 F1 触发 |
| `Tour` | 253 | Tour 主组件: 整合 Spotlight + Tooltip, 自动开始(首次访问), 步骤导航(上/下/跳过/完成), Escape 关闭; 导出 `useTour` 便捷 Hook |
| `TourSpotlight` | 136 | 遮罩层: SVG 路径实现圆角矩形镂空, createPortal 渲染, 支持目标元素交互透传 |
| `TourTooltip` | 400 | 步骤提示气泡: 自动定位(top/bottom/left/right, 空间不足自动翻转), 箭头偏移计算, 进度指示器, 导航按钮 |

### 弹窗组件 (`components/dialogs/`)

| 组件 | 行数 | 职责 |
|------|------|------|
| `CreateProjectDialog` | 132 | Dialog 形式的创建项目表单, 关闭时自动重置表单, 用于 Sidebar 快捷创建 |
| `CreateWorkflowDialog` | 146 | Dialog 形式的创建工作流表单, 自动确保 currentProject 已设置, 用于 Sidebar 快捷创建 |
| `index.ts` | 3 | 导出桶文件 |

## 数据模型

核心 TypeScript 类型定义在 `src/types/index.ts`, 包括:

- `Project`, `Workflow`, `WorkflowNode`
- `NodeType` (16 种节点类型, 含 3 种旧版兼容)
- `NodeConfig` 联合类型 (AIChatConfig, ConditionConfig, ConditionIfConfig, LoopConfig, LoopStartConfig, ParallelStartConfig, BatchConfig, TextExtractConfig, TextConcatConfig, VarUpdateConfig, StartConfig, CustomVariable 等)
- `Setting` (含 `parent_id: string | null` 和 `order_index: number`), `SettingPrompt`, `GlobalConfig`
- `Execution`, `NodeResult`, `WorkflowVersion`
- 导入/导出类型 (`ExportedWorkflow`, `ExportedSettings`, `ExportedProject`)

## 测试与质量

### 单元测试文件

**组件测试** (`components/ui/__tests__/`):
- button.test.tsx, dialog.test.tsx, input.test.tsx, tabs.test.tsx
- empty-state.test.tsx, select.test.tsx
- prompt-editor.test.tsx, variable-picker.test.tsx

**节点组件测试** (`components/node/__tests__/`):
- NodeConfigDrawer.test.tsx

**引擎测试** (`lib/engine/__tests__/`):
- context.test.ts (覆盖率要求 >90%)
- executor.test.ts

**工具测试** (`lib/__tests__/`):
- utils.test.ts, import-export.test.ts, errors.test.ts, shortcuts.test.ts
- markdown-headings.test.ts (测试 Markdown 标题树解析)

**AI 服务测试** (`lib/ai/__tests__/`):
- index.test.ts

**DB 测试** (`lib/db/__tests__/`):
- index.test.ts

**Hooks 测试** (`lib/hooks/__tests__/`):
- use-node-selection.test.ts, use-workflow-history.test.ts, use-run-button-state.test.ts

**Store 测试** (`stores/__tests__/`):
- project-store.test.ts, settings-store.test.ts
- execution-store.test.ts, theme-store.test.ts, tour-store.test.ts

### E2E 测试 (`e2e/`)

| 文件 | 行数 | 覆盖范围 |
|------|------|----------|
| `project.spec.ts` | 282 | 项目 CRUD: 创建(名称+描述), 编辑(修改名称), 删除(确认弹窗), 导航, 列表排序 |
| `workflow.spec.ts` | 361 | 工作流编辑: 添加各类节点(output/ai_chat/text_concat/extract/variable/loop/condition), 配置, 删除, helper函数(addNode/ensureNode/nodeLocator), nodeTypeMapping 子菜单导航 |
| `execution.spec.ts` | 359 | 执行流程: 运行/暂停/恢复/取消, 执行历史查看, 输出面板交互, Ctrl+Enter/Escape 快捷键, 输入弹窗处理 |
| `fixtures/test-data.ts` | ~80 | 测试基础设施: selectors(data-testid), generateUniqueName(), toastLocator(), waitForAnyVisible() |

### Mock 系统 (`test/mocks/`)

- `tauri.ts`: 模拟 Tauri API (SQL, Dialog, FS 等)
- `ai.ts`: 模拟 AI SDK 调用
- `db.ts`: 模拟数据库操作

## 常见问题 (FAQ)

**Q: 为什么不使用 react-router?**
A: 应用使用 `MainLayout` 内部的 state 路由 (`currentPath`), 通过字符串匹配和 `navigate` 回调实现页面切换, 避免了 Tauri WebView 中浏览器路由的兼容性问题。

**Q: 数据库在哪里?**
A: Tauri 环境下使用原生 SQLite 插件 (`tauri-plugin-sql`), 数据库文件为 `chouann_novel.db`; 纯 Web 环境使用 sql.js (内存数据库)。

**Q: 如何添加新的节点类型?**
A: 1) 在 `types/index.ts` 添加 `NodeType` 和对应的 Config 接口; 2) 在 `engine/executor.ts` 的 `executeNode` switch 中添加处理逻辑; 3) 在 `components/node/configs/` 中创建配置面板组件; 4) 在 `components/node/NodeConfigDrawer.tsx` 中注册; 5) 在 `components/node/WorkflowNodeTree.tsx` 的 `nodeTypeConfig` 和 `getNodeDescription()` 中添加展示逻辑。

**Q: 新旧节点类型有什么区别?**
A: 旧版 `condition`/`loop`/`batch` 是独立节点, 通过配置中的 action 字段(next/jump/end)控制流程。新版 `condition_if`/`loop_start`/`parallel_start` 使用结构化块(通过 `block_id` 关联开始/结束节点), 支持嵌套, 在 `WorkflowNodeTree` 中以缩进线显示层级关系。

**Q: 页面组件和弹窗组件有什么区别?**
A: 页面组件 (如 `NewProjectPage`) 是全屏路由页面, 从侧边栏或菜单导航进入; 弹窗组件 (如 `CreateProjectDialog`) 是 Dialog 弹窗, 由 `Sidebar` 调用, 用于快捷创建而不离开当前页面。两者内部逻辑相似, 都调用 Store 的 create 方法。

**Q: AI API 请求为什么使用 Tauri 的 fetch?**
A: WebView 中的原生 fetch 会受到 CORS 限制, 无法直接调用外部 AI API。通过 `@tauri-apps/plugin-http` 提供的 fetch 在 Rust 层发起请求, 绕过浏览器 CORS 策略。Web 环境降级时仍使用原生 fetch。

**Q: 为什么流式调用需要 onError 回调?**
A: Vercel AI SDK 的 `streamText()` 在流式过程中遇到错误时, 默认只会 `console.error` 而不抛出异常。通过 `onError` 回调捕获错误, 在流结束后手动 throw, 确保上层代码能正确处理错误。

**Q: 侧边栏在项目页面为什么会自动隐藏?**
A: 为了给工作流编辑器等复杂页面提供更大的可视空间。在 `/project/*` 路径下, 侧边栏隐藏, 鼠标贴近左边缘 2px 热区时以 overlay 形式滑出, 200ms 延迟隐藏防止误触。

**Q: 如何添加新的 AI 提供商?**
A: 1) 在 `types/index.ts` 的 `AIProvider` 联合类型中添加新值; 2) 在 `lib/ai/index.ts` 的 `createModel()` switch 中添加 SDK 创建逻辑, 在 `BUILTIN_MODELS` 中添加内置模型, 在 `DEFAULT_TEST_MODELS` 和 `PROVIDER_URL_SUFFIXES` 中添加配置; 3) 在 `pages/SettingsPage.tsx` 的 `aiProviders` 数组中添加提供商卡片配置。

## 相关文件清单

```
src/
  main.tsx                          # 应用入口
  App.tsx                           # 根组件
  index.css                         # 全局样式 (Tailwind)
  vite-env.d.ts                     # Vite 类型声明
  types/
    index.ts                        # 全局类型定义 (核心, 含 Setting.parent_id)
    assets.d.ts, tauri.d.ts, sql-js.d.ts
  pages/                            # 11 个页面文件
    index.ts                        # 导出桶 (8个, EditProject/EditWorkflow 未在桶中)
    HomePage.tsx                    # 首页仪表盘
    ProjectPage.tsx                 # 项目详情
    WorkflowPage.tsx                # 工作流编辑器 (最复杂页面)
    SettingsPage.tsx                # 全局设置 (~878行, 连接测试+模型管理)
    SettingsLibraryPage.tsx         # 设定库管理 (~1650行, 三栏布局+层级树)
    ExecutionHistoryPage.tsx        # 执行历史
    NewProjectPage.tsx              # 新建项目表单
    EditProjectPage.tsx             # 编辑项目表单
    NewWorkflowPage.tsx             # 新建工作流表单
    EditWorkflowPage.tsx            # 编辑工作流表单
  components/
    layout/                         # 布局 (5个)
      MainLayout.tsx                # 自定义路由 + 侧边栏自动隐藏 + F1
      Sidebar.tsx                   # 项目树 + 搜索 + 快捷创建
      Header.tsx                    # 面包屑导航 (Breadcrumb)
      AppErrorBoundary.tsx          # 渲染错误边界
      GlobalErrorListener.tsx       # 全局异常监听
    ui/                             # 28+ shadcn + 5 自定义
      button.tsx, card.tsx, input.tsx, dialog.tsx, select.tsx, tabs.tsx...
      prompt-editor.tsx             # 提示词编辑器 (支持变量插入)
      prompt-input-field.tsx        # 双模式输入 (手动/变量引用)
      variable-picker.tsx           # 变量选择器 (弹出面板)
      variable-picker-content.tsx   # 变量选择器内容
      variable-picker-shared.ts     # 变量选择共享逻辑 (getNodeOutputVariables)
      variable-select.tsx           # 变量下拉选择
      virtual-list.tsx              # 虚拟滚动列表
      lazy-image.tsx                # 懒加载图片
      markdown-renderer.tsx         # Markdown 渲染器
      empty-state.tsx               # 空状态占位
      context-menu.tsx              # 右键菜单
      breadcrumb.tsx                # 面包屑
      typography.tsx                # 排版组件
    node/                           # 节点 (2 + 9 configs + 1 test)
      WorkflowNodeTree.tsx          # 可视化节点列表 (1361行)
      NodeConfigDrawer.tsx          # 统一配置抽屉 (600行)
      configs/
        AIChatConfig.tsx            # AI 对话配置
        TextExtractConfig.tsx       # 文本提取配置
        TextConcatConfig.tsx        # 文本拼接配置
        ConditionConfig.tsx         # 条件判断配置 (旧版)
        ConditionIfConfig.tsx       # 条件分支配置 (新版)
        LoopConfig.tsx              # 循环配置 (旧版)
        LoopStartConfig.tsx         # 循环开始配置 (新版)
        ParallelConfig.tsx          # 并发配置
        BatchConfig.tsx             # 批量执行配置
    execution/                      # 执行面板 (2个文件, 多个导出)
      StreamingOutput.tsx           # 流式输出 + 节点输出 + 执行输出面板
      WorkflowGuide.tsx             # 操作指引 + 折叠指示器
    help/                           # 帮助 (4个)
      ShortcutsDialog.tsx           # 快捷键弹窗
      Tour.tsx                      # Tour 主组件 + useTour Hook
      TourSpotlight.tsx             # 遮罩层 (SVG 镂空)
      TourTooltip.tsx               # 步骤气泡 (自动定位)
    dialogs/                        # 弹窗 (3个)
      CreateProjectDialog.tsx       # 创建项目弹窗
      CreateWorkflowDialog.tsx      # 创建工作流弹窗
      index.ts                      # 导出桶
  stores/                           # 5 个 Zustand Store
  lib/
    ai/                             # AI 服务统一入口 (含 CORS 绕过, 连接测试, Base URL 智能补全)
    db/                             # 数据库 CRUD + 双端适配
    engine/                         # 执行引擎 (Context + Executor)
    hooks/                          # 自定义 React Hooks
    markdown-headings.ts            # Markdown 标题树解析
    utils.ts                        # 工具函数 (cn, 格式化, useDebouncedValue 等)
    errors.ts                       # 统一错误处理
    shortcuts.ts                    # 快捷键定义与分组
    import-export.ts                # 导入/导出工具
  tours/                            # 引导教程步骤定义
    index.ts                        # 导出桶
    home-tour.ts                    # 首页引导
    workflow-tour.ts                # 工作流引导
    ai-config-tour.ts              # AI 配置引导
    settings-tour.ts               # 设置引导
  test/                             # 测试 setup + Mock
```

## 变更记录 (Changelog)

| 时间 | 操作 | 说明 |
|------|------|------|
| 2026-02-12 04:07:00 | 增量更新 | 新增 SettingsPage 详细文档 (~878行, 连接测试+模型管理 UI), 复杂度从"中"升级为"高"; 新增 FAQ "如何添加新的 AI 提供商"; 更新文件清单中 SettingsPage 行数标注 |
| 2026-02-10 08:44:42 | 增量更新 | SettingsLibraryPage 三栏布局+层级树改造, MainLayout 侧边栏自动隐藏, AI 服务层 Tauri HTTP CORS 修复+流式错误捕获, 新增 markdown-headings.ts, Header 面包屑导航, Settings Store 层级能力, DB 层 createSetting/updateSetting 支持 parent_id |
| 2026-02-10 04:45:56 | 增量深度扫描 | 补扫全部页面组件(10)、全部节点配置面板(9)、布局组件(5)、执行组件(2)、帮助组件(4)、弹窗组件(3)、E2E测试(4); 新增组件详情/页面详情/交互模式/FAQ |
| 2026-02-10 04:45:56 | 初始化 | 首次生成模块文档 |
