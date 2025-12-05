// theme-store.ts 测试
// 覆盖主题切换、系统主题监听、持久化行为

import { describe, it, expect, beforeEach, vi } from "vitest"

// 重置 DOM 与模块，确保每个用例独立
function resetDom() {
  document.documentElement.className = ""
}

// 创建基础的 matchMedia mock
function createBaseMatchMedia() {
  return vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe("ThemeStore", () => {
  beforeEach(() => {
    vi.resetModules()
    localStorage.clear()
    resetDom()
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: createBaseMatchMedia(),
    })
  })

  // 按需导入 store，允许覆盖 matchMedia
  async function loadStore(matchMediaImpl?: (query: string) => MediaQueryList) {
    if (matchMediaImpl) {
      Object.defineProperty(window, "matchMedia", {
        writable: true,
        value: matchMediaImpl,
      })
    }
    return await import("../theme-store")
  }

  it("setTheme 应该更新状态并应用对应的 DOM 类名", async () => {
    const { useThemeStore } = await loadStore()

    useThemeStore.getState().setTheme("dark")

    expect(useThemeStore.getState().theme).toBe("dark")
    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(document.documentElement.classList.contains("light")).toBe(false)
  })

  it("system 主题应遵循系统偏好", async () => {
    let isDark = true
    const matchMediaMock = vi.fn().mockImplementation((query) => ({
      matches: isDark,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    const { useThemeStore } = await loadStore(matchMediaMock)

    useThemeStore.getState().setTheme("system")
    expect(document.documentElement.classList.contains("dark")).toBe(true)

    // 切换系统主题为浅色后再次应用
    isDark = false
    useThemeStore.getState().setTheme("system")
    expect(document.documentElement.classList.contains("light")).toBe(true)
  })

  it("在 system 模式下，系统主题变更应自动同步", async () => {
    let isDark = false
    const listeners: Array<(event: any) => void> = []
    const matchMediaMock = vi.fn().mockImplementation((query) => ({
      matches: isDark,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: (event: string, handler: (e: MediaQueryListEvent) => void) => {
        if (event === "change") {
          listeners.push(handler)
        }
      },
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    const { useThemeStore } = await loadStore(matchMediaMock)

    useThemeStore.getState().setTheme("system")
    expect(document.documentElement.classList.contains("light")).toBe(true)

    // 模拟系统切换为深色并触发监听回调
    isDark = true
    listeners.forEach((cb) => cb({ matches: true }))

    expect(document.documentElement.classList.contains("dark")).toBe(true)
    expect(useThemeStore.getState().theme).toBe("system")
  })
})


