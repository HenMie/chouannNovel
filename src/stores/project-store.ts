import { create } from 'zustand'
import type { Project, Workflow, WorkflowNode } from '@/types'
import * as db from '@/lib/db'

// 复制的节点数据（不含 ID）
interface CopiedNode {
  type: WorkflowNode['type']
  name: string
  config: WorkflowNode['config']
}

interface ProjectState {
  // 项目列表
  projects: Project[]
  currentProject: Project | null
  isLoadingProjects: boolean

  // 工作流列表
  workflows: Workflow[]
  currentWorkflow: Workflow | null
  isLoadingWorkflows: boolean

  // 节点列表
  nodes: WorkflowNode[]
  isLoadingNodes: boolean

  // 复制的节点
  copiedNode: CopiedNode | null

  // 项目操作
  loadProjects: () => Promise<void>
  createProject: (name: string, description?: string) => Promise<Project>
  updateProject: (id: string, data: Partial<Pick<Project, 'name' | 'description'>>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  setCurrentProject: (project: Project | null) => void

  // 工作流操作
  loadWorkflows: (projectId: string) => Promise<void>
  createWorkflow: (name: string, description?: string) => Promise<Workflow | null>
  updateWorkflow: (id: string, data: Partial<Pick<Workflow, 'name' | 'description' | 'loop_max_count' | 'timeout_seconds'>>) => Promise<void>
  deleteWorkflow: (id: string) => Promise<void>
  setCurrentWorkflow: (workflow: Workflow | null) => void

  // 节点操作
  loadNodes: (workflowId: string) => Promise<void>
  createNode: (type: WorkflowNode['type'], name: string, config?: WorkflowNode['config']) => Promise<WorkflowNode | null>
  updateNode: (id: string, data: Partial<Pick<WorkflowNode, 'name' | 'config'>>) => Promise<void>
  deleteNode: (id: string) => Promise<void>
  reorderNodes: (nodeIds: string[]) => Promise<void>

  // 复制/粘贴操作
  copyNode: (node: WorkflowNode) => void
  pasteNode: () => Promise<WorkflowNode | null>
  hasCopiedNode: () => boolean
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  // 初始状态
  projects: [],
  currentProject: null,
  isLoadingProjects: false,

  workflows: [],
  currentWorkflow: null,
  isLoadingWorkflows: false,

  nodes: [],
  isLoadingNodes: false,

  copiedNode: null,

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
    })
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

  createNode: async (type, name, config) => {
    const { currentWorkflow } = get()
    if (!currentWorkflow) return null

    const node = await db.createNode(currentWorkflow.id, type, name, config)
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

  // 复制节点
  copyNode: (node) => {
    set({
      copiedNode: {
        type: node.type,
        name: node.name,
        config: JSON.parse(JSON.stringify(node.config)), // 深拷贝配置
      },
    })
  },

  // 粘贴节点
  pasteNode: async () => {
    const { currentWorkflow, copiedNode, nodes } = get()
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

  // 是否有复制的节点
  hasCopiedNode: () => {
    return get().copiedNode !== null
  },
}))

