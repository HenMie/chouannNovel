// 快捷键配置中心
// 集中管理所有快捷键定义，支持按模块/页面分组和上下文过滤

// 快捷键所属的模块/页面
export type ShortcutScope = 
  | 'global'      // 全局快捷键
  | 'home'        // 首页
  | 'workflow'    // 工作流编辑
  | 'settings'    // 设定库
  | 'ai_config'   // AI 配置

// 单个快捷键定义
export interface ShortcutDefinition {
  id: string
  // 快捷键组合，如 "Ctrl+S", "F1", "Ctrl+Shift+Z"
  keys: string
  // 功能描述
  description: string
  // 所属模块
  scope: ShortcutScope
  // 分组（用于 UI 展示分组）
  group: string
  // 是否仅在特定条件下可用
  condition?: string
}

// 快捷键分组信息
export interface ShortcutGroup {
  id: string
  label: string
  shortcuts: ShortcutDefinition[]
}

// 所有快捷键定义
export const ALL_SHORTCUTS: ShortcutDefinition[] = [
  // ========== 全局快捷键 ==========
  {
    id: 'help',
    keys: 'F1',
    description: '打开快捷键帮助',
    scope: 'global',
    group: '帮助',
  },

  // ========== 工作流页面 ==========
  // 执行控制
  {
    id: 'workflow_run',
    keys: 'Ctrl+Enter',
    description: '运行工作流',
    scope: 'workflow',
    group: '执行控制',
  },
  {
    id: 'workflow_pause_resume',
    keys: 'Space',
    description: '暂停/继续执行',
    scope: 'workflow',
    group: '执行控制',
    condition: '执行中时',
  },
  {
    id: 'workflow_stop',
    keys: 'Escape',
    description: '停止执行 / 关闭对话框 / 清除选择',
    scope: 'workflow',
    group: '执行控制',
  },

  // 节点编辑
  {
    id: 'workflow_select_all',
    keys: 'Ctrl+A',
    description: '全选节点',
    scope: 'workflow',
    group: '节点编辑',
  },
  {
    id: 'workflow_copy',
    keys: 'Ctrl+C',
    description: '复制选中节点',
    scope: 'workflow',
    group: '节点编辑',
  },
  {
    id: 'workflow_paste',
    keys: 'Ctrl+V',
    description: '粘贴节点',
    scope: 'workflow',
    group: '节点编辑',
  },
  {
    id: 'workflow_delete',
    keys: 'Delete',
    description: '删除选中节点',
    scope: 'workflow',
    group: '节点编辑',
  },
  {
    id: 'workflow_delete_alt',
    keys: 'Backspace',
    description: '删除选中节点',
    scope: 'workflow',
    group: '节点编辑',
  },
  {
    id: 'workflow_edit',
    keys: 'Enter',
    description: '编辑选中节点',
    scope: 'workflow',
    group: '节点编辑',
    condition: '选中单个节点时',
  },
  {
    id: 'workflow_duplicate',
    keys: 'Ctrl+D',
    description: '复制并粘贴节点',
    scope: 'workflow',
    group: '节点编辑',
    condition: '选中节点时',
  },

  // 历史操作
  {
    id: 'workflow_undo',
    keys: 'Ctrl+Z',
    description: '撤销',
    scope: 'workflow',
    group: '历史操作',
  },
  {
    id: 'workflow_redo',
    keys: 'Ctrl+Shift+Z',
    description: '重做',
    scope: 'workflow',
    group: '历史操作',
  },
  {
    id: 'workflow_redo_alt',
    keys: 'Ctrl+Y',
    description: '重做',
    scope: 'workflow',
    group: '历史操作',
  },

  // ========== 首页 ==========
  {
    id: 'home_new_project',
    keys: 'Ctrl+N',
    description: '新建项目',
    scope: 'home',
    group: '项目管理',
  },

  // ========== 设定库 ==========
  {
    id: 'settings_new',
    keys: 'Ctrl+N',
    description: '新建设定',
    scope: 'settings',
    group: '设定管理',
  },
  {
    id: 'settings_save',
    keys: 'Ctrl+S',
    description: '保存设定',
    scope: 'settings',
    group: '设定管理',
    condition: '编辑时',
  },

  // ========== AI 配置 ==========
  {
    id: 'ai_config_save',
    keys: 'Ctrl+S',
    description: '保存配置',
    scope: 'ai_config',
    group: 'AI 配置',
  },
]

// 模块标签映射
export const SCOPE_LABELS: Record<ShortcutScope, string> = {
  global: '全局',
  home: '首页',
  workflow: '工作流编辑',
  settings: '设定库',
  ai_config: 'AI 配置',
}

// 根据路径获取当前页面的 scope
export function getScopeFromPath(path: string): ShortcutScope {
  if (path.includes('/workflow/')) {
    return 'workflow'
  }
  if (path.includes('/settings-library')) {
    return 'settings'
  }
  if (path === '/settings') {
    return 'ai_config'
  }
  if (path === '/' || path.includes('/project/new') || path.includes('/project/') && !path.includes('/workflow/')) {
    return 'home'
  }
  return 'global'
}

// 根据当前路径过滤相关快捷键
export function getShortcutsForPath(path: string): ShortcutDefinition[] {
  const currentScope = getScopeFromPath(path)
  
  // 始终包含全局快捷键 + 当前页面快捷键
  return ALL_SHORTCUTS.filter(
    shortcut => shortcut.scope === 'global' || shortcut.scope === currentScope
  )
}

// 按分组整理快捷键
export function groupShortcuts(shortcuts: ShortcutDefinition[]): ShortcutGroup[] {
  const groups = new Map<string, ShortcutDefinition[]>()
  
  // 按 scope 和 group 组合分组
  for (const shortcut of shortcuts) {
    const groupKey = `${shortcut.scope}:${shortcut.group}`
    if (!groups.has(groupKey)) {
      groups.set(groupKey, [])
    }
    groups.get(groupKey)!.push(shortcut)
  }
  
  // 转换为数组格式
  const result: ShortcutGroup[] = []
  
  // 首先添加全局快捷键
  for (const [key, shortcuts] of groups) {
    if (key.startsWith('global:')) {
      const groupName = key.split(':')[1]
      result.push({
        id: key,
        label: `${groupName}`,
        shortcuts,
      })
    }
  }
  
  // 然后添加其他快捷键
  for (const [key, shortcuts] of groups) {
    if (!key.startsWith('global:')) {
      const [scope, groupName] = key.split(':')
      const scopeLabel = SCOPE_LABELS[scope as ShortcutScope]
      result.push({
        id: key,
        label: `${scopeLabel} - ${groupName}`,
        shortcuts,
      })
    }
  }
  
  return result
}

// 获取分组后的上下文感知快捷键
export function getGroupedShortcutsForPath(path: string): ShortcutGroup[] {
  const shortcuts = getShortcutsForPath(path)
  return groupShortcuts(shortcuts)
}

// 格式化快捷键显示（将 Ctrl+S 转为 ⌃S 等）
export function formatShortcutKeys(keys: string, platform: 'mac' | 'windows' = 'windows'): string {
  if (platform === 'mac') {
    return keys
      .replace(/Ctrl\+/g, '⌃')
      .replace(/Shift\+/g, '⇧')
      .replace(/Alt\+/g, '⌥')
      .replace(/Meta\+/g, '⌘')
  }
  return keys
}

// 解析快捷键字符串为组件可用的格式
export function parseShortcutKeys(keys: string): { key: string; modifiers: string[] } {
  const parts = keys.split('+')
  const key = parts.pop() || ''
  const modifiers = parts
  
  return { key, modifiers }
}

