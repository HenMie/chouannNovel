# 自动化测试计划 (Test Plan)

基于项目技术栈和代码结构分析，以下是自动化测试的后续优化计划。

---

## 1. 当前测试状态概览

### 测试运行结果

| 指标 | 状态 |
|-----|------|
| 测试文件 | **15 个全部通过** |
| 测试用例 | **402 个全部通过** |
| 框架 | Vitest + React Testing Library |
| E2E | Playwright (已配置) |

### 测试文件清单

```
src/
├── lib/
│   ├── __tests__/utils.test.ts              # 19 tests ✅
│   └── engine/__tests__/
│       ├── context.test.ts                   # 41 tests ✅
│       └── executor.test.ts                  # 34 tests ✅
├── stores/__tests__/
│   ├── project-store.test.ts                 # 37 tests ✅
│   ├── settings-store.test.ts                # 25 tests ✅
│   └── execution-store.test.ts               # 22 tests ✅
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
| `lib/utils.ts` | 90%+ | 48% | ⚠️ | debounce/throttle hooks |
| `lib/engine/context.ts` | 80%+ | **100%** | ✅ | - |
| `lib/engine/executor.ts` | 80%+ | 49% | ⚠️ | AI 节点、错误恢复路径 |
| `stores/settings-store.ts` | 70%+ | **92%** | ✅ | - |
| `stores/project-store.ts` | 70%+ | 56% | ⚠️ | 复制粘贴、批量操作 |
| `stores/execution-store.ts` | 70%+ | 46% | ⚠️ | 历史记录管理 |

### 未测试模块（暂不优先）

| 模块 | 覆盖率 | 原因 |
|------|--------|------|
| `lib/import-export.ts` | 0% | 文件系统操作，需 Tauri 环境 |
| `lib/db/index.ts` | 0% | 数据库操作，已 Mock |
| `lib/ai/index.ts` | 7% | AI 服务，已 Mock |
| `theme-store.ts` | 0% | 简单状态，优先级低 |

---

## 3. 后续优化计划

### Phase 1: 提升核心模块覆盖率 (P0)

#### 3.1 `lib/utils.ts` 补充测试

| 函数 | 待补充用例 | 状态 |
|------|----------|------|
| `debounce` | 延迟执行、合并调用、cancel 取消 | [ ] |
| `throttle` | 立即执行、时间限制、尾调用 | [ ] |
| `useDebouncedValue` | 值延迟更新、依赖变化 | [ ] |
| `useDebouncedCallback` | 回调延迟、清理 | [ ] |
| `useThrottledCallback` | 回调节流、清理 | [ ] |

#### 3.2 `lib/engine/executor.ts` 补充测试

| 功能 | 待补充用例 | 状态 |
|------|----------|------|
| AI 节点 | Mock AI 响应、流式输出、错误处理 | [ ] |
| 错误恢复 | 节点失败后恢复、超时重试 | [ ] |
| 并行执行 | parallel_start/end 节点执行 | [ ] |

### Phase 2: 提升 Store 覆盖率 (P1)

#### 3.3 `stores/project-store.ts` 补充测试

| 功能 | 待补充用例 | 状态 |
|------|----------|------|
| 复制粘贴 | 复制单节点、复制多节点、粘贴到不同位置 | [ ] |
| 批量操作 | 批量删除节点、批量更新 | [ ] |
| 错误处理 | 数据库操作失败恢复 | [ ] |

#### 3.4 `stores/execution-store.ts` 补充测试

| 功能 | 待补充用例 | 状态 |
|------|----------|------|
| 历史管理 | 清空历史、导出历史、按时间筛选 | [ ] |
| 执行恢复 | 从历史恢复执行、重新执行 | [ ] |

### Phase 3: 测试质量改进 (P2)

#### 3.5 修复 act() 警告

以下测试文件存在 React `act()` 警告，需修复：

| 文件 | 问题数量 | 状态 |
|------|---------|------|
| `tabs.test.tsx` | 4 | [ ] |
| `NodeConfigDrawer.test.tsx` | 20+ | [ ] |

修复方案：使用 `waitFor` 或 `act()` 包裹异步状态更新

### Phase 4: E2E 测试执行验证 (P2)

| 任务 | 描述 | 状态 |
|------|------|------|
| 本地验证 | 在 Tauri 开发环境运行 E2E 测试 | [ ] |
| CI 配置 | 配置 GitHub Actions 运行 E2E | [ ] |

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

| 优先级 | 描述 | 范围 |
|--------|------|------|
| P0 | 立即执行 | `utils.ts`、`executor.ts` 覆盖率提升 |
| P1 | 近期完成 | Store 覆盖率提升 |
| P2 | 中期完成 | act() 警告修复、E2E 验证 |

---

*最后更新: 2025-12-03*
