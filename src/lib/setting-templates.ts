// 设定模板系统 - 为不同分类提供可选的结构化模板

import type { SettingCategory } from '@/types'

export interface TemplateField {
  key: string
  label: string
  type: 'text' | 'textarea'
  placeholder?: string
}

export interface SettingTemplate {
  label: string
  description: string
  fields: TemplateField[]
}

export const SETTING_TEMPLATES: Partial<Record<SettingCategory, SettingTemplate>> = {
  character: {
    label: '角色设定模板',
    description: '从结构化模板快速创建角色设定',
    fields: [
      { key: 'name', label: '姓名', type: 'text', placeholder: '角色全名' },
      { key: 'age', label: '年龄', type: 'text', placeholder: '如：25岁' },
      { key: 'appearance', label: '外貌', type: 'textarea', placeholder: '描述角色的外貌特征...' },
      { key: 'personality', label: '性格', type: 'textarea', placeholder: '描述角色的性格特点...' },
      { key: 'background', label: '背景故事', type: 'textarea', placeholder: '角色的过去经历...' },
      { key: 'ability', label: '特殊能力', type: 'textarea', placeholder: '角色拥有的特殊能力或技能...' },
      { key: 'catchphrase', label: '口头禅', type: 'text', placeholder: '角色的标志性语句' },
    ],
  },
  worldview: {
    label: '世界观模板',
    description: '从结构化模板快速创建世界观设定',
    fields: [
      { key: 'overview', label: '概述', type: 'textarea', placeholder: '世界的总体描述...' },
      { key: 'geography', label: '地理环境', type: 'textarea', placeholder: '地形、气候、主要区域...' },
      { key: 'politics', label: '政治体系', type: 'textarea', placeholder: '国家、组织、权力结构...' },
      { key: 'culture', label: '文化习俗', type: 'textarea', placeholder: '语言、宗教、节日、社会习惯...' },
      { key: 'magic_or_tech', label: '魔法/科技体系', type: 'textarea', placeholder: '超自然力量或科技水平...' },
      { key: 'history', label: '历史大事件', type: 'textarea', placeholder: '影响世界的重要历史事件...' },
    ],
  },
  outline: {
    label: '大纲模板',
    description: '从结构化模板快速创建故事大纲',
    fields: [
      { key: 'premise', label: '故事前提', type: 'textarea', placeholder: '故事的核心前提和背景...' },
      { key: 'conflict', label: '核心冲突', type: 'textarea', placeholder: '推动故事发展的主要矛盾...' },
      { key: 'beginning', label: '开端', type: 'textarea', placeholder: '故事的开始...' },
      { key: 'development', label: '发展', type: 'textarea', placeholder: '故事的展开和递进...' },
      { key: 'climax', label: '高潮', type: 'textarea', placeholder: '故事的最高潮...' },
      { key: 'ending', label: '结局', type: 'textarea', placeholder: '故事的结局...' },
    ],
  },
  // style 分类不设模板，保持自由文本
}

/**
 * 将模板字段值转为 Markdown 格式
 * 确保无模板环境下内容仍然可读
 */
export function templateFieldsToMarkdown(fields: TemplateField[], values: Record<string, string>): string {
  return fields
    .filter(f => values[f.key]?.trim())
    .map(f => `## ${f.label}\n\n${values[f.key].trim()}`)
    .join('\n\n')
}
