# 自动化测试计划 (Test Plan)

基于项目技术栈和代码结构分析，以下是自动化测试的后续优化计划。

---

## 1. 当前测试状态概览

### 测试运行结果

| 指标 | 状态 |
|-----|------|
| 测试文件 | **15 个全部通过** |
| 测试用例 | **506 个全部通过** |
| 框架 | Vitest + React Testing Library |
| E2E | Playwright (已配置) |

### 测试文件清单

```text
src/
├── lib/
│   ├── __tests__/utils.test.ts              # 37 tests ✅
│   └── engine/__tests__/
│       ├── context.test.ts                   # 41 tests ✅
│       └── executor.test.ts                  # 54 tests ✅
├── stores/__tests__/
│   ├── project-store.test.ts                 # 83 tests ✅
│   ├── settings-store.test.ts                # 25 tests ✅
│   └── execution-store.test.ts               # 42 tests ✅
├── components/
│   ├── ui/__tests__/
│   │   ├── button.test.tsx                   # 27 tests ✅
│   │   ├── input.test.tsx                    # 27 tests ✅
│   │   ├── select.test.tsx                   # 16 tests ✅
│   │   ├── dialog.test.tsx                   # 18 tests ✅
│   │   ├── tabs.test.tsx                     # 23 tests ✅
│   │   ├── empty-state.test.tsx              # 22 tests ✅
│   │   ├── prompt-editor.test.tsx            # 35 tests ✅
│   │   └── variable-picker.test.tsx          # 19 tests ✅
│   └── node/__tests__/
│       └── NodeConfigDrawer.test.tsx         # 37 tests ✅
└── test/                                      # 测试基础设施 ✅
    ├── setup.ts
    └── mocks/
        ├── tauri.ts
        ├── db.ts
        └── ai.ts

e2e/                                           # E2E 测试 ✅
├── project.spec.ts                            # 10 用例
├── workflow.spec.ts                           # 16 用例
├── execution.spec.ts                          # 15 用例
└── fixtures/test-data.ts
```

---

## 2. 覆盖率现状与目标

| 模块 | 目标 | 当前 | 状态 | 待补充 |
|------|------|------|------|--------|
| `lib/utils.ts` | 90%+ | **100%** | ✅ | - |
| `lib/engine/context.ts` | 80%+ | **100%** | ✅ | - |
| `lib/engine/executor.ts` | 80%+ | **73.77%** | ⚠️ | 设定注入、对话历史 |
| `stores/settings-store.ts` | 70%+ | **92%** | ✅ | - |
| `stores/project-store.ts` | 70%+ | **95.54%** | ✅ | - |
| `stores/execution-store.ts` | 70%+ | **98.91%** | ✅ | - |

### 未测试模块（暂不优先）

| 模块 | 覆盖率 | 原因 |
|------|--------|------|
| `lib/import-export.ts` | 0% | 文件系统操作，需 Tauri 环境 |
| `lib/db/index.ts` | 0% | 数据库操作，已 Mock |
| `lib/ai/index.ts` | 7% | AI 服务，已 Mock |
| `theme-store.ts` | 0% | 简单状态，优先级低 |

---

## 3. 后续优化计划

### Phase 1: 提升核心模块覆盖率 (P0) ✅ 已完成

#### 3.1 `lib/utils.ts` 补充测试 ✅

| 函数 | 待补充用例 | 状态 |
|------|----------|------|
| `debounce` | 延迟执行、合并调用、cancel 取消 | ✅ 已有 |
| `throttle` | 立即执行、时间限制、尾调用 | ✅ 已有 |
| `useDebouncedValue` | 值延迟更新、依赖变化、卸载清理 | ✅ 已补充 |
| `useDebouncedCallback` | 回调延迟、清理、多参数支持 | ✅ 已补充 |
| `useThrottledCallback` | 回调节流、清理、尾调用处理 | ✅ 已补充 |

#### 3.2 `lib/engine/executor.ts` 补充测试 ✅

| 功能 | 待补充用例 | 状态 |
|------|----------|------|
| AI 节点 | Mock AI 响应、流式输出、错误处理、变量插值 | ✅ 已补充 |
| 错误恢复 | 节点失败后恢复、超时重试、取消执行 | ✅ 已补充 |
| 并行执行 | parallel_start/end 节点执行、空块处理 | ✅ 已补充 |
| 条件块 | condition_if/else/end 分支执行 | ✅ 已补充 |
| 执行控制 | 修改节点输出、获取上下文 | ✅ 已补充 |

### Phase 2: 提升 Store 覆盖率 (P1) ✅

#### 3.3 `stores/project-store.ts` 补充测试

| 功能 | 待补充用例 | 状态 |
|------|----------|------|
| 复制粘贴 | 复制单节点、复制多节点、粘贴到不同位置 | [x] |
| 批量操作 | 批量删除节点、批量更新 | [x] |
| 错误处理 | 数据库操作失败恢复 | [x] |

#### 3.4 `stores/execution-store.ts` 补充测试

| 功能 | 待补充用例 | 状态 |
|------|----------|------|
| 执行事件处理 | node_started/streaming/completed/failed/skipped 事件 | [x] |
| 执行状态事件 | paused/resumed/completed/failed/cancelled/timeout 事件 | [x] |
| 数据库错误处理 | 创建/更新节点结果失败时的错误处理 | [x] |

### Phase 3: 测试质量改进 (P2) ✅

#### 3.5 修复 act() 警告

以下测试文件存在 React `act()` 警告，已修复：

| 文件 | 问题数量 | 状态 |
|------|---------|------|
| `tabs.test.tsx` | 4 | [x] |
| `NodeConfigDrawer.test.tsx` | 20+ | [x] |

修复方案：

- 在 `setup.ts` 中添加全局 `@/lib/db` mock，确保所有模块都使用 mock
- 使用 `userEvent.click()` 替代 `element.focus()` 处理键盘导航测试
- 使用 `findByRole` 等异步查询替代 `getByRole` 配合 `waitFor`
- 创建 `renderAndWait` 辅助函数等待组件异步操作完成

### Phase 4: E2E 测试执行验证 (P2) ✅

| 任务 | 描述 | 状态 |
|------|------|------|
| 本地验证 | 在 Tauri 开发环境运行 E2E 测试 | [x] |
| CI 配置 | 配置 GitHub Actions 运行 E2E | [x] |

#### 4.1 本地验证结果

- **测试框架**: Playwright + Chromium
- **端口**: 1420 (Tauri dev server)
- **配置**: 单线程串行执行 (`workers: 1, fullyParallel: false`)

测试结果摘要：

- Web SQLite 兼容层上线后，纯浏览器模式具备与 Tauri 一致的数据库能力
- 引入 WAL + busy_timeout + 写入队列后，涉及数据库操作的案例稳定通过

#### 4.2 CI 配置说明

已创建以下 GitHub Actions 工作流：

| 文件 | 触发条件 | 内容 |
|------|---------|------|
| `.github/workflows/ci.yml` | PR/Push to main | 单元测试 + 类型检查 + Tauri 构建验证 |
| `.github/workflows/e2e.yml` | 手动触发 | E2E 测试（需要完整 Tauri 环境） |

**CI 运行说明**：

```bash
# 自动运行（PR/Push）
- 单元测试 (Vitest)
- 类型检查 (TypeScript)
- 前端构建验证 (Vite)
- Tauri 构建验证 (仅 main 分支 push)

# 手动运行
- E2E 测试（通过 workflow_dispatch 触发）
```

---

### 4.3 浏览器模式数据库兼容与写入优化

- 基于 `sql.js` 构建 Web SQLite 驱动，非 Tauri 环境自动回退至 WebAssembly 版数据库，Playwright 可以直接在 Vite 提供的页面执行端到端用例
- 数据库初始化阶段统一下发 `PRAGMA journal_mode=WAL / synchronous=NORMAL / foreign_keys=ON / busy_timeout=5000`
- 前端封装写入队列，所有 `execute` 操作串行执行，彻底消除 “database is locked” 之类的并发写冲突

---

## 4. 测试命令参考

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

## 5. 优先级说明

| 优先级 | 描述 | 范围 | 状态 |
|--------|------|------|------|
| P0 | 立即执行 | `utils.ts`、`executor.ts` 覆盖率提升 | ✅ 已完成 |
| P1 | 近期完成 | Store 覆盖率提升 | ✅ 已完成 |
| P2 | 中期完成 | act() 警告修复 | ✅ 已完成 |
| P2 | 中期完成 | E2E 验证 + CI 配置 | ✅ 已完成 |

---

最后更新: 2025-12-03 (Phase 4 完成)
