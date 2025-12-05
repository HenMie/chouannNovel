import { create } from 'zustand'
import type { Setting, SettingPrompt, SettingCategory } from '@/types'
import {
  getSettings,
  createSetting,
  updateSetting,
  deleteSetting,
  getSettingPrompts,
  upsertSettingPrompt,
} from '@/lib/db'
import { logError } from '@/lib/errors'

interface SettingsState {
  // 设定数据
  settings: Setting[]
  settingPrompts: SettingPrompt[]
  currentProjectId: string | null
  
  // 加载状态
  loading: boolean
  
  // 操作
  loadSettings: (projectId: string, query?: string) => Promise<void>
  addSetting: (category: SettingCategory, name: string, content: string) => Promise<Setting | null>
  editSetting: (id: string, data: Partial<Pick<Setting, 'name' | 'content' | 'enabled'>>) => Promise<void>
  removeSetting: (id: string) => Promise<void>
  toggleSetting: (id: string) => Promise<void>
  
  // 设定提示词操作
  saveSettingPrompt: (category: SettingCategory, promptTemplate: string) => Promise<void>
  
  // 获取器
  getSettingsByCategory: (category: SettingCategory) => Setting[]
  getEnabledSettings: (category?: SettingCategory) => Setting[]
  getSettingPromptByCategory: (category: SettingCategory) => SettingPrompt | undefined
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: [],
  settingPrompts: [],
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

  addSetting: async (category, name, content) => {
    const { currentProjectId, settings } = get()
    if (!currentProjectId) return null
    
    try {
      const newSetting = await createSetting(currentProjectId, category, name, content)
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
      set({ settings: settings.filter((s) => s.id !== id) })
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

  getSettingsByCategory: (category) => {
    return get().settings.filter((s) => s.category === category)
  },

  getEnabledSettings: (category) => {
    const { settings } = get()
    return settings.filter((s) => s.enabled && (!category || s.category === category))
  },

  getSettingPromptByCategory: (category) => {
    return get().settingPrompts.find((p) => p.category === category)
  },
}))

