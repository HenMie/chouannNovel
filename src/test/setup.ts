// 测试全局设置文件
import "@testing-library/jest-dom"
import { afterEach, beforeAll, afterAll, vi } from "vitest"

// ========== Mock @/lib/db ==========
// 全局 mock 数据库模块，确保所有测试文件（包括 zustand store）都使用 mock
vi.mock("@/lib/db", () => ({
  // 项目操作
  getProjects: vi.fn().mockResolvedValue([]),
  getProject: vi.fn().mockResolvedValue(null),
  createProject: vi.fn().mockResolvedValue({ id: "mock-id", name: "Mock Project" }),
  updateProject: vi.fn().mockResolvedValue(undefined),
  deleteProject: vi.fn().mockResolvedValue(undefined),
  
  // 工作流操作
  getWorkflows: vi.fn().mockResolvedValue([]),
  getWorkflow: vi.fn().mockResolvedValue(null),
  createWorkflow: vi.fn().mockResolvedValue({ id: "mock-id", name: "Mock Workflow" }),
  updateWorkflow: vi.fn().mockResolvedValue(undefined),
  deleteWorkflow: vi.fn().mockResolvedValue(undefined),
  
  // 节点操作
  getNodes: vi.fn().mockResolvedValue([]),
  getNode: vi.fn().mockResolvedValue(null),
  createNode: vi.fn().mockResolvedValue({ id: "mock-id", name: "Mock Node" }),
  updateNode: vi.fn().mockResolvedValue(undefined),
  deleteNode: vi.fn().mockResolvedValue(undefined),
  reorderNodes: vi.fn().mockResolvedValue(undefined),
  restoreNodes: vi.fn().mockResolvedValue([]),
  
  // 设定库操作
  getSettings: vi.fn().mockResolvedValue([]),
  createSetting: vi.fn().mockResolvedValue({ id: "mock-id" }),
  updateSetting: vi.fn().mockResolvedValue(undefined),
  deleteSetting: vi.fn().mockResolvedValue(undefined),
  
  // 设定提示词操作
  getSettingPrompts: vi.fn().mockResolvedValue([]),
  getSettingPrompt: vi.fn().mockResolvedValue(null),
  createSettingPrompt: vi.fn().mockResolvedValue({ id: "mock-id" }),
  updateSettingPrompt: vi.fn().mockResolvedValue(undefined),
  deleteSettingPrompt: vi.fn().mockResolvedValue(undefined),
  upsertSettingPrompt: vi.fn().mockResolvedValue({ id: "mock-id" }),
  
  // 全局配置
  getGlobalConfig: vi.fn().mockResolvedValue({
    id: 1,
    ai_providers: {
      openai: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
      gemini: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
      claude: { api_key: "", enabled: false, enabled_models: [], custom_models: [] },
    },
    theme: "system",
    default_loop_max: 10,
    default_timeout: 300,
  }),
  updateGlobalConfig: vi.fn().mockResolvedValue(undefined),
  
  // 执行记录
  getExecutions: vi.fn().mockResolvedValue([]),
  createExecution: vi.fn().mockResolvedValue({ id: "mock-id", status: "running" }),
  updateExecution: vi.fn().mockResolvedValue(undefined),
  deleteExecution: vi.fn().mockResolvedValue(undefined),
  
  // 节点结果
  getNodeResults: vi.fn().mockResolvedValue([]),
  createNodeResult: vi.fn().mockResolvedValue({ id: "mock-id", status: "running" }),
  updateNodeResult: vi.fn().mockResolvedValue(undefined),
  
  // 统计
  getGlobalStats: vi.fn().mockResolvedValue({ active_projects: 0, today_word_count: 0 }),
  getProjectStats: vi.fn().mockResolvedValue({ character_count: 0, worldview_count: 0, workflow_count: 0, total_word_count: 0 }),
  
  // 导入导出
  exportWorkflow: vi.fn().mockResolvedValue(null),
  importWorkflow: vi.fn().mockResolvedValue({ id: "mock-id" }),
  exportSettings: vi.fn().mockResolvedValue({ settings: [], setting_prompts: [] }),
  importSettings: vi.fn().mockResolvedValue(undefined),
  exportProject: vi.fn().mockResolvedValue(null),
  importProject: vi.fn().mockResolvedValue({ id: "mock-id" }),
  
  // 版本历史
  getWorkflowVersions: vi.fn().mockResolvedValue([]),
  getWorkflowVersion: vi.fn().mockResolvedValue(null),
  createWorkflowVersion: vi.fn().mockResolvedValue({ id: "mock-id" }),
  restoreWorkflowVersion: vi.fn().mockResolvedValue(undefined),
  deleteWorkflowVersion: vi.fn().mockResolvedValue(undefined),
  cleanupOldVersions: vi.fn().mockResolvedValue(undefined),
  
  // 工具函数
  generateId: vi.fn(() => "mock-uuid-" + Math.random().toString(36).substr(2, 9)),
  getDatabase: vi.fn().mockResolvedValue({ select: vi.fn(), execute: vi.fn() }),
}))

// ========== Mock Tauri API ==========
vi.mock("@tauri-apps/api", () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((src) => src),
}))

vi.mock("@tauri-apps/plugin-sql", () => ({
  default: {
    load: vi.fn(),
  },
}))

vi.mock("@tauri-apps/plugin-http", () => ({
  fetch: vi.fn(),
}))

vi.mock("@tauri-apps/plugin-opener", () => ({
  open: vi.fn(),
}))

// ========== Mock crypto API ==========
// Node.js 环境中模拟浏览器的 crypto.randomUUID
if (typeof globalThis.crypto === "undefined") {
  Object.defineProperty(globalThis, "crypto", {
    value: {
      randomUUID: () => {
        // 生成符合 UUID v4 格式的字符串
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0
          const v = c === "x" ? r : (r & 0x3) | 0x8
          return v.toString(16)
        })
      },
    },
    writable: true,
    configurable: true,
  })
}

// ========== Mock matchMedia ==========
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// ========== Mock ResizeObserver ==========
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
global.ResizeObserver = MockResizeObserver as any

// ========== Mock IntersectionObserver ==========
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// ========== Mock PointerCapture API ==========
// Radix UI 需要这些 API
if (typeof Element.prototype.hasPointerCapture === "undefined") {
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false)
  Element.prototype.setPointerCapture = vi.fn()
  Element.prototype.releasePointerCapture = vi.fn()
}

// ========== Mock scrollIntoView ==========
// JSDOM 不支持 scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

// ========== Mock document.execCommand ==========
// contenteditable 编辑器需要这个 API
document.execCommand = vi.fn().mockReturnValue(true)

// ========== 测试生命周期 ==========
beforeAll(() => {
  // 全局测试前的设置
})

afterEach(() => {
  // 每个测试后清理
  vi.clearAllMocks()
})

afterAll(() => {
  // 所有测试后的清理
})

