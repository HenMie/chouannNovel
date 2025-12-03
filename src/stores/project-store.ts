import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Project, Workflow, WorkflowNode, GlobalStats, ProjectStats } from '@/types'
import * as db from '@/lib/db'

// 复制的节点数据（不含 ID）
interface CopiedNode {
  type: WorkflowNode['type']
  name: string
  config: WorkflowNode['config']
  block_id?: string          // 块 ID（用于块结构节点）
  parent_block_id?: string   // 父块 ID
}

// 批量复制的节点数据
interface CopiedNodes {
  nodes: CopiedNode[]
  sourceWorkflowId?: string  // 来源工作流 ID（用于跨工作流识别）
}

interface ProjectState {
  // 项目列表
  projects: Project[]
  currentProject: Project | null
  isLoadingProjects: boolean

  // 全局统计
  globalStats: GlobalStats | null

  // 工作流列表
  workflows: Workflow[]
  currentWorkflow: Workflow | null
  isLoadingWorkflows: boolean

  // 项目统计
  projectStats: ProjectStats | null

  // 节点列表
  nodes: WorkflowNode[]
  isLoadingNodes: boolean

  // 复制的节点（单个）
  copiedNode: CopiedNode | null
  // 批量复制的节点
  copiedNodes: CopiedNodes | null

  // 项目操作
  loadProjects: () => Promise<void>
  loadGlobalStats: () => Promise<void>
  createProject: (name: string, description?: string) => Promise<Project>
  updateProject: (id: string, data: Partial<Pick<Project, 'name' | 'description'>>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  setCurrentProject: (project: Project | null) => void

  // 工作流操作
  loadWorkflows: (projectId: string) => Promise<void>
  loadProjectStats: (projectId: string) => Promise<void>
  createWorkflow: (name: string, description?: string) => Promise<Workflow | null>
  updateWorkflow: (id: string, data: Partial<Pick<Workflow, 'name' | 'description' | 'loop_max_count' | 'timeout_seconds'>>) => Promise<void>
  deleteWorkflow: (id: string) => Promise<void>
  setCurrentWorkflow: (workflow: Workflow | null) => void

  // 节点操作
  loadNodes: (workflowId: string) => Promise<void>
  createNode: (
    type: WorkflowNode['type'], 
    name: string, 
    config?: WorkflowNode['config'],
    options?: { block_id?: string; parent_block_id?: string; insert_after_index?: number }
  ) => Promise<WorkflowNode | null>
  updateNode: (id: string, data: Partial<Pick<WorkflowNode, 'name' | 'config' | 'block_id' | 'parent_block_id'>>) => Promise<void>
  deleteNode: (id: string) => Promise<void>
  reorderNodes: (nodeIds: string[]) => Promise<void>

  // 复制/粘贴操作
  copyNode: (node: WorkflowNode) => void
  copyNodes: (nodes: WorkflowNode[]) => void
  pasteNode: () => Promise<WorkflowNode | null>
  pasteNodes: () => Promise<WorkflowNode[]>
  hasCopiedNode: () => boolean
  hasCopiedNodes: () => boolean
  getCopiedCount: () => number
  
  // 批量节点操作
  deleteNodes: (nodeIds: string[]) => Promise<void>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  // 初始状态
  projects: [],
  currentProject: null,
  isLoadingProjects: false,
  globalStats: null,

  workflows: [],
  currentWorkflow: null,
  isLoadingWorkflows: false,
  projectStats: null,

  nodes: [],
  isLoadingNodes: false,

  copiedNode: null,
  copiedNodes: null,

  // 项目操作
  loadProjects: async () => {
    set({ isLoadingProjects: true })
    try {
      const projects = await db.getProjects()
      set({ projects, isLoadingProjects: false })
    } catch (error) {
      console.error('加载项目失败:', error)
      set({ isLoadingProjects: false })
    }
  },

  loadGlobalStats: async () => {
    try {
      const globalStats = await db.getGlobalStats()
      set({ globalStats })
    } catch (error) {
      console.error('加载全局统计失败:', error)
    }
  },

  createProject: async (name, description) => {
    const project = await db.createProject(name, description)
    set((state) => ({ projects: [project, ...state.projects] }))
    return project
  },

  updateProject: async (id, data) => {
    await db.updateProject(id, data)
    set((state) => ({
      projects: state.projects.map((p) =>
        p.id === id ? { ...p, ...data, updated_at: new Date().toISOString() } : p
      ),
      currentProject:
        state.currentProject?.id === id
          ? { ...state.currentProject, ...data, updated_at: new Date().toISOString() }
          : state.currentProject,
    }))
  },

  deleteProject: async (id) => {
    await db.deleteProject(id)
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProject: state.currentProject?.id === id ? null : state.currentProject,
      workflows: state.currentProject?.id === id ? [] : state.workflows,
      currentWorkflow: state.currentProject?.id === id ? null : state.currentWorkflow,
    }))
  },

  setCurrentProject: (project) => {
    set({
      currentProject: project,
      workflows: [],
      currentWorkflow: null,
      nodes: [],
      projectStats: null,
    })
  },

  loadProjectStats: async (projectId) => {
    try {
      const projectStats = await db.getProjectStats(projectId)
      set({ projectStats })
    } catch (error) {
      console.error('加载项目统计失败:', error)
    }
  },

  // 工作流操作
  loadWorkflows: async (projectId) => {
    set({ isLoadingWorkflows: true })
    try {
      const workflows = await db.getWorkflows(projectId)
      set({ workflows, isLoadingWorkflows: false })
    } catch (error) {
      console.error('加载工作流失败:', error)
      set({ isLoadingWorkflows: false })
    }
  },

  createWorkflow: async (name, description) => {
    const { currentProject } = get()
    if (!currentProject) return null

    const workflow = await db.createWorkflow(currentProject.id, name, description)
    set((state) => ({ workflows: [workflow, ...state.workflows] }))
    return workflow
  },

  updateWorkflow: async (id, data) => {
    await db.updateWorkflow(id, data)
    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === id ? { ...w, ...data, updated_at: new Date().toISOString() } : w
      ),
      currentWorkflow:
        state.currentWorkflow?.id === id
          ? { ...state.currentWorkflow, ...data, updated_at: new Date().toISOString() }
          : state.currentWorkflow,
    }))
  },

  deleteWorkflow: async (id) => {
    await db.deleteWorkflow(id)
    set((state) => ({
      workflows: state.workflows.filter((w) => w.id !== id),
      currentWorkflow: state.currentWorkflow?.id === id ? null : state.currentWorkflow,
      nodes: state.currentWorkflow?.id === id ? [] : state.nodes,
    }))
  },

  setCurrentWorkflow: (workflow) => {
    set({ currentWorkflow: workflow, nodes: [] })
  },

  // 节点操作
  loadNodes: async (workflowId) => {
    set({ isLoadingNodes: true })
    try {
      const nodes = await db.getNodes(workflowId)
      set({ nodes, isLoadingNodes: false })
    } catch (error) {
      console.error('加载节点失败:', error)
      set({ isLoadingNodes: false })
    }
  },

  createNode: async (type, name, config, options) => {
    const { currentWorkflow } = get()
    if (!currentWorkflow) return null

    const node = await db.createNode(currentWorkflow.id, type, name, config, options)
    set((state) => ({ nodes: [...state.nodes, node] }))
    return node
  },

  updateNode: async (id, data) => {
    await db.updateNode(id, data)
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, ...data, updated_at: new Date().toISOString() } : n
      ),
    }))
  },

  deleteNode: async (id) => {
    const { nodes } = get()
    const nodeToDelete = nodes.find((n) => n.id === id)
    
    if (!nodeToDelete) {
      await db.deleteNode(id)
      set((state) => ({ nodes: state.nodes.filter((n) => n.id !== id) }))
      return
    }

    // 控制结构节点类型映射
    const blockStartTypes = ['loop_start', 'parallel_start', 'condition_if']
    const blockEndTypes = ['loop_end', 'parallel_end', 'condition_end', 'condition_else']
    
    // 如果删除的是控制结构的开始节点，需要删除整个块
    if (blockStartTypes.includes(nodeToDelete.type) && nodeToDelete.block_id) {
      const blockId = nodeToDelete.block_id
      // 找到所有属于同一块的节点
      const nodesToDelete = nodes.filter((n) => n.block_id === blockId)
      
      // 删除所有相关节点
      for (const node of nodesToDelete) {
        await db.deleteNode(node.id)
      }
      
      set((state) => ({ 
        nodes: state.nodes.filter((n) => n.block_id !== blockId) 
      }))
      return
    }
    
    // 如果删除的是控制结构的结束节点或 else 节点，也删除整个块
    if (blockEndTypes.includes(nodeToDelete.type) && nodeToDelete.block_id) {
      const blockId = nodeToDelete.block_id
      const nodesToDelete = nodes.filter((n) => n.block_id === blockId)
      
      for (const node of nodesToDelete) {
        await db.deleteNode(node.id)
      }
      
      set((state) => ({ 
        nodes: state.nodes.filter((n) => n.block_id !== blockId) 
      }))
      return
    }
    
    // 普通节点直接删除
    await db.deleteNode(id)
    set((state) => ({ nodes: state.nodes.filter((n) => n.id !== id) }))
  },

  reorderNodes: async (nodeIds) => {
    const { currentWorkflow, nodes } = get()
    if (!currentWorkflow) return

    // 乐观更新
    const newNodes = nodeIds.map((id, index) => {
      const node = nodes.find((n) => n.id === id)!
      return { ...node, order_index: index }
    })
    set({ nodes: newNodes })

    // 持久化
    await db.reorderNodes(currentWorkflow.id, nodeIds)
  },

  // 复制单个节点
  copyNode: (node) => {
    set({
      copiedNode: {
        type: node.type,
        name: node.name,
        config: JSON.parse(JSON.stringify(node.config)), // 深拷贝配置
        block_id: node.block_id,
        parent_block_id: node.parent_block_id,
      },
      copiedNodes: null, // 清除批量复制
    })
  },

  // 批量复制节点
  copyNodes: (nodes) => {
    const { currentWorkflow } = get()
    // 排除开始流程节点
    const nodesToCopy = nodes.filter(n => n.type !== 'start')
    
    if (nodesToCopy.length === 0) return
    
    set({
      copiedNode: null, // 清除单个复制
      copiedNodes: {
        nodes: nodesToCopy.map(node => ({
          type: node.type,
          name: node.name,
          config: JSON.parse(JSON.stringify(node.config)),
          block_id: node.block_id,
          parent_block_id: node.parent_block_id,
        })),
        sourceWorkflowId: currentWorkflow?.id,
      },
    })
  },

  // 粘贴单个节点
  pasteNode: async () => {
    const { currentWorkflow, copiedNode } = get()
    if (!currentWorkflow || !copiedNode) return null

    // 创建新节点，名称添加"副本"后缀
    const newName = `${copiedNode.name} (副本)`
    const node = await db.createNode(
      currentWorkflow.id,
      copiedNode.type,
      newName,
      copiedNode.config
    )

    set((state) => ({ nodes: [...state.nodes, node] }))
    return node
  },

  // 批量粘贴节点
  pasteNodes: async () => {
    const { currentWorkflow, copiedNodes, copiedNode } = get()
    if (!currentWorkflow) return []
    
    // 如果有批量复制的节点
    if (copiedNodes && copiedNodes.nodes.length > 0) {
      const createdNodes: WorkflowNode[] = []
      const isCrossWorkflow = copiedNodes.sourceWorkflowId !== currentWorkflow.id
      
      // 为跨工作流粘贴生成新的 block_id 映射
      const blockIdMap = new Map<string, string>()
      
      for (const nodeToCopy of copiedNodes.nodes) {
        // 处理块 ID（跨工作流时需要生成新的）
        let newBlockId = nodeToCopy.block_id
        let newParentBlockId = nodeToCopy.parent_block_id
        
        if (isCrossWorkflow) {
          if (nodeToCopy.block_id) {
            if (!blockIdMap.has(nodeToCopy.block_id)) {
              blockIdMap.set(nodeToCopy.block_id, db.generateId())
            }
            newBlockId = blockIdMap.get(nodeToCopy.block_id)
          }
          if (nodeToCopy.parent_block_id) {
            if (!blockIdMap.has(nodeToCopy.parent_block_id)) {
              blockIdMap.set(nodeToCopy.parent_block_id, db.generateId())
            }
            newParentBlockId = blockIdMap.get(nodeToCopy.parent_block_id)
          }
        }
        
        const newName = `${nodeToCopy.name} (副本)`
        const node = await db.createNode(
          currentWorkflow.id,
          nodeToCopy.type,
          newName,
          nodeToCopy.config,
          { block_id: newBlockId, parent_block_id: newParentBlockId }
        )
        createdNodes.push(node)
      }
      
      set((state) => ({ nodes: [...state.nodes, ...createdNodes] }))
      return createdNodes
    }
    
    // 如果只有单个复制的节点
    if (copiedNode) {
      const node = await get().pasteNode()
      return node ? [node] : []
    }
    
    return []
  },

  // 是否有复制的单个节点
  hasCopiedNode: () => {
    const { copiedNode, copiedNodes } = get()
    return copiedNode !== null || (copiedNodes !== null && copiedNodes.nodes.length > 0)
  },

  // 是否有批量复制的节点
  hasCopiedNodes: () => {
    return get().copiedNodes !== null && get().copiedNodes!.nodes.length > 0
  },

  // 获取复制的节点数量
  getCopiedCount: () => {
    const { copiedNode, copiedNodes } = get()
    if (copiedNodes && copiedNodes.nodes.length > 0) {
      return copiedNodes.nodes.length
    }
    return copiedNode ? 1 : 0
  },

  // 批量删除节点
  deleteNodes: async (nodeIds) => {
    const { nodes } = get()
    
    // 收集所有需要删除的节点（包括块结构的关联节点）
    const allNodeIdsToDelete = new Set<string>()
    const blockIdsToDelete = new Set<string>()
    
    for (const nodeId of nodeIds) {
      const node = nodes.find(n => n.id === nodeId)
      if (!node) continue
      
      // 如果是块结构节点，标记整个块
      if (node.block_id) {
        blockIdsToDelete.add(node.block_id)
      } else {
        allNodeIdsToDelete.add(nodeId)
      }
    }
    
    // 添加所有块中的节点
    for (const blockId of blockIdsToDelete) {
      const blockNodes = nodes.filter(n => n.block_id === blockId)
      blockNodes.forEach(n => allNodeIdsToDelete.add(n.id))
    }
    
    // 删除所有节点
    for (const nodeId of allNodeIdsToDelete) {
      await db.deleteNode(nodeId)
    }
    
    set((state) => ({
      nodes: state.nodes.filter(n => !allNodeIdsToDelete.has(n.id))
    }))
  },
}))

