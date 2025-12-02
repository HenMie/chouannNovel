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

interface SettingsState {
  // 设定数据
  settings: Setting[]
  settingPrompts: SettingPrompt[]
  currentProjectId: string | null
  
  // 加载状态
  loading: boolean
  
  // 操作
  loadSettings: (projectId: string) => Promise<void>
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

  loadSettings: async (projectId: string) => {
    set({ loading: true, currentProjectId: projectId })
    try {
      const [settings, prompts] = await Promise.all([
        getSettings(projectId),
        getSettingPrompts(projectId),
      ])
      set({ settings, settingPrompts: prompts })
    } catch (error) {
      console.error('加载设定库失败:', error)
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
      console.error('创建设定失败:', error)
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
      console.error('更新设定失败:', error)
    }
  },

  removeSetting: async (id) => {
    const { settings } = get()
    try {
      await deleteSetting(id)
      set({ settings: settings.filter((s) => s.id !== id) })
    } catch (error) {
      console.error('删除设定失败:', error)
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
      console.error('切换设定状态失败:', error)
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
      console.error('保存设定提示词失败:', error)
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

