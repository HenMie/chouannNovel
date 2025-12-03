/**
 * 导入/导出工具函数
 * 封装文件选择和保存的逻辑
 */
import { open, save } from '@tauri-apps/plugin-dialog'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import type { ExportedWorkflow, ExportedSettings, ExportedProject } from '@/types'
import * as db from '@/lib/db'

// 文件过滤器
const JSON_FILTERS = [
  { name: 'JSON 文件', extensions: ['json'] },
  { name: '所有文件', extensions: ['*'] },
]

/**
 * 导出工作流到文件
 */
export async function exportWorkflowToFile(workflowId: string): Promise<boolean> {
  try {
    const data = await db.exportWorkflow(workflowId)
    if (!data) {
      throw new Error('工作流不存在')
    }

    const path = await save({
      title: '导出工作流',
      defaultPath: `${data.workflow.name}.json`,
      filters: JSON_FILTERS,
    })

    if (path) {
      await writeTextFile(path, JSON.stringify(data, null, 2))
      return true
    }
    return false
  } catch (error) {
    console.error('导出工作流失败:', error)
    throw error
  }
}

/**
 * 从文件导入工作流
 */
export async function importWorkflowFromFile(
  projectId: string,
  newName?: string
): Promise<{ success: boolean; workflow?: Awaited<ReturnType<typeof db.importWorkflow>> }> {
  try {
    const path = await open({
      title: '导入工作流',
      filters: JSON_FILTERS,
      multiple: false,
    })

    if (!path) {
      return { success: false }
    }

    const content = await readTextFile(path as string)
    const data = JSON.parse(content) as ExportedWorkflow

    // 验证数据格式
    if (!data.version || !data.workflow || !data.nodes) {
      throw new Error('无效的工作流文件格式')
    }

    const workflow = await db.importWorkflow(projectId, data, newName)
    return { success: true, workflow }
  } catch (error) {
    console.error('导入工作流失败:', error)
    throw error
  }
}

/**
 * 导出设定库到文件
 */
export async function exportSettingsToFile(projectId: string, projectName: string): Promise<boolean> {
  try {
    const data = await db.exportSettings(projectId)

    const path = await save({
      title: '导出设定库',
      defaultPath: `${projectName}_设定库.json`,
      filters: JSON_FILTERS,
    })

    if (path) {
      await writeTextFile(path, JSON.stringify(data, null, 2))
      return true
    }
    return false
  } catch (error) {
    console.error('导出设定库失败:', error)
    throw error
  }
}

/**
 * 从文件导入设定库
 */
export async function importSettingsFromFile(
  projectId: string,
  mode: 'merge' | 'replace' = 'merge'
): Promise<boolean> {
  try {
    const path = await open({
      title: '导入设定库',
      filters: JSON_FILTERS,
      multiple: false,
    })

    if (!path) {
      return false
    }

    const content = await readTextFile(path as string)
    const data = JSON.parse(content) as ExportedSettings

    // 验证数据格式
    if (!data.version || !data.settings) {
      throw new Error('无效的设定库文件格式')
    }

    await db.importSettings(projectId, data, mode)
    return true
  } catch (error) {
    console.error('导入设定库失败:', error)
    throw error
  }
}

/**
 * 导出项目备份到文件
 */
export async function exportProjectToFile(projectId: string): Promise<boolean> {
  try {
    const data = await db.exportProject(projectId)
    if (!data) {
      throw new Error('项目不存在')
    }

    const path = await save({
      title: '导出项目备份',
      defaultPath: `${data.project.name}_备份.json`,
      filters: JSON_FILTERS,
    })

    if (path) {
      await writeTextFile(path, JSON.stringify(data, null, 2))
      return true
    }
    return false
  } catch (error) {
    console.error('导出项目失败:', error)
    throw error
  }
}

/**
 * 从备份文件恢复项目
 */
export async function importProjectFromFile(
  newName?: string
): Promise<{ success: boolean; project?: Awaited<ReturnType<typeof db.importProject>> }> {
  try {
    const path = await open({
      title: '导入项目备份',
      filters: JSON_FILTERS,
      multiple: false,
    })

    if (!path) {
      return { success: false }
    }

    const content = await readTextFile(path as string)
    const data = JSON.parse(content) as ExportedProject

    // 验证数据格式
    if (!data.version || !data.project || !data.workflows || !data.settings) {
      throw new Error('无效的项目备份文件格式')
    }

    const project = await db.importProject(data, newName)
    return { success: true, project }
  } catch (error) {
    console.error('导入项目失败:', error)
    throw error
  }
}

/**
 * 验证导出文件格式
 */
export function validateExportedWorkflow(data: unknown): data is ExportedWorkflow {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  return (
    typeof obj.version === 'string' &&
    typeof obj.exported_at === 'string' &&
    obj.workflow !== undefined &&
    Array.isArray(obj.nodes)
  )
}

export function validateExportedSettings(data: unknown): data is ExportedSettings {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  return (
    typeof obj.version === 'string' &&
    typeof obj.exported_at === 'string' &&
    Array.isArray(obj.settings)
  )
}

export function validateExportedProject(data: unknown): data is ExportedProject {
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  return (
    typeof obj.version === 'string' &&
    typeof obj.exported_at === 'string' &&
    obj.project !== undefined &&
    Array.isArray(obj.workflows) &&
    Array.isArray(obj.settings)
  )
}

