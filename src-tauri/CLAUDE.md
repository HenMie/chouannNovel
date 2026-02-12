[根目录](../CLAUDE.md) > **src-tauri** (Tauri 后端)

# Tauri 后端模块 (src-tauri/)

> 最后更新: 2026-02-12 04:07:00

## 模块职责

Tauri 2 Rust 后端层, 负责:
1. 桌面应用窗口管理
2. SQLite 数据库初始化与迁移
3. 原生插件注册 (文件系统、HTTP、对话框、SQL)
4. 打包与分发 (Windows/macOS/Linux)

**注意**: 此模块逻辑非常精简, 绝大部分业务逻辑在前端 TypeScript 层完成。Rust 层主要作为"壳"提供原生能力。

## 入口与启动

| 文件 | 说明 |
|------|------|
| `src/main.rs` | 应用入口点, 调用 `chouannnovel_lib::run()` |
| `src/lib.rs` | 核心逻辑: Tauri Builder 配置、数据库迁移、插件注册 |
| `Cargo.toml` | Rust 依赖配置 |
| `tauri.conf.json` | Tauri 应用配置 (窗口、打包、安全) |

## 对外接口

### Tauri 命令 (invoke)

| 命令 | 参数 | 返回 | 说明 |
|------|------|------|------|
| `greet` | `name: &str` | `String` | 示例问候命令 (可能为开发遗留) |

### 注册的 Tauri 插件

| 插件 | 用途 |
|------|------|
| `tauri-plugin-opener` | 打开外部链接/文件 |
| `tauri-plugin-http` | HTTP 请求 (AI API 调用, 绕过 WebView CORS) |
| `tauri-plugin-dialog` | 文件选择/保存对话框 |
| `tauri-plugin-fs` | 文件系统读写 |
| `tauri-plugin-sql` | SQLite 数据库 (含迁移) |

## 关键依赖与配置

### Cargo.toml 依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| `tauri` | v2 | 桌面框架核心 |
| `tauri-plugin-opener` | v2 | 外部链接 |
| `tauri-plugin-http` | v2.5.4 | HTTP 客户端 (前端用于 AI API 绕过 CORS) |
| `tauri-plugin-dialog` | v2 | 系统对话框 |
| `tauri-plugin-fs` | v2 | 文件系统 |
| `tauri-plugin-sql` | v2.3.1 (sqlite) | SQLite 数据库 |
| `serde` | v1 (derive) | 序列化 |
| `serde_json` | v1 | JSON 处理 |

### tauri.conf.json 配置

- **产品名**: `chouannnovel`
- **版本**: `1.0.1`
- **标识符**: `com.chouann.chouannnovel`
- **窗口**: 1280x800 (最小 900x600), 居中显示
- **CSP**: 关闭 (null)
- **前端构建**: `npm run build` -> `../dist`
- **开发 URL**: `http://localhost:1420`

## 数据模型

### 数据库迁移

在 `lib.rs` 中定义了完整的数据库 schema:

#### Migration v1: 初始 Schema

包含 9 个表:

1. `projects` - 项目
2. `workflows` - 工作流
3. `nodes` - 工作流节点
4. `settings` - 设定库
5. `setting_prompts` - 设定注入提示词
6. `global_config` - 全局配置 (单行表)
7. `executions` - 执行记录
8. `node_results` - 节点执行结果
9. `workflow_versions` - 工作流版本历史

所有表均配有性能优化索引 (约 15 个)。

#### Migration v2: 设定库层级化

为 `settings` 表添加层级支持:

- `parent_id TEXT DEFAULT NULL` - 父设定 ID, 支持树形层级结构
- `order_index INTEGER DEFAULT 0` - 同级排序索引
- 新增索引 `idx_settings_parent_id` 优化父子查询

数据库文件: `sqlite:chouann_novel.db`

## 测试与质量

当前 Rust 后端无独立测试文件。逻辑极简, 主要由 Tauri 框架和插件提供功能保障。

## 常见问题 (FAQ)

**Q: 为什么 CSP 设为 null?**
A: 因为应用需要调用外部 AI API (OpenAI/Google/Anthropic), 设置严格的 CSP 会阻止这些请求。

**Q: 数据库迁移如何管理?**
A: 使用 `tauri-plugin-sql` 的 `Migration` 机制, 当前有 v1 (初始 schema) 和 v2 (设定库层级化) 两个迁移。新增迁移需要在 `lib.rs` 的 `migrations` Vec 中追加。

**Q: 如何添加新的 Tauri 命令?**
A: 在 `lib.rs` 中用 `#[tauri::command]` 宏定义函数, 然后在 `tauri::Builder` 的 `invoke_handler` 中注册。

**Q: plugin-http 的 fetch 是如何被前端使用的?**
A: 前端 AI 服务层 (`src/lib/ai/index.ts`) 通过 `import('@tauri-apps/plugin-http')` 动态加载插件的 fetch 函数, 传入 Vercel AI SDK 的 `fetch` 参数, 从而绕过 WebView 的 CORS 限制。

## 相关文件清单

```
src-tauri/
  src/
    main.rs                         # 应用入口
    lib.rs                          # Tauri Builder + 迁移 (v1 + v2) + 插件
  Cargo.toml                        # Rust 依赖
  tauri.conf.json                   # Tauri 配置
  icons/                            # 应用图标
  .gitignore                        # 忽略 target/ 和 gen/schemas
```

## 变更记录 (Changelog)

| 时间 | 操作 | 说明 |
|------|------|------|
| 2026-02-12 04:07:00 | 增量扫描 | 无代码变更, 仅同步时间戳 |
| 2026-02-10 08:44:42 | 增量更新 | 新增 Migration v2 (设定库层级化: parent_id + order_index), 更新 plugin-http 用途说明 |
| 2026-02-10 04:45:56 | 初始化 | 首次生成模块文档 |
