import { create } from 'zustand'
import type { Setting, SettingRelation, SettingPrompt, SettingCategory } from '@/types'
import {
  getSettings,
  createSetting,
  updateSetting,
  deleteSetting,
  getSettingPrompts,
  upsertSettingPrompt,
  getSettingRelations,
  createSettingRelation,
  deleteSettingRelation,
} from '@/lib/db'
import { logError } from '@/lib/errors'

// 筛选状态类型
export type SettingFilterStatus = 'all' | 'enabled' | 'disabled'

// 排序方式类型
export type SettingSortBy = 'name' | 'created_at' | 'updated_at'
export type SettingSortOrder = 'asc' | 'desc'

// 设定树节点（用于 UI 树形展示）
export interface SettingTreeNode {
  setting: Setting
  children: SettingTreeNode[]
}

interface SettingsState {
  // 设定数据
  settings: Setting[]
  settingPrompts: SettingPrompt[]
  relations: SettingRelation[]
  currentProjectId: string | null

  // 加载状态
  loading: boolean

  // 操作
  loadSettings: (projectId: string, query?: string) => Promise<void>
  addSetting: (category: SettingCategory, name: string, content: string, parentId?: string | null) => Promise<Setting | null>
  editSetting: (id: string, data: Partial<Pick<Setting, 'name' | 'content' | 'enabled' | 'parent_id' | 'order_index' | 'injection_mode' | 'priority' | 'keywords' | 'summary'>>) => Promise<void>
  removeSetting: (id: string) => Promise<void>
  toggleSetting: (id: string) => Promise<void>

  // 批量操作
  batchToggleSettings: (ids: string[], enabled: boolean) => Promise<void>
  batchRemoveSettings: (ids: string[]) => Promise<void>

  // 设定提示词操作
  saveSettingPrompt: (category: SettingCategory, promptTemplate: string) => Promise<void>

  // 关系操作
  loadRelations: (projectId: string) => Promise<void>
  getRelationsForSetting: (settingId: string) => SettingRelation[]
  addRelation: (projectId: string, sourceId: string, targetId: string, label?: string, description?: string) => Promise<SettingRelation>
  removeRelation: (id: string) => Promise<void>

  // 获取器
  getSettingsByCategory: (category: SettingCategory) => Setting[]
  getEnabledSettings: (category?: SettingCategory) => Setting[]
  getAutoInjectSettings: () => Setting[]
  getSettingPromptByCategory: (category: SettingCategory) => SettingPrompt | undefined
  getSettingTree: (category: SettingCategory) => SettingTreeNode[]

  // 筛选和排序获取器
  getFilteredAndSortedSettings: (
    category: SettingCategory,
    filterStatus: SettingFilterStatus,
    sortBy: SettingSortBy,
    sortOrder: SettingSortOrder
  ) => Setting[]
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: [],
  settingPrompts: [],
  relations: [],
  currentProjectId: null,
  loading: false,

  loadSettings: async (projectId: string, query?: string) => {
    set({ loading: true, currentProjectId: projectId })
    try {
      const [settings, prompts] = await Promise.all([
        getSettings(projectId, query),
        getSettingPrompts(projectId),
      ])
      set({ settings, settingPrompts: prompts })
    } catch (error) {
      logError({ error, context: '加载设定库' })
    } finally {
      set({ loading: false })
    }
  },

  addSetting: async (category, name, content, parentId) => {
    const { currentProjectId, settings } = get()
    if (!currentProjectId) return null

    try {
      // 计算同级下一个 order_index
      const siblings = settings.filter(
        (s) => s.category === category && s.parent_id === (parentId ?? null)
      )
      const nextOrder = siblings.length > 0
        ? Math.max(...siblings.map((s) => s.order_index)) + 1
        : 0

      const newSetting = await createSetting(currentProjectId, category, name, content, parentId, nextOrder)
      set({ settings: [...settings, newSetting] })
      return newSetting
    } catch (error) {
      logError({ error, context: '创建设定' })
      return null
    }
  },

  editSetting: async (id, data) => {
    const { settings } = get()
    try {
      await updateSetting(id, data)
      set({
        settings: settings.map((s) =>
          s.id === id ? { ...s, ...data, updated_at: new Date().toISOString() } : s
        ),
      })
    } catch (error) {
      logError({ error, context: '更新设定' })
    }
  },

  removeSetting: async (id) => {
    const { settings } = get()
    try {
      await deleteSetting(id)
      // 同时移除所有子设定（递归）
      const idsToRemove = new Set<string>()
      function collectChildren(parentId: string) {
        idsToRemove.add(parentId)
        settings.filter((s) => s.parent_id === parentId).forEach((s) => collectChildren(s.id))
      }
      collectChildren(id)
      set({ settings: settings.filter((s) => !idsToRemove.has(s.id)) })
    } catch (error) {
      logError({ error, context: '删除设定' })
    }
  },

  toggleSetting: async (id) => {
    const { settings } = get()
    const setting = settings.find((s) => s.id === id)
    if (!setting) return

    try {
      await updateSetting(id, { enabled: !setting.enabled })
      set({
        settings: settings.map((s) =>
          s.id === id ? { ...s, enabled: !s.enabled } : s
        ),
      })
    } catch (error) {
      logError({ error, context: '切换设定状态' })
    }
  },

  batchToggleSettings: async (ids, enabled) => {
    const { settings } = get()
    if (ids.length === 0) return

    try {
      // 并发执行所有更新
      await Promise.all(ids.map((id) => updateSetting(id, { enabled })))
      set({
        settings: settings.map((s) =>
          ids.includes(s.id) ? { ...s, enabled, updated_at: new Date().toISOString() } : s
        ),
      })
    } catch (error) {
      logError({ error, context: '批量切换设定状态' })
    }
  },

  batchRemoveSettings: async (ids) => {
    const { settings } = get()
    if (ids.length === 0) return

    try {
      // 并发执行所有删除
      await Promise.all(ids.map((id) => deleteSetting(id)))
      set({ settings: settings.filter((s) => !ids.includes(s.id)) })
    } catch (error) {
      logError({ error, context: '批量删除设定' })
    }
  },

  saveSettingPrompt: async (category, promptTemplate) => {
    const { currentProjectId, settingPrompts } = get()
    if (!currentProjectId) return

    try {
      const prompt = await upsertSettingPrompt(currentProjectId, category, promptTemplate)
      const existingIndex = settingPrompts.findIndex(
        (p) => p.project_id === currentProjectId && p.category === category
      )

      if (existingIndex >= 0) {
        const newPrompts = [...settingPrompts]
        newPrompts[existingIndex] = prompt
        set({ settingPrompts: newPrompts })
      } else {
        set({ settingPrompts: [...settingPrompts, prompt] })
      }
    } catch (error) {
      logError({ error, context: '保存设定提示词' })
    }
  },

  loadRelations: async (projectId: string) => {
    try {
      const relations = await getSettingRelations(projectId)
      set({ relations })
    } catch (error) {
      logError({ error, context: '加载设定关系' })
    }
  },

  getRelationsForSetting: (settingId: string) => {
    const { relations } = get()
    return relations.filter(r =>
      r.source_id === settingId ||
      (r.target_id === settingId && r.bidirectional)
    )
  },

  addRelation: async (projectId: string, sourceId: string, targetId: string, label?: string, description?: string) => {
    const relation = await createSettingRelation(projectId, sourceId, targetId, label, description)
    set(state => ({ relations: [relation, ...state.relations] }))
    return relation
  },

  removeRelation: async (id: string) => {
    await deleteSettingRelation(id)
    set(state => ({ relations: state.relations.filter(r => r.id !== id) }))
  },

  getSettingsByCategory: (category) => {
    return get().settings.filter((s) => s.category === category)
  },

  getEnabledSettings: (category) => {
    const { settings } = get()
    return settings.filter((s) => s.enabled && (!category || s.category === category))
  },

  getAutoInjectSettings: () => {
    const { settings } = get()
    return settings.filter((s) => s.enabled && s.injection_mode === 'auto')
  },

  getSettingPromptByCategory: (category) => {
    return get().settingPrompts.find((p) => p.category === category)
  },

  getSettingTree: (category) => {
    const { settings } = get()
    const categorySettings = settings.filter((s) => s.category === category)

    function buildTree(parentId: string | null): SettingTreeNode[] {
      return categorySettings
        .filter((s) => (s.parent_id ?? null) === parentId)
        .sort((a, b) => a.order_index - b.order_index)
        .map((setting) => ({
          setting,
          children: buildTree(setting.id),
        }))
    }

    return buildTree(null)
  },

  getFilteredAndSortedSettings: (category, filterStatus, sortBy, sortOrder) => {
    let filtered = get().settings.filter((s) => s.category === category)

    // 状态筛选
    if (filterStatus === 'enabled') {
      filtered = filtered.filter((s) => s.enabled)
    } else if (filterStatus === 'disabled') {
      filtered = filtered.filter((s) => !s.enabled)
    }

    // 排序
    filtered.sort((a, b) => {
      let comparison = 0

      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name, 'zh-CN')
      } else if (sortBy === 'created_at') {
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      } else if (sortBy === 'updated_at') {
        comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

    return filtered
  },
}))
