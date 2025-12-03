# 自动化测试计划 (Test Plan)

基于项目技术栈和代码结构分析，以下是自动化测试的实施计划。

---

## 1. 测试架构 (Test Architecture)

### 测试金字塔

```
                    ┌─────────────┐
                    │   E2E 测试   │  ← Playwright (少量关键流程)
                    └─────────────┘
               ┌─────────────────────┐
               │     组件测试        │  ← Vitest + React Testing Library
               └─────────────────────┘
        ┌────────────────────────────────┐
        │          单元测试               │  ← Vitest (核心覆盖)
        └────────────────────────────────┘
```

### 目录结构（分散式布局）

```
chouannNovel/
├── src/
│   ├── lib/
│   │   ├── __tests__/                    # 工具函数测试
│   │   │   └── utils.test.ts
│   │   └── engine/
│   │       ├── __tests__/                # 执行引擎测试
│   │       │   ├── context.test.ts
│   │       │   └── executor.test.ts
│   │       └── ...
│   ├── stores/
│   │   ├── __tests__/                    # Store 测试
│   │   │   ├── project-store.test.ts
│   │   │   ├── settings-store.test.ts
│   │   │   └── execution-store.test.ts
│   │   └── ...
│   ├── components/
│   │   ├── ui/
│   │   │   ├── __tests__/                # UI 组件测试
│   │   │   │   ├── button.test.tsx
│   │   │   │   ├── input.test.tsx
│   │   │   │   └── ...
│   │   │   └── ...
│   │   └── node/
│   │       ├── __tests__/                # 节点组件测试
│   │       │   └── ...
│   │       └── ...
│   └── test/                             # 测试基础设施
│       ├── setup.ts                      # 全局 setup
│       ├── mocks/                        # Mock 文件
│       │   ├── tauri.ts                  # Tauri API Mock
│       │   ├── db.ts                     # 数据库 Mock
│       │   └── ai.ts                     # AI 服务 Mock
│       └── utils/                        # 测试辅助函数
│           └── render.tsx                # 自定义 render
├── e2e/                                  # E2E 测试（集中放置）
│   ├── project.spec.ts                   # 项目管理流程
│   ├── workflow.spec.ts                  # 工作流编辑流程
│   ├── execution.spec.ts                 # 执行流程
│   └── fixtures/                         # 测试数据
│       └── ...
├── vitest.config.ts                      # Vitest 配置
└── playwright.config.ts                  # Playwright 配置
```

---

## 2. 测试工具选型 (Test Tools)

| 工具 | 用途 | 选择理由 |
|------|------|----------|
| **Vitest** | 单元测试 + 组件测试 | 与 Vite 原生集成、速度快、兼容 Jest API |
| **React Testing Library** | React 组件测试 | 官方推荐、关注用户行为而非实现细节 |
| **Playwright** | E2E 测试 | 支持 Tauri 应用测试、跨平台、稳定 |
| **MSW** | API/AI Mock | 拦截网络请求、不侵入代码 |

### 依赖安装

```bash
# 单元测试 + 组件测试
npm install -D vitest @vitest/ui @vitest/coverage-v8 jsdom
npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event

# E2E 测试
npm install -D @playwright/test

# Mock 工具
npm install -D msw
```

---

## 3. 单元测试计划 (Unit Tests)

### 3.1 工具函数 `src/lib/utils.ts`

| 函数 | 测试用例 | 状态 |
|------|----------|------|
| `cn` | 类名合并、条件类名、Tailwind 冲突处理 | [ ] |
| `debounce` | 延迟执行、合并调用、cancel 取消 | [ ] |
| `throttle` | 立即执行、时间限制、尾调用 | [ ] |
| `useDebouncedValue` | 值延迟更新、依赖变化 | [ ] |
| `useDebouncedCallback` | 回调延迟、清理 | [ ] |
| `useThrottledCallback` | 回调节流、清理 | [ ] |

### 3.2 执行上下文 `src/lib/engine/context.ts`

| 功能模块 | 测试用例 | 状态 |
|----------|----------|------|
| 变量操作 | 设置/获取变量、初始输入处理 | [ ] |
| 变量插值 | `{{变量名}}` 替换、节点输出优先、未定义变量处理 | [ ] |
| 对话历史 | 添加/获取/清空历史、limit 限制 | [ ] |
| 循环控制 | 计数增加/重置、循环限制检测 | [ ] |
| 超时检测 | 超时判断、已用时间计算 | [ ] |
| 快照恢复 | 创建快照、从快照恢复 | [ ] |

### 3.3 工作流执行器 `src/lib/engine/executor.ts`

| 功能模块 | 测试用例 | 状态 |
|----------|----------|------|
| 执行控制 | 启动执行、暂停/继续、取消执行 | [ ] |
| 节点执行 | Start 节点、Output 节点、VarSet/VarGet 节点 | [ ] |
| 文本处理 | TextExtract（正则/标记/JSON）、TextConcat | [ ] |
| 条件分支 | 关键词判断、长度判断、正则判断 | [ ] |
| 循环执行 | 固定次数循环、条件循环、循环限制 | [ ] |
| 错误处理 | 节点执行失败、超时处理 | [ ] |

> ⚠️ AI 节点测试需要 Mock AI 服务响应

---

## 4. Store 测试计划 (Store Tests)

### 4.1 项目 Store `src/stores/project-store.ts`

| 功能 | 测试用例 | 状态 |
|------|----------|------|
| 项目操作 | 加载列表、创建、更新、删除 | [ ] |
| 工作流操作 | 加载列表、创建、更新、删除 | [ ] |
| 节点操作 | 加载、创建、更新、删除、重排序 | [ ] |
| 复制粘贴 | 复制节点、粘贴节点 | [ ] |
| 状态同步 | setCurrentProject 清空关联状态 | [ ] |

### 4.2 设置 Store `src/stores/settings-store.ts`

| 功能 | 测试用例 | 状态 |
|------|----------|------|
| 设定操作 | 加载、创建、更新、删除 | [ ] |
| 设定筛选 | 按分类筛选、搜索过滤 | [ ] |
| 提示词模板 | 加载、更新模板 | [ ] |

### 4.3 执行 Store `src/stores/execution-store.ts`

| 功能 | 测试用例 | 状态 |
|------|----------|------|
| 执行管理 | 启动执行、更新状态、完成/失败 | [ ] |
| 历史记录 | 加载历史、删除记录 | [ ] |

---

## 5. 组件测试计划 (Component Tests)

### 5.1 基础 UI 组件 `src/components/ui/`

| 组件 | 测试用例 | 状态 |
|------|----------|------|
| `Button` | 渲染、点击事件、禁用状态、variant | [x] |
| `Input` | 渲染、输入变化、placeholder、禁用 | [x] |
| `Select` | 渲染、选项选择、受控/非受控 | [x] |
| `Dialog` | 打开/关闭、内容渲染、确认/取消 | [x] |
| `Tabs` | 切换、内容渲染 | [x] |
| `EmptyState` | 不同状态展示 | [x] |

### 5.2 业务组件

| 组件 | 测试用例 | 状态 |
|------|----------|------|
| `VariablePicker` | 变量列表展示、选择变量、插入变量 | [x] |
| `PromptEditor` | 文本编辑、变量插入、提示词预览 | [x] |
| `NodeConfigDrawer` | 打开/关闭、配置表单渲染 | [x] |

---

## 6. E2E 测试计划 (E2E Tests)

### 6.1 项目管理流程

| 用例 | 描述 | 状态 |
|------|------|------|
| 创建项目 | 填写名称描述 → 创建成功 → 列表展示 | [ ] |
| 编辑项目 | 修改项目信息 → 保存成功 | [ ] |
| 删除项目 | 确认删除 → 项目移除 | [ ] |
| 项目导航 | 点击项目 → 进入项目详情 | [ ] |

### 6.2 工作流编辑流程

| 用例 | 描述 | 状态 |
|------|------|------|
| 创建工作流 | 新建工作流 → 进入编辑页 | [ ] |
| 添加节点 | 选择节点类型 → 添加到工作流 | [ ] |
| 配置节点 | 打开配置面板 → 修改配置 → 保存 | [ ] |
| 节点排序 | 拖拽节点 → 顺序更新 | [ ] |
| 删除节点 | 删除节点 → 确认 → 节点移除 | [ ] |

### 6.3 执行流程

| 用例 | 描述 | 状态 |
|------|------|------|
| 执行工作流 | 输入 → 开始执行 → 查看输出 | [ ] |
| 暂停/继续 | 执行中暂停 → 继续执行 | [ ] |
| 取消执行 | 执行中取消 → 状态更新 | [ ] |
| 查看历史 | 进入历史页 → 查看执行记录 | [ ] |

---

## 7. 实施计划 (Implementation Plan)

### 阶段一：基础搭建（P0）

- [x] 安装测试依赖
- [x] 配置 `vitest.config.ts`
- [x] 创建 `src/test/setup.ts` 全局配置
- [x] 创建 Tauri API Mock (`src/test/mocks/tauri.ts`)
- [x] 创建数据库 Mock (`src/test/mocks/db.ts`)
- [x] 配置 `package.json` 测试脚本

### 阶段二：核心单元测试（P0）

- [x] `lib/utils.ts` 工具函数测试
- [x] `lib/engine/context.ts` 执行上下文测试
- [x] `lib/engine/executor.ts` 执行器测试（需 AI Mock）

### 阶段三：Store 测试（P1）

- [x] `stores/project-store.ts` 测试
- [x] `stores/settings-store.ts` 测试
- [x] `stores/execution-store.ts` 测试

### 阶段四：组件测试（P2）

- [x] 基础 UI 组件测试
- [x] 业务组件测试

### 阶段五：E2E 测试（P2）

- [ ] 配置 Playwright
- [ ] 项目管理流程测试
- [ ] 工作流编辑流程测试
- [ ] 执行流程测试

---

## 8. 覆盖率目标 (Coverage Goals)

| 模块 | 目标覆盖率 | 当前覆盖率 |
|------|-----------|-----------|
| `lib/utils.ts` | 90%+ | 48% |
| `lib/engine/context.ts` | 80%+ | **100%** |
| `lib/engine/executor.ts` | 80%+ | 49% |
| `stores/` | 70%+ | ✅ 已覆盖 |
| `components/ui/` | 60%+ | ✅ 已覆盖 |
| `components/node/` | 60%+ | ✅ 已覆盖 |

---

## 9. 测试命令 (Test Commands)

```bash
# 运行所有单元测试
npm run test

# 运行测试并监听文件变化
npm run test:watch

# 运行测试并生成覆盖率报告
npm run test:coverage

# 打开测试 UI 界面
npm run test:ui

# 运行 E2E 测试
npm run test:e2e

# 打开 E2E 测试 UI
npm run test:e2e:ui
```

---

## 优先级说明

| 优先级 | 描述 | 范围 |
|--------|------|------|
| P0 | 核心功能测试，立即实施 | 测试基础设施、工具函数、执行引擎 |
| P1 | 重要模块测试，近期完成 | Store 测试 |
| P2 | 完善测试覆盖，中期完成 | 组件测试、E2E 测试 |

---

*最后更新: 2025-12-03*

