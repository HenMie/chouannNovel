// 测试全局设置文件
import "@testing-library/jest-dom"
import { afterEach, beforeAll, afterAll, vi } from "vitest"

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

