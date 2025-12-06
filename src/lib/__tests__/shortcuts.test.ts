// lib/shortcuts.ts 快捷键配置测试
// 测试所有快捷键相关的工具函数

import { describe, it, expect } from "vitest"
import {
  getScopeFromPath,
  getShortcutsForPath,
  groupShortcuts,
  getGroupedShortcutsForPath,
  formatShortcutKeys,
  parseShortcutKeys,
  ALL_SHORTCUTS,
  SCOPE_LABELS,
  type ShortcutDefinition,
  type ShortcutScope,
} from "../shortcuts"

// ========== getScopeFromPath 测试 ==========

describe("getScopeFromPath - 根据路径获取 scope", () => {
  it("应该识别工作流页面路径", () => {
    expect(getScopeFromPath("/project/123/workflow/456")).toBe("workflow")
    expect(getScopeFromPath("/workflow/edit")).toBe("workflow")
    expect(getScopeFromPath("/some/workflow/path")).toBe("workflow")
  })

  it("应该识别设定库页面路径", () => {
    expect(getScopeFromPath("/settings-library")).toBe("settings")
    expect(getScopeFromPath("/project/123/settings-library")).toBe("settings")
    expect(getScopeFromPath("/settings-library/edit")).toBe("settings")
  })

  it("应该识别 AI 配置页面路径", () => {
    expect(getScopeFromPath("/settings")).toBe("ai_config")
  })

  it("应该识别首页路径", () => {
    expect(getScopeFromPath("/")).toBe("home")
    expect(getScopeFromPath("/project/new")).toBe("home")
    expect(getScopeFromPath("/project/123")).toBe("home")
  })

  it("应该对不匹配的路径返回 global", () => {
    expect(getScopeFromPath("/unknown")).toBe("global")
    expect(getScopeFromPath("/random/path")).toBe("global")
    expect(getScopeFromPath("")).toBe("global")
  })

  it("应该正确区分 /settings 和 /settings-library", () => {
    // /settings 是 AI 配置
    expect(getScopeFromPath("/settings")).toBe("ai_config")
    // /settings-library 是设定库
    expect(getScopeFromPath("/settings-library")).toBe("settings")
  })

  it("应该正确处理带有 workflow 的项目页面", () => {
    // /project/123/workflow/456 应该是 workflow
    expect(getScopeFromPath("/project/123/workflow/456")).toBe("workflow")
    // /project/123 (不带 workflow) 应该是 home
    expect(getScopeFromPath("/project/123")).toBe("home")
  })
})

// ========== getShortcutsForPath 测试 ==========

describe("getShortcutsForPath - 根据路径过滤快捷键", () => {
  it("应该始终包含全局快捷键", () => {
    const shortcuts = getShortcutsForPath("/")
    const globalShortcuts = shortcuts.filter(s => s.scope === "global")
    
    expect(globalShortcuts.length).toBeGreaterThan(0)
    expect(globalShortcuts.every(s => s.scope === "global")).toBe(true)
  })

  it("应该返回工作流页面的快捷键", () => {
    const shortcuts = getShortcutsForPath("/project/123/workflow/456")
    
    // 应该包含全局快捷键
    expect(shortcuts.some(s => s.scope === "global")).toBe(true)
    // 应该包含工作流快捷键
    expect(shortcuts.some(s => s.scope === "workflow")).toBe(true)
    // 不应该包含其他 scope 的快捷键
    expect(shortcuts.every(s => s.scope === "global" || s.scope === "workflow")).toBe(true)
  })

  it("应该返回设定库页面的快捷键", () => {
    const shortcuts = getShortcutsForPath("/settings-library")
    
    expect(shortcuts.some(s => s.scope === "global")).toBe(true)
    expect(shortcuts.some(s => s.scope === "settings")).toBe(true)
    expect(shortcuts.every(s => s.scope === "global" || s.scope === "settings")).toBe(true)
  })

  it("应该返回 AI 配置页面的快捷键", () => {
    const shortcuts = getShortcutsForPath("/settings")
    
    expect(shortcuts.some(s => s.scope === "global")).toBe(true)
    expect(shortcuts.some(s => s.scope === "ai_config")).toBe(true)
    expect(shortcuts.every(s => s.scope === "global" || s.scope === "ai_config")).toBe(true)
  })

  it("应该返回首页的快捷键", () => {
    const shortcuts = getShortcutsForPath("/")
    
    expect(shortcuts.some(s => s.scope === "global")).toBe(true)
    expect(shortcuts.some(s => s.scope === "home")).toBe(true)
    expect(shortcuts.every(s => s.scope === "global" || s.scope === "home")).toBe(true)
  })

  it("对于未知路径应该只返回全局快捷键", () => {
    const shortcuts = getShortcutsForPath("/unknown/path")
    
    expect(shortcuts.every(s => s.scope === "global")).toBe(true)
  })
})

// ========== groupShortcuts 测试 ==========

describe("groupShortcuts - 快捷键分组", () => {
  it("应该按 scope 和 group 组合分组", () => {
    const testShortcuts: ShortcutDefinition[] = [
      { id: "1", keys: "F1", description: "帮助", scope: "global", group: "帮助" },
      { id: "2", keys: "Ctrl+N", description: "新建", scope: "home", group: "项目管理" },
    ]
    
    const groups = groupShortcuts(testShortcuts)
    
    expect(groups.length).toBe(2)
    expect(groups.some(g => g.id === "global:帮助")).toBe(true)
    expect(groups.some(g => g.id === "home:项目管理")).toBe(true)
  })

  it("应该将全局快捷键放在最前面", () => {
    const testShortcuts: ShortcutDefinition[] = [
      { id: "1", keys: "Ctrl+N", description: "新建", scope: "home", group: "项目管理" },
      { id: "2", keys: "F1", description: "帮助", scope: "global", group: "帮助" },
      { id: "3", keys: "Ctrl+S", description: "保存", scope: "settings", group: "设定管理" },
    ]
    
    const groups = groupShortcuts(testShortcuts)
    
    // 第一个组应该是全局的
    expect(groups[0].id.startsWith("global:")).toBe(true)
  })

  it("应该正确设置分组标签", () => {
    const testShortcuts: ShortcutDefinition[] = [
      { id: "1", keys: "F1", description: "帮助", scope: "global", group: "帮助" },
      { id: "2", keys: "Ctrl+N", description: "新建", scope: "home", group: "项目管理" },
    ]
    
    const groups = groupShortcuts(testShortcuts)
    
    // 全局快捷键的标签应该只是组名
    const globalGroup = groups.find(g => g.id === "global:帮助")
    expect(globalGroup?.label).toBe("帮助")
    
    // 其他 scope 的标签应该包含 scope 标签
    const homeGroup = groups.find(g => g.id === "home:项目管理")
    expect(homeGroup?.label).toBe("首页 - 项目管理")
  })

  it("应该将相同分组的快捷键放在一起", () => {
    const testShortcuts: ShortcutDefinition[] = [
      { id: "1", keys: "Ctrl+C", description: "复制", scope: "workflow", group: "节点编辑" },
      { id: "2", keys: "Ctrl+V", description: "粘贴", scope: "workflow", group: "节点编辑" },
      { id: "3", keys: "Ctrl+Z", description: "撤销", scope: "workflow", group: "历史操作" },
    ]
    
    const groups = groupShortcuts(testShortcuts)
    
    const editGroup = groups.find(g => g.id === "workflow:节点编辑")
    expect(editGroup?.shortcuts.length).toBe(2)
  })

  it("应该处理空数组", () => {
    const groups = groupShortcuts([])
    expect(groups).toEqual([])
  })

  it("应该正确使用 SCOPE_LABELS 映射", () => {
    const allScopes: ShortcutScope[] = ["home", "workflow", "settings", "ai_config"]
    
    for (const scope of allScopes) {
      const testShortcuts: ShortcutDefinition[] = [
        { id: "1", keys: "Ctrl+X", description: "测试", scope, group: "测试组" },
      ]
      
      const groups = groupShortcuts(testShortcuts)
      const expectedLabel = `${SCOPE_LABELS[scope]} - 测试组`
      
      expect(groups[0].label).toBe(expectedLabel)
    }
  })
})

// ========== getGroupedShortcutsForPath 测试 ==========

describe("getGroupedShortcutsForPath - 获取分组后的上下文感知快捷键", () => {
  it("应该返回分组后的快捷键", () => {
    const groups = getGroupedShortcutsForPath("/project/123/workflow/456")
    
    expect(Array.isArray(groups)).toBe(true)
    expect(groups.length).toBeGreaterThan(0)
    expect(groups.every(g => g.id && g.label && Array.isArray(g.shortcuts))).toBe(true)
  })

  it("应该只包含当前页面相关的快捷键", () => {
    const groups = getGroupedShortcutsForPath("/settings-library")
    
    const allShortcuts = groups.flatMap(g => g.shortcuts)
    expect(allShortcuts.every(s => s.scope === "global" || s.scope === "settings")).toBe(true)
  })

  it("应该将全局快捷键放在最前面", () => {
    const groups = getGroupedShortcutsForPath("/")
    
    // 如果有全局快捷键，应该在最前面
    if (groups.some(g => g.id.startsWith("global:"))) {
      expect(groups[0].id.startsWith("global:")).toBe(true)
    }
  })
})

// ========== formatShortcutKeys 测试 ==========

describe("formatShortcutKeys - 格式化快捷键显示", () => {
  it("Windows 平台应该保持原样", () => {
    expect(formatShortcutKeys("Ctrl+S", "windows")).toBe("Ctrl+S")
    expect(formatShortcutKeys("Ctrl+Shift+Z", "windows")).toBe("Ctrl+Shift+Z")
    expect(formatShortcutKeys("Alt+Tab", "windows")).toBe("Alt+Tab")
    expect(formatShortcutKeys("F1", "windows")).toBe("F1")
  })

  it("Mac 平台应该转换为符号", () => {
    expect(formatShortcutKeys("Ctrl+S", "mac")).toBe("⌃S")
    expect(formatShortcutKeys("Shift+A", "mac")).toBe("⇧A")
    expect(formatShortcutKeys("Alt+Tab", "mac")).toBe("⌥Tab")
    expect(formatShortcutKeys("Meta+C", "mac")).toBe("⌘C")
  })

  it("Mac 平台应该转换组合键", () => {
    expect(formatShortcutKeys("Ctrl+Shift+Z", "mac")).toBe("⌃⇧Z")
    expect(formatShortcutKeys("Meta+Shift+A", "mac")).toBe("⌘⇧A")
    expect(formatShortcutKeys("Ctrl+Alt+Delete", "mac")).toBe("⌃⌥Delete")
  })

  it("默认应该使用 Windows 格式", () => {
    expect(formatShortcutKeys("Ctrl+S")).toBe("Ctrl+S")
  })

  it("应该处理没有修饰键的快捷键", () => {
    expect(formatShortcutKeys("F1", "mac")).toBe("F1")
    expect(formatShortcutKeys("Escape", "windows")).toBe("Escape")
  })

  it("应该处理多个相同修饰键", () => {
    // 虽然这种情况不太可能，但函数应该能处理
    expect(formatShortcutKeys("Ctrl+Ctrl+S", "mac")).toBe("⌃⌃S")
  })
})

// ========== parseShortcutKeys 测试 ==========

describe("parseShortcutKeys - 解析快捷键字符串", () => {
  it("应该正确解析单键", () => {
    const result = parseShortcutKeys("F1")
    expect(result.key).toBe("F1")
    expect(result.modifiers).toEqual([])
  })

  it("应该正确解析带修饰键的快捷键", () => {
    const result = parseShortcutKeys("Ctrl+S")
    expect(result.key).toBe("S")
    expect(result.modifiers).toEqual(["Ctrl"])
  })

  it("应该正确解析多个修饰键", () => {
    const result = parseShortcutKeys("Ctrl+Shift+Z")
    expect(result.key).toBe("Z")
    expect(result.modifiers).toEqual(["Ctrl", "Shift"])
  })

  it("应该正确解析三个修饰键", () => {
    const result = parseShortcutKeys("Ctrl+Alt+Shift+Delete")
    expect(result.key).toBe("Delete")
    expect(result.modifiers).toEqual(["Ctrl", "Alt", "Shift"])
  })

  it("应该处理空字符串", () => {
    const result = parseShortcutKeys("")
    expect(result.key).toBe("")
    expect(result.modifiers).toEqual([])
  })

  it("应该保持修饰键顺序", () => {
    const result = parseShortcutKeys("Shift+Ctrl+A")
    expect(result.modifiers).toEqual(["Shift", "Ctrl"])
  })
})

// ========== ALL_SHORTCUTS 常量测试 ==========

describe("ALL_SHORTCUTS - 快捷键定义完整性", () => {
  it("每个快捷键应该有必需的属性", () => {
    for (const shortcut of ALL_SHORTCUTS) {
      expect(shortcut.id).toBeDefined()
      expect(shortcut.id).not.toBe("")
      expect(shortcut.keys).toBeDefined()
      expect(shortcut.keys).not.toBe("")
      expect(shortcut.description).toBeDefined()
      expect(shortcut.scope).toBeDefined()
      expect(shortcut.group).toBeDefined()
    }
  })

  it("快捷键 ID 应该唯一", () => {
    const ids = ALL_SHORTCUTS.map(s => s.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it("应该包含全局快捷键", () => {
    const globalShortcuts = ALL_SHORTCUTS.filter(s => s.scope === "global")
    expect(globalShortcuts.length).toBeGreaterThan(0)
  })

  it("应该包含工作流快捷键", () => {
    const workflowShortcuts = ALL_SHORTCUTS.filter(s => s.scope === "workflow")
    expect(workflowShortcuts.length).toBeGreaterThan(0)
  })

  it("应该包含首页快捷键", () => {
    const homeShortcuts = ALL_SHORTCUTS.filter(s => s.scope === "home")
    expect(homeShortcuts.length).toBeGreaterThan(0)
  })

  it("应该包含设定库快捷键", () => {
    const settingsShortcuts = ALL_SHORTCUTS.filter(s => s.scope === "settings")
    expect(settingsShortcuts.length).toBeGreaterThan(0)
  })

  it("应该包含 AI 配置快捷键", () => {
    const aiConfigShortcuts = ALL_SHORTCUTS.filter(s => s.scope === "ai_config")
    expect(aiConfigShortcuts.length).toBeGreaterThan(0)
  })
})

// ========== SCOPE_LABELS 常量测试 ==========

describe("SCOPE_LABELS - scope 标签映射", () => {
  it("应该包含所有 scope 的标签", () => {
    const allScopes: ShortcutScope[] = ["global", "home", "workflow", "settings", "ai_config"]
    
    for (const scope of allScopes) {
      expect(SCOPE_LABELS[scope]).toBeDefined()
      expect(SCOPE_LABELS[scope]).not.toBe("")
    }
  })

  it("应该返回中文标签", () => {
    expect(SCOPE_LABELS.global).toBe("全局")
    expect(SCOPE_LABELS.home).toBe("首页")
    expect(SCOPE_LABELS.workflow).toBe("工作流编辑")
    expect(SCOPE_LABELS.settings).toBe("设定库")
    expect(SCOPE_LABELS.ai_config).toBe("AI 配置")
  })
})

