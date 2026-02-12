import type { Setting, SettingPrompt, SettingPriority } from '@/types'

// Priority sort order
const PRIORITY_ORDER: Record<SettingPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
}

// Token budget for injection levels
const TOKEN_BUDGETS = {
  minimal: 500,
  balanced: 1500,
  full: 3000,
} as const

export type InjectionLevel = 'minimal' | 'balanced' | 'full'

/**
 * Estimate token count for text (rough: Chinese chars * 1.5 + English words * 1.3)
 */
export function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
  const remaining = text.replace(/[\u4e00-\u9fff\u3400-\u4dbf]/g, ' ')
  const englishWords = remaining.split(/\s+/).filter(w => w.length > 0).length
  return Math.ceil(chineseChars * 1.5 + englishWords * 1.3)
}

/**
 * Collect candidate settings for injection
 */
function collectCandidates(
  allSettings: Setting[],
  manualIds: string[],
): Setting[] {
  const candidateMap = new Map<string, Setting>()

  // Auto-inject settings (injection_mode === 'auto')
  allSettings.forEach(s => {
    if (s.injection_mode === 'auto' && s.enabled) {
      candidateMap.set(s.id, s)
    }
  })

  // Manually selected settings
  allSettings.forEach(s => {
    if (manualIds.includes(s.id) && s.enabled) {
      candidateMap.set(s.id, s)
    }
  })

  return Array.from(candidateMap.values())
}

/**
 * Apply token budget: sort by priority, trim to budget
 */
function applyTokenBudget(
  candidates: Setting[],
  budget: number,
): Setting[] {
  // Sort by priority
  candidates.sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority])

  const result: Setting[] = []
  let usedTokens = 0

  for (const setting of candidates) {
    const tokens = estimateTokens(setting.content)

    if (usedTokens + tokens <= budget) {
      result.push(setting)
      usedTokens += tokens
    } else if (setting.summary) {
      // Use summary as fallback if full content exceeds budget
      const summaryTokens = estimateTokens(setting.summary)
      if (usedTokens + summaryTokens <= budget) {
        result.push({ ...setting, content: setting.summary })
        usedTokens += summaryTokens
      }
    }
    // Skip if even summary exceeds budget
  }

  return result
}

/**
 * Generate injection text from settings using templates
 */
function renderInjectionText(
  settings: Setting[],
  settingPrompts: SettingPrompt[],
): string {
  if (settings.length === 0) return ''

  // Group by category
  const settingsByCategory: Record<string, Setting[]> = {}
  settings.forEach((s) => {
    if (!settingsByCategory[s.category]) {
      settingsByCategory[s.category] = []
    }
    settingsByCategory[s.category].push(s)
  })

  const defaultTemplates: Record<string, string> = {
    character: '【角色设定】\n{{items}}',
    worldview: '【世界观设定】\n{{items}}',
    style: '【笔触风格】\n{{items}}',
    outline: '【故事大纲】\n{{items}}',
  }

  const parts: string[] = []

  for (const [category, catSettings] of Object.entries(settingsByCategory)) {
    const promptTemplate = settingPrompts.find(
      (p) => p.category === category && p.enabled
    )

    let template = promptTemplate?.prompt_template || defaultTemplates[category]

    const items = catSettings.map((s) => `${s.name}：${s.content}`).join('\n\n')

    if (template.includes('{{#each items}}')) {
      const eachMatch = template.match(/\{\{#each items\}\}([\s\S]*?)\{\{\/each\}\}/)
      if (eachMatch) {
        const itemTemplate = eachMatch[1]
        const renderedItems = catSettings.map((s) => {
          return itemTemplate
            .replace(/\{\{name\}\}/g, s.name)
            .replace(/\{\{content\}\}/g, s.content)
        }).join('')
        template = template.replace(eachMatch[0], renderedItems)
      }
    } else {
      template = template.replace(/\{\{items\}\}/g, items)
    }

    parts.push(template)
  }

  return parts.join('\n\n')
}

/**
 * Main injection function - generates settings injection text
 *
 * When injectionLevel is provided, uses smart injection with token budget.
 * When not provided, falls back to legacy full injection behavior.
 */
export function generateSettingsInjection(
  allSettings: Setting[],
  settingPrompts: SettingPrompt[],
  manualIds: string[],
  injectionLevel?: InjectionLevel,
): string {
  // Collect candidates (auto + manual)
  const candidates = collectCandidates(allSettings, manualIds)

  if (candidates.length === 0) return ''

  // If no injection level specified, use legacy behavior (no budget limit)
  if (!injectionLevel) {
    return renderInjectionText(candidates, settingPrompts)
  }

  // Apply token budget
  const budget = TOKEN_BUDGETS[injectionLevel]
  const budgeted = applyTokenBudget(candidates, budget)

  return renderInjectionText(budgeted, settingPrompts)
}
