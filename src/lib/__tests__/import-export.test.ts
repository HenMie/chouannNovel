/**
 * import-export.ts 导入/导出工具函数测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ExportedWorkflow, ExportedSettings, ExportedProject } from '@/types'

// Mock Tauri dialog API
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}))

// Mock Tauri fs API
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
}))

// Mock errors
vi.mock('@/lib/errors', () => ({
  logError: vi.fn(),
}))

// 导入被测试的函数
import {
  exportWorkflowToFile,
  importWorkflowFromFile,
  exportSettingsToFile,
  importSettingsFromFile,
  exportProjectToFile,
  importProjectFromFile,
  validateExportedWorkflow,
  validateExportedSettings,
  validateExportedProject,
} from '../import-export'

// 导入 mock 的模块以便在测试中控制
import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import * as db from '@/lib/db'
import { logError } from '@/lib/errors'

// ========== 测试数据 ==========

// 有效的工作流导出数据
const validExportedWorkflow: ExportedWorkflow = {
  version: '1.0.0',
  exported_at: '2024-01-01T00:00:00.000Z',
  workflow: {
    name: '测试工作流',
    description: '测试描述',
    loop_max_count: 10,
    timeout_seconds: 300,
  },
  nodes: [
    {
      type: 'start',
      name: '开始流程',
      config: {},
      order_index: 0,
    },
    {
      type: 'ai_chat',
      name: 'AI对话',
      config: {
        provider: 'openai',
        model: 'gpt-4',
        system_prompt: '你是一个助手',
        user_prompt: '你好',
        enable_history: false,
        history_count: 0,
        setting_ids: [],
      },
      order_index: 1,
    },
  ],
}

// 有效的设定库导出数据
const validExportedSettings: ExportedSettings = {
  version: '1.0.0',
  exported_at: '2024-01-01T00:00:00.000Z',
  settings: [
    {
      category: 'character',
      name: '主角',
      content: '勇敢的冒险者',
      enabled: true,
      parent_id: null,
      order_index: 0,
    },
    {
      category: 'worldview',
      name: '世界观',
      content: '魔法世界',
      enabled: true,
      parent_id: null,
      order_index: 0,
    },
  ],
  setting_prompts: [
    {
      category: 'character',
      prompt_template: '角色设定: {{content}}',
      enabled: true,
    },
  ],
}

// 有效的项目导出数据
const validExportedProject: ExportedProject = {
  version: '1.0.0',
  exported_at: '2024-01-01T00:00:00.000Z',
  project: {
    name: '测试项目',
    description: '项目描述',
  },
  workflows: [
    {
      workflow: {
        name: '工作流1',
        description: '描述',
        loop_max_count: 10,
        timeout_seconds: 300,
      },
      nodes: [
        {
          type: 'start',
          name: '开始',
          config: {},
          order_index: 0,
        },
      ],
    },
  ],
  settings: [
    {
      category: 'character',
      name: '角色',
      content: '内容',
      enabled: true,
      parent_id: null,
      order_index: 0,
    },
  ],
  setting_prompts: [
    {
      category: 'character',
      prompt_template: '模板',
      enabled: true,
    },
  ],
}

// ========== validateExportedWorkflow 测试 ==========

describe('validateExportedWorkflow - 工作流导出数据验证', () => {
  it('应该对有效数据返回 true', () => {
    expect(validateExportedWorkflow(validExportedWorkflow)).toBe(true)
  })

  it('应该对 null 返回 false', () => {
    expect(validateExportedWorkflow(null)).toBe(false)
  })

  it('应该对 undefined 返回 false', () => {
    expect(validateExportedWorkflow(undefined)).toBe(false)
  })

  it('应该对非对象类型返回 false', () => {
    expect(validateExportedWorkflow('string')).toBe(false)
    expect(validateExportedWorkflow(123)).toBe(false)
    expect(validateExportedWorkflow([])).toBe(false)
  })

  it('应该对缺少 version 字段的数据返回 false', () => {
    const { version, ...rest } = validExportedWorkflow
    expect(validateExportedWorkflow(rest)).toBe(false)
  })

  it('应该对 version 不是字符串的数据返回 false', () => {
    expect(validateExportedWorkflow({ ...validExportedWorkflow, version: 123 })).toBe(false)
  })

  it('应该对缺少 exported_at 字段的数据返回 false', () => {
    const { exported_at, ...rest } = validExportedWorkflow
    expect(validateExportedWorkflow(rest)).toBe(false)
  })

  it('应该对 exported_at 不是字符串的数据返回 false', () => {
    expect(validateExportedWorkflow({ ...validExportedWorkflow, exported_at: 123 })).toBe(false)
  })

  it('应该对缺少 workflow 字段的数据返回 false', () => {
    const { workflow, ...rest } = validExportedWorkflow
    expect(validateExportedWorkflow(rest)).toBe(false)
  })

  it('应该对缺少 nodes 字段的数据返回 false', () => {
    const { nodes, ...rest } = validExportedWorkflow
    expect(validateExportedWorkflow(rest)).toBe(false)
  })

  it('应该对 nodes 不是数组的数据返回 false', () => {
    expect(validateExportedWorkflow({ ...validExportedWorkflow, nodes: {} })).toBe(false)
    expect(validateExportedWorkflow({ ...validExportedWorkflow, nodes: 'string' })).toBe(false)
  })

  it('应该对空 nodes 数组返回 true', () => {
    expect(validateExportedWorkflow({ ...validExportedWorkflow, nodes: [] })).toBe(true)
  })

  it('应该对包含 block_id 和 parent_block_id 的节点返回 true', () => {
    const dataWithBlockIds: ExportedWorkflow = {
      ...validExportedWorkflow,
      nodes: [
        {
          type: 'loop_start',
          name: '循环开始',
          config: { loop_type: 'count', max_iterations: 5 },
          order_index: 0,
          block_id: 'block-1',
        },
        {
          type: 'ai_chat',
          name: 'AI对话',
          config: {},
          order_index: 1,
          parent_block_id: 'block-1',
        },
        {
          type: 'loop_end',
          name: '循环结束',
          config: { loop_start_id: 'node-1' },
          order_index: 2,
          block_id: 'block-1',
        },
      ],
    }
    expect(validateExportedWorkflow(dataWithBlockIds)).toBe(true)
  })
})

// ========== validateExportedSettings 测试 ==========

describe('validateExportedSettings - 设定库导出数据验证', () => {
  it('应该对有效数据返回 true', () => {
    expect(validateExportedSettings(validExportedSettings)).toBe(true)
  })

  it('应该对 null 返回 false', () => {
    expect(validateExportedSettings(null)).toBe(false)
  })

  it('应该对 undefined 返回 false', () => {
    expect(validateExportedSettings(undefined)).toBe(false)
  })

  it('应该对非对象类型返回 false', () => {
    expect(validateExportedSettings('string')).toBe(false)
    expect(validateExportedSettings(123)).toBe(false)
    expect(validateExportedSettings([])).toBe(false)
  })

  it('应该对缺少 version 字段的数据返回 false', () => {
    const { version, ...rest } = validExportedSettings
    expect(validateExportedSettings(rest)).toBe(false)
  })

  it('应该对 version 不是字符串的数据返回 false', () => {
    expect(validateExportedSettings({ ...validExportedSettings, version: 123 })).toBe(false)
  })

  it('应该对缺少 exported_at 字段的数据返回 false', () => {
    const { exported_at, ...rest } = validExportedSettings
    expect(validateExportedSettings(rest)).toBe(false)
  })

  it('应该对缺少 settings 字段的数据返回 false', () => {
    const { settings, ...rest } = validExportedSettings
    expect(validateExportedSettings(rest)).toBe(false)
  })

  it('应该对 settings 不是数组的数据返回 false', () => {
    expect(validateExportedSettings({ ...validExportedSettings, settings: {} })).toBe(false)
    expect(validateExportedSettings({ ...validExportedSettings, settings: 'string' })).toBe(false)
  })

  it('应该对空 settings 数组返回 true', () => {
    expect(validateExportedSettings({ ...validExportedSettings, settings: [] })).toBe(true)
  })

  it('应该对没有 setting_prompts 字段的数据返回 true', () => {
    const { setting_prompts, ...rest } = validExportedSettings
    expect(validateExportedSettings(rest)).toBe(true)
  })

  it('应该对包含所有设定分类的数据返回 true', () => {
    const dataWithAllCategories: ExportedSettings = {
      ...validExportedSettings,
      settings: [
        { category: 'character', name: '角色', content: '内容', enabled: true, parent_id: null, order_index: 0 },
        { category: 'worldview', name: '世界观', content: '内容', enabled: true, parent_id: null, order_index: 0 },
        { category: 'style', name: '风格', content: '内容', enabled: false, parent_id: null, order_index: 0 },
        { category: 'outline', name: '大纲', content: '内容', enabled: true, parent_id: null, order_index: 0 },
      ],
    }
    expect(validateExportedSettings(dataWithAllCategories)).toBe(true)
  })
})

// ========== validateExportedProject 测试 ==========

describe('validateExportedProject - 项目导出数据验证', () => {
  it('应该对有效数据返回 true', () => {
    expect(validateExportedProject(validExportedProject)).toBe(true)
  })

  it('应该对 null 返回 false', () => {
    expect(validateExportedProject(null)).toBe(false)
  })

  it('应该对 undefined 返回 false', () => {
    expect(validateExportedProject(undefined)).toBe(false)
  })

  it('应该对非对象类型返回 false', () => {
    expect(validateExportedProject('string')).toBe(false)
    expect(validateExportedProject(123)).toBe(false)
    expect(validateExportedProject([])).toBe(false)
  })

  it('应该对缺少 version 字段的数据返回 false', () => {
    const { version, ...rest } = validExportedProject
    expect(validateExportedProject(rest)).toBe(false)
  })

  it('应该对缺少 exported_at 字段的数据返回 false', () => {
    const { exported_at, ...rest } = validExportedProject
    expect(validateExportedProject(rest)).toBe(false)
  })

  it('应该对缺少 project 字段的数据返回 false', () => {
    const { project, ...rest } = validExportedProject
    expect(validateExportedProject(rest)).toBe(false)
  })

  it('应该对缺少 workflows 字段的数据返回 false', () => {
    const { workflows, ...rest } = validExportedProject
    expect(validateExportedProject(rest)).toBe(false)
  })

  it('应该对 workflows 不是数组的数据返回 false', () => {
    expect(validateExportedProject({ ...validExportedProject, workflows: {} })).toBe(false)
  })

  it('应该对缺少 settings 字段的数据返回 false', () => {
    const { settings, ...rest } = validExportedProject
    expect(validateExportedProject(rest)).toBe(false)
  })

  it('应该对 settings 不是数组的数据返回 false', () => {
    expect(validateExportedProject({ ...validExportedProject, settings: {} })).toBe(false)
  })

  it('应该对空 workflows 和 settings 数组返回 true', () => {
    expect(validateExportedProject({
      ...validExportedProject,
      workflows: [],
      settings: [],
    })).toBe(true)
  })

  it('应该对包含多个工作流的数据返回 true', () => {
    const dataWithMultipleWorkflows: ExportedProject = {
      ...validExportedProject,
      workflows: [
        {
          workflow: { name: '工作流1', loop_max_count: 10, timeout_seconds: 300 },
          nodes: [{ type: 'start', name: '开始', config: {}, order_index: 0 }],
        },
        {
          workflow: { name: '工作流2', loop_max_count: 5, timeout_seconds: 600 },
          nodes: [
            { type: 'start', name: '开始', config: {}, order_index: 0 },
            { type: 'output', name: '输出', config: { format: 'text' }, order_index: 1 },
          ],
        },
      ],
    }
    expect(validateExportedProject(dataWithMultipleWorkflows)).toBe(true)
  })
})

// ========== exportWorkflowToFile 测试 ==========

describe('exportWorkflowToFile - 导出工作流到文件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('工作流不存在时应该抛出错误', async () => {
    vi.mocked(db.exportWorkflow).mockResolvedValueOnce(null)

    await expect(exportWorkflowToFile('non-existent-id')).rejects.toThrow('工作流不存在')
    expect(logError).toHaveBeenCalled()
  })

  it('用户取消保存对话框时应该返回 false', async () => {
    vi.mocked(db.exportWorkflow).mockResolvedValueOnce(validExportedWorkflow)
    vi.mocked(save).mockResolvedValueOnce(null)

    const result = await exportWorkflowToFile('workflow-id')

    expect(result).toBe(false)
    expect(writeTextFile).not.toHaveBeenCalled()
  })

  it('成功导出时应该返回 true', async () => {
    vi.mocked(db.exportWorkflow).mockResolvedValueOnce(validExportedWorkflow)
    vi.mocked(save).mockResolvedValueOnce('/path/to/file.json')
    vi.mocked(writeTextFile).mockResolvedValueOnce(undefined)

    const result = await exportWorkflowToFile('workflow-id')

    expect(result).toBe(true)
    expect(save).toHaveBeenCalledWith({
      title: '导出工作流',
      defaultPath: `${validExportedWorkflow.workflow.name}.json`,
      filters: expect.any(Array),
    })
    expect(writeTextFile).toHaveBeenCalledWith(
      '/path/to/file.json',
      JSON.stringify(validExportedWorkflow, null, 2)
    )
  })

  it('写入文件失败时应该抛出错误', async () => {
    vi.mocked(db.exportWorkflow).mockResolvedValueOnce(validExportedWorkflow)
    vi.mocked(save).mockResolvedValueOnce('/path/to/file.json')
    vi.mocked(writeTextFile).mockRejectedValueOnce(new Error('写入失败'))

    await expect(exportWorkflowToFile('workflow-id')).rejects.toThrow('写入失败')
    expect(logError).toHaveBeenCalled()
  })
})

// ========== importWorkflowFromFile 测试 ==========

describe('importWorkflowFromFile - 从文件导入工作流', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('用户取消选择文件时应该返回 success: false', async () => {
    vi.mocked(open).mockResolvedValueOnce(null)

    const result = await importWorkflowFromFile('project-id')

    expect(result).toEqual({ success: false })
    expect(readTextFile).not.toHaveBeenCalled()
  })

  it('文件内容不是有效 JSON 时应该抛出错误', async () => {
    vi.mocked(open).mockResolvedValueOnce('/path/to/file.json')
    vi.mocked(readTextFile).mockResolvedValueOnce('invalid json')

    await expect(importWorkflowFromFile('project-id')).rejects.toThrow()
    expect(logError).toHaveBeenCalled()
  })

  it('文件格式无效（缺少 version）时应该抛出错误', async () => {
    vi.mocked(open).mockResolvedValueOnce('/path/to/file.json')
    const invalidData = { workflow: {}, nodes: [] }
    vi.mocked(readTextFile).mockResolvedValueOnce(JSON.stringify(invalidData))

    await expect(importWorkflowFromFile('project-id')).rejects.toThrow('无效的工作流文件格式')
    expect(logError).toHaveBeenCalled()
  })

  it('文件格式无效（缺少 workflow）时应该抛出错误', async () => {
    vi.mocked(open).mockResolvedValueOnce('/path/to/file.json')
    const invalidData = { version: '1.0.0', nodes: [] }
    vi.mocked(readTextFile).mockResolvedValueOnce(JSON.stringify(invalidData))

    await expect(importWorkflowFromFile('project-id')).rejects.toThrow('无效的工作流文件格式')
  })

  it('文件格式无效（缺少 nodes）时应该抛出错误', async () => {
    vi.mocked(open).mockResolvedValueOnce('/path/to/file.json')
    const invalidData = { version: '1.0.0', workflow: {} }
    vi.mocked(readTextFile).mockResolvedValueOnce(JSON.stringify(invalidData))

    await expect(importWorkflowFromFile('project-id')).rejects.toThrow('无效的工作流文件格式')
  })

  it('成功导入时应该返回 success: true 和 workflow', async () => {
    vi.mocked(open).mockResolvedValueOnce('/path/to/file.json')
    vi.mocked(readTextFile).mockResolvedValueOnce(JSON.stringify(validExportedWorkflow))
    const mockImportedWorkflow = { id: 'new-workflow-id', name: '测试工作流' }
    vi.mocked(db.importWorkflow).mockResolvedValueOnce(mockImportedWorkflow as any)

    const result = await importWorkflowFromFile('project-id')

    expect(result).toEqual({ success: true, workflow: mockImportedWorkflow })
    expect(db.importWorkflow).toHaveBeenCalledWith('project-id', validExportedWorkflow, undefined)
  })

  it('使用自定义名称导入时应该传递 newName 参数', async () => {
    vi.mocked(open).mockResolvedValueOnce('/path/to/file.json')
    vi.mocked(readTextFile).mockResolvedValueOnce(JSON.stringify(validExportedWorkflow))
    vi.mocked(db.importWorkflow).mockResolvedValueOnce({ id: 'new-id' } as any)

    await importWorkflowFromFile('project-id', '新工作流名称')

    expect(db.importWorkflow).toHaveBeenCalledWith('project-id', validExportedWorkflow, '新工作流名称')
  })
})

// ========== exportSettingsToFile 测试 ==========

describe('exportSettingsToFile - 导出设定库到文件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('用户取消保存对话框时应该返回 false', async () => {
    vi.mocked(db.exportSettings).mockResolvedValueOnce(validExportedSettings)
    vi.mocked(save).mockResolvedValueOnce(null)

    const result = await exportSettingsToFile('project-id', '测试项目')

    expect(result).toBe(false)
    expect(writeTextFile).not.toHaveBeenCalled()
  })

  it('成功导出时应该返回 true', async () => {
    vi.mocked(db.exportSettings).mockResolvedValueOnce(validExportedSettings)
    vi.mocked(save).mockResolvedValueOnce('/path/to/settings.json')
    vi.mocked(writeTextFile).mockResolvedValueOnce(undefined)

    const result = await exportSettingsToFile('project-id', '测试项目')

    expect(result).toBe(true)
    expect(save).toHaveBeenCalledWith({
      title: '导出设定库',
      defaultPath: '测试项目_设定库.json',
      filters: expect.any(Array),
    })
    expect(writeTextFile).toHaveBeenCalledWith(
      '/path/to/settings.json',
      JSON.stringify(validExportedSettings, null, 2)
    )
  })

  it('写入文件失败时应该抛出错误', async () => {
    vi.mocked(db.exportSettings).mockResolvedValueOnce(validExportedSettings)
    vi.mocked(save).mockResolvedValueOnce('/path/to/settings.json')
    vi.mocked(writeTextFile).mockRejectedValueOnce(new Error('权限不足'))

    await expect(exportSettingsToFile('project-id', '测试项目')).rejects.toThrow('权限不足')
    expect(logError).toHaveBeenCalled()
  })
})

// ========== importSettingsFromFile 测试 ==========

describe('importSettingsFromFile - 从文件导入设定库', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('用户取消选择文件时应该返回 false', async () => {
    vi.mocked(open).mockResolvedValueOnce(null)

    const result = await importSettingsFromFile('project-id')

    expect(result).toBe(false)
    expect(readTextFile).not.toHaveBeenCalled()
  })

  it('文件格式无效（缺少 version）时应该抛出错误', async () => {
    vi.mocked(open).mockResolvedValueOnce('/path/to/settings.json')
    const invalidData = { settings: [] }
    vi.mocked(readTextFile).mockResolvedValueOnce(JSON.stringify(invalidData))

    await expect(importSettingsFromFile('project-id')).rejects.toThrow('无效的设定库文件格式')
    expect(logError).toHaveBeenCalled()
  })

  it('文件格式无效（缺少 settings）时应该抛出错误', async () => {
    vi.mocked(open).mockResolvedValueOnce('/path/to/settings.json')
    const invalidData = { version: '1.0.0' }
    vi.mocked(readTextFile).mockResolvedValueOnce(JSON.stringify(invalidData))

    await expect(importSettingsFromFile('project-id')).rejects.toThrow('无效的设定库文件格式')
  })

  it('成功导入时应该返回 true（默认 merge 模式）', async () => {
    vi.mocked(open).mockResolvedValueOnce('/path/to/settings.json')
    vi.mocked(readTextFile).mockResolvedValueOnce(JSON.stringify(validExportedSettings))
    vi.mocked(db.importSettings).mockResolvedValueOnce(undefined)

    const result = await importSettingsFromFile('project-id')

    expect(result).toBe(true)
    expect(db.importSettings).toHaveBeenCalledWith('project-id', validExportedSettings, 'merge')
  })

  it('使用 replace 模式导入时应该传递正确的模式参数', async () => {
    vi.mocked(open).mockResolvedValueOnce('/path/to/settings.json')
    vi.mocked(readTextFile).mockResolvedValueOnce(JSON.stringify(validExportedSettings))
    vi.mocked(db.importSettings).mockResolvedValueOnce(undefined)

    const result = await importSettingsFromFile('project-id', 'replace')

    expect(result).toBe(true)
    expect(db.importSettings).toHaveBeenCalledWith('project-id', validExportedSettings, 'replace')
  })
})

// ========== exportProjectToFile 测试 ==========

describe('exportProjectToFile - 导出项目备份到文件', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('项目不存在时应该抛出错误', async () => {
    vi.mocked(db.exportProject).mockResolvedValueOnce(null)

    await expect(exportProjectToFile('non-existent-id')).rejects.toThrow('项目不存在')
    expect(logError).toHaveBeenCalled()
  })

  it('用户取消保存对话框时应该返回 false', async () => {
    vi.mocked(db.exportProject).mockResolvedValueOnce(validExportedProject)
    vi.mocked(save).mockResolvedValueOnce(null)

    const result = await exportProjectToFile('project-id')

    expect(result).toBe(false)
    expect(writeTextFile).not.toHaveBeenCalled()
  })

  it('成功导出时应该返回 true', async () => {
    vi.mocked(db.exportProject).mockResolvedValueOnce(validExportedProject)
    vi.mocked(save).mockResolvedValueOnce('/path/to/project.json')
    vi.mocked(writeTextFile).mockResolvedValueOnce(undefined)

    const result = await exportProjectToFile('project-id')

    expect(result).toBe(true)
    expect(save).toHaveBeenCalledWith({
      title: '导出项目备份',
      defaultPath: `${validExportedProject.project.name}_备份.json`,
      filters: expect.any(Array),
    })
    expect(writeTextFile).toHaveBeenCalledWith(
      '/path/to/project.json',
      JSON.stringify(validExportedProject, null, 2)
    )
  })
})

// ========== importProjectFromFile 测试 ==========

describe('importProjectFromFile - 从备份文件恢复项目', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('用户取消选择文件时应该返回 success: false', async () => {
    vi.mocked(open).mockResolvedValueOnce(null)

    const result = await importProjectFromFile()

    expect(result).toEqual({ success: false })
    expect(readTextFile).not.toHaveBeenCalled()
  })

  it('文件格式无效（缺少 version）时应该抛出错误', async () => {
    vi.mocked(open).mockResolvedValueOnce('/path/to/project.json')
    const invalidData = { project: {}, workflows: [], settings: [] }
    vi.mocked(readTextFile).mockResolvedValueOnce(JSON.stringify(invalidData))

    await expect(importProjectFromFile()).rejects.toThrow('无效的项目备份文件格式')
    expect(logError).toHaveBeenCalled()
  })

  it('文件格式无效（缺少 project）时应该抛出错误', async () => {
    vi.mocked(open).mockResolvedValueOnce('/path/to/project.json')
    const invalidData = { version: '1.0.0', workflows: [], settings: [] }
    vi.mocked(readTextFile).mockResolvedValueOnce(JSON.stringify(invalidData))

    await expect(importProjectFromFile()).rejects.toThrow('无效的项目备份文件格式')
  })

  it('文件格式无效（缺少 workflows）时应该抛出错误', async () => {
    vi.mocked(open).mockResolvedValueOnce('/path/to/project.json')
    const invalidData = { version: '1.0.0', project: {}, settings: [] }
    vi.mocked(readTextFile).mockResolvedValueOnce(JSON.stringify(invalidData))

    await expect(importProjectFromFile()).rejects.toThrow('无效的项目备份文件格式')
  })

  it('文件格式无效（缺少 settings）时应该抛出错误', async () => {
    vi.mocked(open).mockResolvedValueOnce('/path/to/project.json')
    const invalidData = { version: '1.0.0', project: {}, workflows: [] }
    vi.mocked(readTextFile).mockResolvedValueOnce(JSON.stringify(invalidData))

    await expect(importProjectFromFile()).rejects.toThrow('无效的项目备份文件格式')
  })

  it('成功导入时应该返回 success: true 和 project', async () => {
    vi.mocked(open).mockResolvedValueOnce('/path/to/project.json')
    vi.mocked(readTextFile).mockResolvedValueOnce(JSON.stringify(validExportedProject))
    const mockImportedProject = { id: 'new-project-id', name: '测试项目' }
    vi.mocked(db.importProject).mockResolvedValueOnce(mockImportedProject as any)

    const result = await importProjectFromFile()

    expect(result).toEqual({ success: true, project: mockImportedProject })
    expect(db.importProject).toHaveBeenCalledWith(validExportedProject, undefined)
  })

  it('使用自定义名称导入时应该传递 newName 参数', async () => {
    vi.mocked(open).mockResolvedValueOnce('/path/to/project.json')
    vi.mocked(readTextFile).mockResolvedValueOnce(JSON.stringify(validExportedProject))
    vi.mocked(db.importProject).mockResolvedValueOnce({ id: 'new-id' } as any)

    await importProjectFromFile('新项目名称')

    expect(db.importProject).toHaveBeenCalledWith(validExportedProject, '新项目名称')
  })
})

// ========== 边界情况测试 ==========

describe('边界情况测试', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('特殊字符处理', () => {
    it('应该正确处理包含特殊字符的工作流名称', async () => {
      const workflowWithSpecialName = {
        ...validExportedWorkflow,
        workflow: {
          ...validExportedWorkflow.workflow,
          name: '测试/工作流<>:"|?*',
        },
      }
      vi.mocked(db.exportWorkflow).mockResolvedValueOnce(workflowWithSpecialName)
      vi.mocked(save).mockResolvedValueOnce('/path/to/file.json')
      vi.mocked(writeTextFile).mockResolvedValueOnce(undefined)

      const result = await exportWorkflowToFile('workflow-id')

      expect(result).toBe(true)
      expect(save).toHaveBeenCalledWith(expect.objectContaining({
        defaultPath: expect.stringContaining('测试/工作流'),
      }))
    })

    it('应该正确处理包含 Unicode 字符的设定内容', async () => {
      const settingsWithUnicode: ExportedSettings = {
        ...validExportedSettings,
        settings: [
          {
            category: 'character',
            name: '🎭 主角',
            content: '这是一个包含 emoji 😀 和特殊字符的设定：αβγδ',
            enabled: true,
            parent_id: null,
            order_index: 0,
          },
        ],
      }
      
      expect(validateExportedSettings(settingsWithUnicode)).toBe(true)
    })
  })

  describe('大数据量处理', () => {
    it('应该正确验证包含大量节点的工作流', () => {
      const nodes = Array.from({ length: 100 }, (_, i) => ({
        type: 'ai_chat' as const,
        name: `节点${i}`,
        config: {},
        order_index: i,
      }))
      
      const largeWorkflow: ExportedWorkflow = {
        ...validExportedWorkflow,
        nodes,
      }
      
      expect(validateExportedWorkflow(largeWorkflow)).toBe(true)
    })

    it('应该正确验证包含大量设定的设定库', () => {
      const settings = Array.from({ length: 200 }, (_, i) => ({
        category: 'character' as const,
        name: `角色${i}`,
        content: `这是角色${i}的详细设定，包含大量文本内容...`.repeat(10),
        enabled: true,
        parent_id: null,
        order_index: 0,
      }))
      
      const largeSettings: ExportedSettings = {
        ...validExportedSettings,
        settings,
      }
      
      expect(validateExportedSettings(largeSettings)).toBe(true)
    })
  })

  describe('空值和默认值处理', () => {
    it('应该正确处理 workflow.description 为 undefined 的情况', () => {
      const workflowWithoutDesc: ExportedWorkflow = {
        ...validExportedWorkflow,
        workflow: {
          name: '测试',
          loop_max_count: 10,
          timeout_seconds: 300,
        },
      }
      
      expect(validateExportedWorkflow(workflowWithoutDesc)).toBe(true)
    })

    it('应该正确处理 project.description 为 undefined 的情况', () => {
      const projectWithoutDesc: ExportedProject = {
        ...validExportedProject,
        project: {
          name: '测试项目',
        },
      }
      
      expect(validateExportedProject(projectWithoutDesc)).toBe(true)
    })
  })

  describe('嵌套块结构验证', () => {
    it('应该正确验证嵌套的循环和条件结构', () => {
      const nestedWorkflow: ExportedWorkflow = {
        ...validExportedWorkflow,
        nodes: [
          {
            type: 'start',
            name: '开始',
            config: {},
            order_index: 0,
          },
          {
            type: 'loop_start',
            name: '外层循环',
            config: { loop_type: 'count', max_iterations: 5 },
            order_index: 1,
            block_id: 'outer-loop',
          },
          {
            type: 'condition_if',
            name: '条件判断',
            config: { condition_type: 'keyword' },
            order_index: 2,
            block_id: 'inner-condition',
            parent_block_id: 'outer-loop',
          },
          {
            type: 'ai_chat',
            name: 'AI对话',
            config: {},
            order_index: 3,
            parent_block_id: 'inner-condition',
          },
          {
            type: 'condition_end',
            name: '条件结束',
            config: { condition_if_id: 'node-2' },
            order_index: 4,
            block_id: 'inner-condition',
            parent_block_id: 'outer-loop',
          },
          {
            type: 'loop_end',
            name: '外层循环结束',
            config: { loop_start_id: 'node-1' },
            order_index: 5,
            block_id: 'outer-loop',
          },
        ],
      }
      
      expect(validateExportedWorkflow(nestedWorkflow)).toBe(true)
    })
  })
})

// ========== 版本兼容性测试 ==========

describe('版本兼容性测试', () => {
  it('应该接受不同版本号格式的导出数据', () => {
    const versions = ['1.0.0', '2.0.0', '1.0.0-beta', '1.2.3']
    
    versions.forEach(version => {
      expect(validateExportedWorkflow({ ...validExportedWorkflow, version })).toBe(true)
      expect(validateExportedSettings({ ...validExportedSettings, version })).toBe(true)
      expect(validateExportedProject({ ...validExportedProject, version })).toBe(true)
    })
  })

  it('应该接受不同时间格式的 exported_at', () => {
    const timestamps = [
      '2024-01-01T00:00:00.000Z',
      '2024-12-31T23:59:59.999Z',
      '2024-06-15T12:30:00Z',
    ]
    
    timestamps.forEach(exported_at => {
      expect(validateExportedWorkflow({ ...validExportedWorkflow, exported_at })).toBe(true)
    })
  })
})

