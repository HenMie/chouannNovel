# ChouannNovel

一款面向创作者的 AI 辅助写作工具，通过可视化工作流管理 AI 生成内容。

## 功能特性

### 核心功能
- **工作流编辑器**：可视化节点编辑，支持拖拽排序、批量操作
- **多 AI 平台支持**：OpenAI、Anthropic Claude、Google Gemini
- **设定库管理**：角色、世界观、情节等设定的集中管理
- **变量系统**：节点间数据传递，支持设定引用和上下文变量

### 编辑器功能
- 撤销/重做 (Ctrl+Z / Ctrl+Shift+Z)
- 批量选择 (Ctrl+点击 / Shift+点击)
- 节点复制粘贴，支持跨工作流
- 右键上下文菜单
- 快捷键支持 (按 F1 查看)

### 数据管理
- 工作流导入/导出 (JSON 格式)
- 项目完整备份与恢复
- 工作流版本历史与回滚
- 执行历史记录

## 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | [Tauri 2](https://tauri.app/) + [React 19](https://react.dev/) |
| 语言 | TypeScript + Rust |
| 构建 | Vite 7 |
| 样式 | TailwindCSS 4 + [shadcn/ui](https://ui.shadcn.com/) |
| 动画 | Framer Motion |
| 状态 | Zustand |
| 数据库 | sql.js (SQLite) |
| AI | Vercel AI SDK |
| 测试 | Vitest + Playwright |

## 开发环境

### 环境要求

- Node.js 20+
- Rust 1.70+
- 平台依赖：
  - **Windows**: Visual Studio C++ Build Tools
  - **macOS**: Xcode Command Line Tools
  - **Linux**: `libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev`

### 安装依赖

```bash
# 安装前端依赖
npm install

# Rust 依赖会在首次运行时自动安装
```

### 开发命令

```bash
# 启动开发服务器
npm run tauri dev

# 仅启动前端
npm run dev

# 类型检查
npx tsc --noEmit

# 运行单元测试
npm test

# 运行测试 (监听模式)
npm run test:watch

# 运行测试覆盖率
npm run test:coverage

# 运行 E2E 测试
npm run test:e2e
```

## 构建

### 本地构建

```bash
# 构建前端
npm run build

# 构建 Tauri 应用 (当前平台)
npm run tauri build

# 指定目标平台
npm run tauri build -- --target x86_64-pc-windows-msvc  # Windows
npm run tauri build -- --target aarch64-apple-darwin    # macOS ARM64
```

### 构建产物

| 平台 | 输出目录 | 格式 |
|------|----------|------|
| Windows | `src-tauri/target/release/bundle/nsis/` | `.exe` |
| macOS | `src-tauri/target/release/bundle/dmg/` | `.dmg` |

## 自动化发布

项目使用 GitHub Actions 自动化构建和发布：

### CI 流程
- 每次推送自动运行单元测试和构建验证

### Release 流程
推送 `v*.*.*` 格式的 Git Tag 时自动触发：

```bash
# 创建并推送版本标签
git tag v1.0.0
git push origin v1.0.0
```

自动执行：
1. 生成更新日志 (基于提交历史)
2. 并行构建 Windows x64 和 macOS ARM64 安装包
3. 创建 GitHub Release 并上传安装包

## 安装说明

### Windows
下载 `.exe` 安装包，双击运行即可安装。

### macOS (Apple Silicon)
下载 `.dmg` 安装包。

> ⚠️ **首次运行未签名应用**：如果提示"无法打开应用"，请在终端执行：
> ```bash
> sudo xattr -rd com.apple.quarantine /Applications/chouannnovel.app
> ```
> 或打开「系统偏好设置」→「安全性与隐私」→ 点击「仍要打开」。

## 项目结构

```
├── src/                    # 前端源码
│   ├── components/         # React 组件
│   │   ├── ui/            # 通用 UI 组件 (shadcn)
│   │   ├── node/          # 节点相关组件
│   │   ├── execution/     # 执行相关组件
│   │   └── layout/        # 布局组件
│   ├── pages/             # 页面组件
│   ├── stores/            # Zustand 状态管理
│   ├── lib/               # 工具库
│   │   ├── ai/            # AI 服务封装
│   │   ├── db/            # 数据库操作
│   │   ├── engine/        # 工作流执行引擎
│   │   └── hooks/         # 自定义 Hooks
│   └── types/             # TypeScript 类型定义
├── src-tauri/             # Tauri 后端 (Rust)
│   ├── src/               # Rust 源码
│   └── icons/             # 应用图标
├── e2e/                   # E2E 测试
└── scripts/               # 构建脚本
```
