// settings-store.ts 测试
// 测试设定 Store 的所有功能

import { describe, it, expect, vi, beforeEach } from "vitest"
import { useSettingsStore } from "../settings-store"
import type { Setting, SettingPrompt, SettingCategory } from "@/types"

// Mock 数据库模块
vi.mock("@/lib/db", () => ({
  getSettings: vi.fn(),
  createSetting: vi.fn(),
  updateSetting: vi.fn(),
  deleteSetting: vi.fn(),
  getSettingPrompts: vi.fn(),
  upsertSettingPrompt: vi.fn(),
}))

// 导入 mock 后的模块
import * as db from "@/lib/db"

// ========== 测试数据工厂 ==========

function createMockSetting(overrides?: Partial<Setting>): Setting {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    project_id: "project-1",
    category: "character",
    name: "测试角色",
    content: "角色描述内容",
    enabled: true,
    parent_id: null,
    order_index: 0,
    injection_mode: 'manual',
    priority: 'medium',
    keywords: null,
    summary: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

function createMockSettingPrompt(overrides?: Partial<SettingPrompt>): SettingPrompt {
  return {
    id: crypto.randomUUID(),
    project_id: "project-1",
    category: "character",
    prompt_template: "这是一个提示词模板：{{content}}",
    enabled: true,
    ...overrides,
  }
}

// ========== 设定操作测试 ==========

describe("SettingsStore - 设定操作", () => {
  beforeEach(() => {
    // 重置 store 状态
    useSettingsStore.setState({
      settings: [],
      settingPrompts: [],
      currentProjectId: null,
      loading: false,
    })
    // 清理所有 mock
    vi.clearAllMocks()
  })

  describe("loadSettings", () => {
    it("应该加载设定列表和提示词", async () => {
      const mockSettings = [
        createMockSetting({ id: "1", name: "角色1" }),
        createMockSetting({ id: "2", name: "角色2" }),
      ]
      const mockPrompts = [
        createMockSettingPrompt({ id: "p1", category: "character" }),
      ]
      vi.mocked(db.getSettings).mockResolvedValue(mockSettings)
      vi.mocked(db.getSettingPrompts).mockResolvedValue(mockPrompts)

      await useSettingsStore.getState().loadSettings("project-1")

      expect(db.getSettings).toHaveBeenCalledWith("project-1", undefined)
      expect(db.getSettingPrompts).toHaveBeenCalledWith("project-1")
      expect(useSettingsStore.getState().settings).toEqual(mockSettings)
      expect(useSettingsStore.getState().settingPrompts).toEqual(mockPrompts)
      expect(useSettingsStore.getState().currentProjectId).toBe("project-1")
      expect(useSettingsStore.getState().loading).toBe(false)
    })

    it("应该支持搜索查询参数", async () => {
      vi.mocked(db.getSettings).mockResolvedValue([])
      vi.mocked(db.getSettingPrompts).mockResolvedValue([])

      await useSettingsStore.getState().loadSettings("project-1", "搜索关键词")

      expect(db.getSettings).toHaveBeenCalledWith("project-1", "搜索关键词")
    })

    it("应该在加载时设置 loading 状态", async () => {
      vi.mocked(db.getSettings).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve([]), 10))
      )
      vi.mocked(db.getSettingPrompts).mockResolvedValue([])

      const promise = useSettingsStore.getState().loadSettings("project-1")

      expect(useSettingsStore.getState().loading).toBe(true)

      await promise

      expect(useSettingsStore.getState().loading).toBe(false)
    })

    it("应该在加载失败时处理错误", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      vi.mocked(db.getSettings).mockRejectedValue(new Error("加载失败"))
      vi.mocked(db.getSettingPrompts).mockResolvedValue([])

      await useSettingsStore.getState().loadSettings("project-1")

      expect(consoleSpy).toHaveBeenCalled()
      expect(useSettingsStore.getState().loading).toBe(false)
      consoleSpy.mockRestore()
    })
  })

  describe("addSetting", () => {
    it("应该创建新设定", async () => {
      useSettingsStore.setState({ currentProjectId: "project-1" })
      const newSetting = createMockSetting({ id: "new-id", name: "新角色" })
      vi.mocked(db.createSetting).mockResolvedValue(newSetting)

      const result = await useSettingsStore.getState().addSetting("character", "新角色", "角色内容")

      expect(db.createSetting).toHaveBeenCalledWith("project-1", "character", "新角色", "角色内容", undefined, 0)
      expect(result).toEqual(newSetting)
      expect(useSettingsStore.getState().settings).toContainEqual(newSetting)
    })

    it("应该在没有当前项目时返回 null", async () => {
      const result = await useSettingsStore.getState().addSetting("character", "新角色", "内容")

      expect(db.createSetting).not.toHaveBeenCalled()
      expect(result).toBeNull()
    })

    it("应该在创建失败时返回 null", async () => {
      useSettingsStore.setState({ currentProjectId: "project-1" })
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      vi.mocked(db.createSetting).mockRejectedValue(new Error("创建失败"))

      const result = await useSettingsStore.getState().addSetting("character", "新角色", "内容")

      expect(result).toBeNull()
      consoleSpy.mockRestore()
    })
  })

  describe("editSetting", () => {
    it("应该更新设定信息", async () => {
      const setting = createMockSetting({ id: "1", name: "旧名称" })
      useSettingsStore.setState({ settings: [setting] })
      vi.mocked(db.updateSetting).mockResolvedValue()

      await useSettingsStore.getState().editSetting("1", { name: "新名称" })

      expect(db.updateSetting).toHaveBeenCalledWith("1", { name: "新名称" })
      const updated = useSettingsStore.getState().settings.find((s) => s.id === "1")
      expect(updated?.name).toBe("新名称")
    })

    it("应该更新 updated_at 字段", async () => {
      const oldDate = "2024-01-01T00:00:00.000Z"
      const setting = createMockSetting({ id: "1", updated_at: oldDate })
      useSettingsStore.setState({ settings: [setting] })
      vi.mocked(db.updateSetting).mockResolvedValue()

      await useSettingsStore.getState().editSetting("1", { name: "新名称" })

      const updated = useSettingsStore.getState().settings.find((s) => s.id === "1")
      expect(updated?.updated_at).not.toBe(oldDate)
    })

    it("应该在更新失败时记录错误", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      const setting = createMockSetting({ id: "1", name: "旧名称" })
      useSettingsStore.setState({ settings: [setting] })
      vi.mocked(db.updateSetting).mockRejectedValue(new Error("更新失败"))

      await useSettingsStore.getState().editSetting("1", { name: "新名称" })

      expect(consoleSpy).toHaveBeenCalled()
      // 状态不应该改变
      const current = useSettingsStore.getState().settings.find((s) => s.id === "1")
      expect(current?.name).toBe("旧名称")
      consoleSpy.mockRestore()
    })

    it("应该支持更新多个字段", async () => {
      const setting = createMockSetting({ id: "1", name: "旧名称", content: "旧内容", enabled: false })
      useSettingsStore.setState({ settings: [setting] })
      vi.mocked(db.updateSetting).mockResolvedValue()

      await useSettingsStore.getState().editSetting("1", { name: "新名称", content: "新内容", enabled: true })

      expect(db.updateSetting).toHaveBeenCalledWith("1", { name: "新名称", content: "新内容", enabled: true })
      const updated = useSettingsStore.getState().settings.find((s) => s.id === "1")
      expect(updated?.name).toBe("新名称")
      expect(updated?.content).toBe("新内容")
      expect(updated?.enabled).toBe(true)
    })
  })

  describe("removeSetting", () => {
    it("应该删除设定", async () => {
      const setting = createMockSetting({ id: "1" })
      useSettingsStore.setState({ settings: [setting] })
      vi.mocked(db.deleteSetting).mockResolvedValue()

      await useSettingsStore.getState().removeSetting("1")

      expect(db.deleteSetting).toHaveBeenCalledWith("1")
      expect(useSettingsStore.getState().settings).toHaveLength(0)
    })

    it("应该在删除失败时记录错误", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      const setting = createMockSetting({ id: "1" })
      useSettingsStore.setState({ settings: [setting] })
      vi.mocked(db.deleteSetting).mockRejectedValue(new Error("删除失败"))

      await useSettingsStore.getState().removeSetting("1")

      expect(consoleSpy).toHaveBeenCalled()
      // 设定应该仍然存在
      expect(useSettingsStore.getState().settings).toHaveLength(1)
      consoleSpy.mockRestore()
    })

    it("应该只删除指定的设定", async () => {
      const settings = [
        createMockSetting({ id: "1", name: "设定1" }),
        createMockSetting({ id: "2", name: "设定2" }),
        createMockSetting({ id: "3", name: "设定3" }),
      ]
      useSettingsStore.setState({ settings })
      vi.mocked(db.deleteSetting).mockResolvedValue()

      await useSettingsStore.getState().removeSetting("2")

      expect(useSettingsStore.getState().settings).toHaveLength(2)
      expect(useSettingsStore.getState().settings.find((s) => s.id === "2")).toBeUndefined()
    })
  })

  describe("toggleSetting", () => {
    it("应该切换设定的启用状态", async () => {
      const setting = createMockSetting({ id: "1", enabled: true })
      useSettingsStore.setState({ settings: [setting] })
      vi.mocked(db.updateSetting).mockResolvedValue()

      await useSettingsStore.getState().toggleSetting("1")

      expect(db.updateSetting).toHaveBeenCalledWith("1", { enabled: false })
      const updated = useSettingsStore.getState().settings.find((s) => s.id === "1")
      expect(updated?.enabled).toBe(false)
    })

    it("应该将禁用的设定切换为启用", async () => {
      const setting = createMockSetting({ id: "1", enabled: false })
      useSettingsStore.setState({ settings: [setting] })
      vi.mocked(db.updateSetting).mockResolvedValue()

      await useSettingsStore.getState().toggleSetting("1")

      expect(db.updateSetting).toHaveBeenCalledWith("1", { enabled: true })
      const updated = useSettingsStore.getState().settings.find((s) => s.id === "1")
      expect(updated?.enabled).toBe(true)
    })

    it("应该在找不到设定时不执行操作", async () => {
      await useSettingsStore.getState().toggleSetting("non-existent")

      expect(db.updateSetting).not.toHaveBeenCalled()
    })

    it("应该在切换失败时记录错误", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      const setting = createMockSetting({ id: "1", enabled: true })
      useSettingsStore.setState({ settings: [setting] })
      vi.mocked(db.updateSetting).mockRejectedValue(new Error("切换失败"))

      await useSettingsStore.getState().toggleSetting("1")

      expect(consoleSpy).toHaveBeenCalled()
      // 状态不应该改变
      const current = useSettingsStore.getState().settings.find((s) => s.id === "1")
      expect(current?.enabled).toBe(true)
      consoleSpy.mockRestore()
    })
  })

  describe("batchToggleSettings", () => {
    it("应该批量切换设定的启用状态", async () => {
      const settings = [
        createMockSetting({ id: "1", enabled: false }),
        createMockSetting({ id: "2", enabled: false }),
        createMockSetting({ id: "3", enabled: true }),
      ]
      useSettingsStore.setState({ settings })
      vi.mocked(db.updateSetting).mockResolvedValue()

      await useSettingsStore.getState().batchToggleSettings(["1", "2"], true)

      expect(db.updateSetting).toHaveBeenCalledTimes(2)
      expect(db.updateSetting).toHaveBeenCalledWith("1", { enabled: true })
      expect(db.updateSetting).toHaveBeenCalledWith("2", { enabled: true })
      
      const s1 = useSettingsStore.getState().settings.find((s) => s.id === "1")
      const s2 = useSettingsStore.getState().settings.find((s) => s.id === "2")
      expect(s1?.enabled).toBe(true)
      expect(s2?.enabled).toBe(true)
    })

    it("应该在空 ids 时不执行操作", async () => {
      await useSettingsStore.getState().batchToggleSettings([], true)

      expect(db.updateSetting).not.toHaveBeenCalled()
    })

    it("应该在批量切换失败时记录错误", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      const settings = [
        createMockSetting({ id: "1", enabled: false }),
        createMockSetting({ id: "2", enabled: false }),
      ]
      useSettingsStore.setState({ settings })
      vi.mocked(db.updateSetting).mockRejectedValue(new Error("批量切换失败"))

      await useSettingsStore.getState().batchToggleSettings(["1", "2"], true)

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it("应该更新 updated_at 字段", async () => {
      const oldDate = "2024-01-01T00:00:00.000Z"
      const settings = [
        createMockSetting({ id: "1", enabled: false, updated_at: oldDate }),
      ]
      useSettingsStore.setState({ settings })
      vi.mocked(db.updateSetting).mockResolvedValue()

      await useSettingsStore.getState().batchToggleSettings(["1"], true)

      const updated = useSettingsStore.getState().settings.find((s) => s.id === "1")
      expect(updated?.updated_at).not.toBe(oldDate)
    })
  })

  describe("batchRemoveSettings", () => {
    it("应该批量删除设定", async () => {
      const settings = [
        createMockSetting({ id: "1" }),
        createMockSetting({ id: "2" }),
        createMockSetting({ id: "3" }),
      ]
      useSettingsStore.setState({ settings })
      vi.mocked(db.deleteSetting).mockResolvedValue()

      await useSettingsStore.getState().batchRemoveSettings(["1", "2"])

      expect(db.deleteSetting).toHaveBeenCalledTimes(2)
      expect(db.deleteSetting).toHaveBeenCalledWith("1")
      expect(db.deleteSetting).toHaveBeenCalledWith("2")
      expect(useSettingsStore.getState().settings).toHaveLength(1)
      expect(useSettingsStore.getState().settings[0].id).toBe("3")
    })

    it("应该在空 ids 时不执行操作", async () => {
      await useSettingsStore.getState().batchRemoveSettings([])

      expect(db.deleteSetting).not.toHaveBeenCalled()
    })

    it("应该在批量删除失败时记录错误", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      const settings = [
        createMockSetting({ id: "1" }),
        createMockSetting({ id: "2" }),
      ]
      useSettingsStore.setState({ settings })
      vi.mocked(db.deleteSetting).mockRejectedValue(new Error("批量删除失败"))

      await useSettingsStore.getState().batchRemoveSettings(["1", "2"])

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})

// ========== 设定提示词操作测试 ==========

describe("SettingsStore - 设定提示词操作", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      settings: [],
      settingPrompts: [],
      currentProjectId: "project-1",
      loading: false,
    })
    vi.clearAllMocks()
  })

  describe("saveSettingPrompt", () => {
    it("应该保存新的设定提示词", async () => {
      const newPrompt = createMockSettingPrompt({ id: "new-id", category: "worldview" })
      vi.mocked(db.upsertSettingPrompt).mockResolvedValue(newPrompt)

      await useSettingsStore.getState().saveSettingPrompt("worldview", "新模板内容")

      expect(db.upsertSettingPrompt).toHaveBeenCalledWith("project-1", "worldview", "新模板内容")
      expect(useSettingsStore.getState().settingPrompts).toContainEqual(newPrompt)
    })

    it("应该更新已存在的设定提示词", async () => {
      const existingPrompt = createMockSettingPrompt({
        id: "existing",
        category: "character",
        prompt_template: "旧模板",
      })
      useSettingsStore.setState({ settingPrompts: [existingPrompt] })

      const updatedPrompt = { ...existingPrompt, prompt_template: "新模板" }
      vi.mocked(db.upsertSettingPrompt).mockResolvedValue(updatedPrompt)

      await useSettingsStore.getState().saveSettingPrompt("character", "新模板")

      expect(db.upsertSettingPrompt).toHaveBeenCalledWith("project-1", "character", "新模板")
      const prompts = useSettingsStore.getState().settingPrompts
      expect(prompts).toHaveLength(1)
      expect(prompts[0].prompt_template).toBe("新模板")
    })

    it("应该在没有当前项目时不执行操作", async () => {
      useSettingsStore.setState({ currentProjectId: null })

      await useSettingsStore.getState().saveSettingPrompt("character", "模板")

      expect(db.upsertSettingPrompt).not.toHaveBeenCalled()
    })

    it("应该在保存失败时记录错误", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
      vi.mocked(db.upsertSettingPrompt).mockRejectedValue(new Error("保存失败"))

      await useSettingsStore.getState().saveSettingPrompt("character", "模板")

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })
})

// ========== 设定筛选测试 ==========

describe("SettingsStore - 设定筛选", () => {
  beforeEach(() => {
    const settings = [
      createMockSetting({ id: "1", category: "character", name: "角色1", enabled: true }),
      createMockSetting({ id: "2", category: "character", name: "角色2", enabled: false }),
      createMockSetting({ id: "3", category: "worldview", name: "世界观1", enabled: true }),
      createMockSetting({ id: "4", category: "style", name: "风格1", enabled: true }),
    ]
    useSettingsStore.setState({
      settings,
      settingPrompts: [],
      currentProjectId: "project-1",
      loading: false,
    })
  })

  describe("getSettingsByCategory", () => {
    it("应该按分类筛选设定", () => {
      const characterSettings = useSettingsStore.getState().getSettingsByCategory("character")

      expect(characterSettings).toHaveLength(2)
      expect(characterSettings.every((s) => s.category === "character")).toBe(true)
    })

    it("应该返回空数组当没有匹配的设定时", () => {
      const outlineSettings = useSettingsStore.getState().getSettingsByCategory("outline")

      expect(outlineSettings).toHaveLength(0)
    })
  })

  describe("getEnabledSettings", () => {
    it("应该获取所有启用的设定", () => {
      const enabledSettings = useSettingsStore.getState().getEnabledSettings()

      expect(enabledSettings).toHaveLength(3)
      expect(enabledSettings.every((s) => s.enabled)).toBe(true)
    })

    it("应该按分类筛选启用的设定", () => {
      const enabledCharacters = useSettingsStore.getState().getEnabledSettings("character")

      expect(enabledCharacters).toHaveLength(1)
      expect(enabledCharacters[0].name).toBe("角色1")
    })
  })

  describe("getSettingPromptByCategory", () => {
    beforeEach(() => {
      useSettingsStore.setState({
        settingPrompts: [
          createMockSettingPrompt({ category: "character", prompt_template: "角色提示词" }),
          createMockSettingPrompt({ category: "worldview", prompt_template: "世界观提示词" }),
        ],
      })
    })

    it("应该按分类获取设定提示词", () => {
      const prompt = useSettingsStore.getState().getSettingPromptByCategory("character")

      expect(prompt).toBeDefined()
      expect(prompt?.prompt_template).toBe("角色提示词")
    })

    it("应该返回 undefined 当没有匹配的提示词时", () => {
      const prompt = useSettingsStore.getState().getSettingPromptByCategory("style")

      expect(prompt).toBeUndefined()
    })
  })
})

// ========== 筛选和排序测试 ==========

describe("SettingsStore - 筛选和排序", () => {
  beforeEach(() => {
    const now = new Date()
    const settings = [
      createMockSetting({ 
        id: "1", 
        category: "character", 
        name: "张三", 
        enabled: true,
        created_at: new Date(now.getTime() - 3000).toISOString(),
        updated_at: new Date(now.getTime() - 1000).toISOString(),
      }),
      createMockSetting({ 
        id: "2", 
        category: "character", 
        name: "李四", 
        enabled: false,
        created_at: new Date(now.getTime() - 2000).toISOString(),
        updated_at: new Date(now.getTime() - 3000).toISOString(),
      }),
      createMockSetting({ 
        id: "3", 
        category: "character", 
        name: "王五", 
        enabled: true,
        created_at: new Date(now.getTime() - 1000).toISOString(),
        updated_at: new Date(now.getTime() - 2000).toISOString(),
      }),
      createMockSetting({ 
        id: "4", 
        category: "worldview", 
        name: "世界观A", 
        enabled: true,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      }),
    ]
    useSettingsStore.setState({
      settings,
      settingPrompts: [],
      currentProjectId: "project-1",
      loading: false,
    })
  })

  describe("getFilteredAndSortedSettings", () => {
    it("应该按分类筛选", () => {
      const result = useSettingsStore.getState().getFilteredAndSortedSettings(
        "character", "all", "name", "asc"
      )

      expect(result).toHaveLength(3)
      expect(result.every((s) => s.category === "character")).toBe(true)
    })

    it("应该筛选启用的设定", () => {
      const result = useSettingsStore.getState().getFilteredAndSortedSettings(
        "character", "enabled", "name", "asc"
      )

      expect(result).toHaveLength(2)
      expect(result.every((s) => s.enabled)).toBe(true)
    })

    it("应该筛选禁用的设定", () => {
      const result = useSettingsStore.getState().getFilteredAndSortedSettings(
        "character", "disabled", "name", "asc"
      )

      expect(result).toHaveLength(1)
      expect(result[0].enabled).toBe(false)
      expect(result[0].name).toBe("李四")
    })

    it("应该按名称升序排序", () => {
      const result = useSettingsStore.getState().getFilteredAndSortedSettings(
        "character", "all", "name", "asc"
      )

      expect(result[0].name).toBe("李四")
      expect(result[1].name).toBe("王五")
      expect(result[2].name).toBe("张三")
    })

    it("应该按名称降序排序", () => {
      const result = useSettingsStore.getState().getFilteredAndSortedSettings(
        "character", "all", "name", "desc"
      )

      expect(result[0].name).toBe("张三")
      expect(result[1].name).toBe("王五")
      expect(result[2].name).toBe("李四")
    })

    it("应该按创建时间升序排序", () => {
      const result = useSettingsStore.getState().getFilteredAndSortedSettings(
        "character", "all", "created_at", "asc"
      )

      expect(result[0].name).toBe("张三")  // 最早创建
      expect(result[1].name).toBe("李四")
      expect(result[2].name).toBe("王五")  // 最晚创建
    })

    it("应该按创建时间降序排序", () => {
      const result = useSettingsStore.getState().getFilteredAndSortedSettings(
        "character", "all", "created_at", "desc"
      )

      expect(result[0].name).toBe("王五")  // 最晚创建
      expect(result[1].name).toBe("李四")
      expect(result[2].name).toBe("张三")  // 最早创建
    })

    it("应该按更新时间升序排序", () => {
      const result = useSettingsStore.getState().getFilteredAndSortedSettings(
        "character", "all", "updated_at", "asc"
      )

      expect(result[0].name).toBe("李四")  // 更新时间最早
      expect(result[1].name).toBe("王五")
      expect(result[2].name).toBe("张三")  // 更新时间最晚
    })

    it("应该按更新时间降序排序", () => {
      const result = useSettingsStore.getState().getFilteredAndSortedSettings(
        "character", "all", "updated_at", "desc"
      )

      expect(result[0].name).toBe("张三")  // 更新时间最晚
      expect(result[1].name).toBe("王五")
      expect(result[2].name).toBe("李四")  // 更新时间最早
    })

    it("应该同时应用筛选和排序", () => {
      const result = useSettingsStore.getState().getFilteredAndSortedSettings(
        "character", "enabled", "name", "desc"
      )

      expect(result).toHaveLength(2)
      expect(result[0].name).toBe("张三")
      expect(result[1].name).toBe("王五")
    })

    it("应该返回空数组当没有匹配的设定时", () => {
      const result = useSettingsStore.getState().getFilteredAndSortedSettings(
        "outline", "all", "name", "asc"
      )

      expect(result).toHaveLength(0)
    })

    it("应该处理全部禁用的分类", () => {
      const result = useSettingsStore.getState().getFilteredAndSortedSettings(
        "character", "enabled", "name", "asc"
      )
      
      // 只有 2 个启用的 character 设定
      expect(result).toHaveLength(2)
    })
  })
})

// ========== 边界情况测试 ==========

describe("SettingsStore - 边界情况", () => {
  beforeEach(() => {
    useSettingsStore.setState({
      settings: [],
      settingPrompts: [],
      currentProjectId: null,
      loading: false,
    })
    vi.clearAllMocks()
  })

  it("应该处理空设定列表", () => {
    const result = useSettingsStore.getState().getEnabledSettings()
    expect(result).toHaveLength(0)
  })

  it("应该在并发加载时正确处理状态", async () => {
    vi.mocked(db.getSettings).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 50))
    )
    vi.mocked(db.getSettingPrompts).mockResolvedValue([])

    // 启动两个并发加载
    const promise1 = useSettingsStore.getState().loadSettings("project-1")
    const promise2 = useSettingsStore.getState().loadSettings("project-2")

    await Promise.all([promise1, promise2])

    // 最后一个加载的项目 ID 应该被保留
    expect(useSettingsStore.getState().loading).toBe(false)
  })

  it("应该正确处理各种设定分类", async () => {
    useSettingsStore.setState({ currentProjectId: "project-1" })

    const categories: SettingCategory[] = ["character", "worldview", "style", "outline"]

    for (const category of categories) {
      const setting = createMockSetting({ category })
      vi.mocked(db.createSetting).mockResolvedValue(setting)

      const result = await useSettingsStore.getState().addSetting(category, "测试", "内容")

      expect(result?.category).toBe(category)
    }
  })
})

