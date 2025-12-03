import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Play,
  Pause,
  Square,
  Plus,
  MessageSquare,
  FileOutput,
  GitBranch,
  Repeat,
  Layers,
  Variable,
  Type,
  Scissors,
  AlertCircle,
  CheckCircle2,
  Clock,
  History,
  Clipboard,
  Download,
  Upload,
  MoreHorizontal,
  Save,
  RotateCcw,
  Undo2,
  Redo2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Header } from '@/components/layout/Header'
import { NodeConfigDrawer } from '@/components/node/NodeConfigDrawer'
import { WorkflowNodeTree, nodeTypeConfig } from '@/components/node/WorkflowNodeTree'
import { StreamingOutput, NodeOutputPanel } from '@/components/execution/StreamingOutput'
import { useProjectStore } from '@/stores/project-store'
import { useExecutionStore } from '@/stores/execution-store'
import { useSettingsStore } from '@/stores/settings-store'
import { getGlobalConfig, generateId, getWorkflowVersions, createWorkflowVersion, restoreWorkflowVersion } from '@/lib/db'
import { exportWorkflowToFile, importWorkflowFromFile } from '@/lib/import-export'
import type { WorkflowVersion } from '@/types'
import { useHotkeys, HOTKEY_PRESETS, useWorkflowHistory, useNodeSelection } from '@/lib/hooks'
import { toast } from 'sonner'
import type { WorkflowNode, NodeType, GlobalConfig } from '@/types'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface WorkflowPageProps {
  projectId: string
  workflowId: string
  onNavigate: (path: string) => void
}

export function WorkflowPage({ projectId, workflowId, onNavigate }: WorkflowPageProps) {
  const {
    currentWorkflow,
    nodes,
    isLoadingNodes,
    loadNodes,
    setCurrentWorkflow,
    createNode,
    deleteNode,
    deleteNodes,
    reorderNodes,
    updateNode,
    copyNode,
    copyNodes,
    pasteNode,
    pasteNodes,
    hasCopiedNode,
    getCopiedCount,
  } = useProjectStore()

  // 执行状态
  const {
    status: executionStatus,
    currentNodeIndex,
    nodeOutputs,
    finalOutput,
    error: executionError,
    startExecution,
    pauseExecution,
    resumeExecution,
    cancelExecution,
    modifyNodeOutput,
    reset: resetExecution,
  } = useExecutionStore()

  // 设定库
  const { settings, settingPrompts, loadSettings } = useSettingsStore()

  // 本地状态
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null)
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig | null>(null)
  const [initialInput, setInitialInput] = useState('')
  const [showInputDialog, setShowInputDialog] = useState(false)
  const [nodeToDelete, setNodeToDelete] = useState<string | null>(null)
  
  // 版本历史状态
  const [versions, setVersions] = useState<WorkflowVersion[]>([])
  const [showVersionDialog, setShowVersionDialog] = useState(false)
  const [versionDescription, setVersionDescription] = useState('')
  const [showRestoreDialog, setShowRestoreDialog] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<WorkflowVersion | null>(null)
  
  // 撤销/重做历史
  const history = useWorkflowHistory({ maxSize: 50 })
  
  // 多选状态
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set())
  const [nodesToDelete, setNodesToDelete] = useState<string[] | null>(null) // 批量删除确认
  
  // 派生状态
  const isRunning = executionStatus === 'running'
  const isPaused = executionStatus === 'paused'
  const isExecuting = isRunning || isPaused

  useEffect(() => {
    // 加载工作流和节点
    const loadData = async () => {
      const { workflows, loadWorkflows, currentProject } = useProjectStore.getState()
      if (workflows.length === 0 && currentProject) {
        await loadWorkflows(currentProject.id)
      }

      const workflow = useProjectStore.getState().workflows.find((w) => w.id === workflowId)
      if (workflow) {
        setCurrentWorkflow(workflow)
        loadNodes(workflow.id)
      }

      // 加载全局配置
      try {
        const config = await getGlobalConfig()
        setGlobalConfig(config)
      } catch (error) {
        console.error('加载全局配置失败:', error)
      }

      // 加载项目设定
      if (projectId) {
        await loadSettings(projectId)
      }
      
      // 加载版本历史
      if (workflowId) {
        try {
          const versionList = await getWorkflowVersions(workflowId)
          setVersions(versionList)
        } catch (error) {
          console.error('加载版本历史失败:', error)
        }
      }
    }

    loadData()

    // 组件卸载时重置执行状态
    return () => {
      resetExecution()
    }
  }, [workflowId, projectId, setCurrentWorkflow, loadNodes, resetExecution, loadSettings])

  // 添加单个节点（带历史记录）
  const handleAddNode = async (type: NodeType) => {
    const beforeNodes = [...nodes]
    const config = nodeTypeConfig[type]
    await createNode(type, `${config.label} ${nodes.length + 1}`)
    // 等待状态更新后记录历史
    const afterNodes = useProjectStore.getState().nodes
    history.pushHistory('add', beforeNodes, afterNodes, `添加节点: ${config.label}`)
  }

  // 添加块结构（开始 + 结束）（带历史记录）
  const handleAddBlock = async (blockType: 'loop' | 'parallel' | 'condition') => {
    const beforeNodes = [...nodes]
    const blockId = generateId()
    
    if (blockType === 'loop') {
      // 创建循环开始和结束节点
      await createNode('loop_start', `for 循环 ${nodes.length + 1}`, {
        loop_type: 'count',
        max_iterations: 5,
      }, { block_id: blockId })
      await createNode('loop_end', 'end for', {
        loop_start_id: blockId,
      }, { block_id: blockId })
    } else if (blockType === 'parallel') {
      // 创建并发开始和结束节点
      await createNode('parallel_start', `并发执行 ${nodes.length + 1}`, {
        concurrency: 3,
        output_mode: 'array',
      }, { block_id: blockId })
      await createNode('parallel_end', 'end 并发', {
        parallel_start_id: blockId,
      }, { block_id: blockId })
    } else if (blockType === 'condition') {
      // 创建条件分支开始、else 和结束节点
      await createNode('condition_if', `if 条件 ${nodes.length + 1}`, {
        condition_type: 'keyword',
        keywords: [],
        keyword_mode: 'any',
      }, { block_id: blockId })
      await createNode('condition_else', 'else', {
        condition_if_id: blockId,
      }, { block_id: blockId })
      await createNode('condition_end', 'end if', {
        condition_if_id: blockId,
      }, { block_id: blockId })
    }
    
    // 重新加载节点
    if (currentWorkflow) {
      await loadNodes(currentWorkflow.id)
      // 记录历史
      const afterNodes = useProjectStore.getState().nodes
      history.pushHistory('add', beforeNodes, afterNodes, `添加块结构: ${blockType}`)
    }
  }

  const handleDeleteClick = (nodeId: string) => {
    setNodeToDelete(nodeId)
  }

  // 批量删除确认
  const handleDeleteNodesClick = (nodeIds: string[]) => {
    setNodesToDelete(nodeIds)
  }

  const confirmDeleteNode = async () => {
    if (nodeToDelete) {
      const beforeNodes = [...nodes]
      await deleteNode(nodeToDelete)
      const afterNodes = useProjectStore.getState().nodes
      history.pushHistory('delete', beforeNodes, afterNodes, `删除节点`)
      setNodeToDelete(null)
    }
  }

  // 确认批量删除
  const confirmDeleteNodes = async () => {
    if (nodesToDelete && nodesToDelete.length > 0) {
      const beforeNodes = [...nodes]
      await deleteNodes(nodesToDelete)
      const afterNodes = useProjectStore.getState().nodes
      history.pushHistory('batch_delete', beforeNodes, afterNodes, `批量删除 ${nodesToDelete.length} 个节点`)
      setNodesToDelete(null)
      setSelectedNodeIds(new Set())
    }
  }

  const handleEditNode = (node: WorkflowNode) => {
    setSelectedNode(node)
    setIsConfigOpen(true)
  }

  const handleSaveNode = async (updatedNode: WorkflowNode) => {
    await updateNode(updatedNode.id, {
      name: updatedNode.name,
      config: updatedNode.config,
    })
    // 更新本地状态中的选中节点
    setSelectedNode(updatedNode)
  }

  // 检查是否有开始流程节点
  const hasStartNode = nodes.some(n => n.type === 'start')

  const handleRun = async () => {
    // 检查全局配置
    if (!globalConfig) {
      toast.error('加载配置失败，请刷新页面重试')
      return
    }

    // 检查是否有 AI 节点
    const hasAINode = nodes.some(n => n.type === 'ai_chat')
    if (hasAINode) {
      // 检查是否配置了 AI 服务
      const hasEnabledProvider = Object.values(globalConfig.ai_providers).some(
        p => p.enabled && p.api_key
      )
      if (!hasEnabledProvider) {
        toast.error('请先在设置页面配置 AI 服务')
        return
      }
    }

    // 如果有开始流程节点且没有输入，显示输入对话框
    if (hasStartNode && !initialInput) {
      setShowInputDialog(true)
      return
    }

    // 开始执行
    try {
      await startExecution(currentWorkflow!, nodes, globalConfig, initialInput, settings, settingPrompts)
    } catch (error) {
      const message = error instanceof Error ? error.message : '执行失败'
      toast.error(message)
    }
  }

  const handleStartWithInput = async () => {
    if (!globalConfig || !currentWorkflow) return
    
    setShowInputDialog(false)
    
    try {
      await startExecution(currentWorkflow, nodes, globalConfig, initialInput, settings, settingPrompts)
    } catch (error) {
      const message = error instanceof Error ? error.message : '执行失败'
      toast.error(message)
    }
  }

  const handlePause = () => {
    pauseExecution()
  }

  const handleResume = () => {
    resumeExecution()
  }

  const handleStop = () => {
    cancelExecution()
    setInitialInput('')
  }

  // 复制节点
  const handleCopyNode = (node: WorkflowNode) => {
    copyNode(node)
    toast.success('节点已复制')
  }

  // 批量复制节点
  const handleCopyNodes = (nodesToCopy: WorkflowNode[]) => {
    copyNodes(nodesToCopy)
    toast.success(`已复制 ${nodesToCopy.length} 个节点`)
  }

  // 粘贴节点
  const handlePasteNode = async () => {
    if (!hasCopiedNode()) {
      toast.error('剪贴板为空')
      return
    }
    const beforeNodes = [...nodes]
    const copiedCount = getCopiedCount()
    
    if (copiedCount > 1) {
      // 批量粘贴
      const newNodes = await pasteNodes()
      if (newNodes.length > 0) {
        const afterNodes = useProjectStore.getState().nodes
        history.pushHistory('add', beforeNodes, afterNodes, `粘贴 ${newNodes.length} 个节点`)
        toast.success(`已粘贴 ${newNodes.length} 个节点`)
      }
    } else {
      // 单个粘贴
      const newNode = await pasteNode()
      if (newNode) {
        const afterNodes = useProjectStore.getState().nodes
        history.pushHistory('add', beforeNodes, afterNodes, `粘贴节点: ${newNode.name}`)
        toast.success('节点已粘贴')
      }
    }
  }

  // 撤销操作
  const handleUndo = async () => {
    if (!history.canUndo) return
    
    const previousNodes = history.undo()
    if (previousNodes && currentWorkflow) {
      // 恢复节点状态到数据库
      // 这里需要重新同步节点列表
      // 简化处理：重新加载工作流
      await loadNodes(currentWorkflow.id)
      toast.info('已撤销')
    }
  }

  // 重做操作
  const handleRedo = async () => {
    if (!history.canRedo) return
    
    const nextNodes = history.redo()
    if (nextNodes && currentWorkflow) {
      await loadNodes(currentWorkflow.id)
      toast.info('已重做')
    }
  }

  // 节点重排序（带历史记录）
  const handleReorderNodes = async (nodeIds: string[]) => {
    const beforeNodes = [...nodes]
    await reorderNodes(nodeIds)
    const afterNodes = useProjectStore.getState().nodes
    history.pushHistory('reorder', beforeNodes, afterNodes, '重新排序节点')
  }

  // 导出工作流
  const handleExportWorkflow = async () => {
    if (!currentWorkflow) return
    try {
      const success = await exportWorkflowToFile(currentWorkflow.id)
      if (success) {
        toast.success('工作流导出成功')
      }
    } catch (error) {
      toast.error('导出失败: ' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  // 导入工作流
  const handleImportWorkflow = async () => {
    try {
      const result = await importWorkflowFromFile(projectId)
      if (result.success && result.workflow) {
        toast.success('工作流导入成功')
        onNavigate(`/project/${projectId}/workflow/${result.workflow.id}`)
      }
    } catch (error) {
      toast.error('导入失败: ' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  // 保存版本
  const handleSaveVersion = async () => {
    if (!currentWorkflow) return
    try {
      const version = await createWorkflowVersion(currentWorkflow.id, versionDescription || undefined)
      setVersions([version, ...versions])
      setShowVersionDialog(false)
      setVersionDescription('')
      toast.success(`已保存为版本 ${version.version_number}`)
    } catch (error) {
      toast.error('保存版本失败: ' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  // 恢复版本
  const handleRestoreVersion = async () => {
    if (!selectedVersion) return
    try {
      await restoreWorkflowVersion(selectedVersion.id)
      // 重新加载节点
      if (currentWorkflow) {
        await loadNodes(currentWorkflow.id)
      }
      setShowRestoreDialog(false)
      setSelectedVersion(null)
      toast.success(`已恢复到版本 ${selectedVersion.version_number}`)
    } catch (error) {
      toast.error('恢复版本失败: ' + (error instanceof Error ? error.message : '未知错误'))
    }
  }

  // 快捷键配置
  useHotkeys([
    // Ctrl+Enter: 运行工作流
    HOTKEY_PRESETS.run(() => {
      if (!isExecuting && nodes.length > 0) {
        handleRun()
      }
    }, !isExecuting && nodes.length > 0),
    
    // Space: 暂停/继续执行
    HOTKEY_PRESETS.togglePause(() => {
      if (isRunning) {
        pauseExecution()
        toast.info('已暂停执行')
      } else if (isPaused) {
        resumeExecution()
        toast.info('继续执行')
      }
    }, isExecuting && !showInputDialog),
    
    // Escape: 停止执行或关闭对话框/清除选择
    HOTKEY_PRESETS.escape(() => {
      if (showInputDialog) {
        setShowInputDialog(false)
      } else if (isConfigOpen) {
        setIsConfigOpen(false)
        setSelectedNode(null)
      } else if (selectedNodeIds.size > 0) {
        // 清除多选
        setSelectedNodeIds(new Set())
      } else if (isExecuting) {
        cancelExecution()
        setInitialInput('')
        toast.info('已停止执行')
      }
    }),

    // Ctrl+V: 粘贴节点
    HOTKEY_PRESETS.paste(() => {
      if (!isExecuting && hasCopiedNode()) {
        handlePasteNode()
      }
    }, !isExecuting),

    // Ctrl+Z: 撤销
    {
      key: 'z',
      ctrl: true,
      shift: false,
      handler: () => {
        if (!isExecuting && history.canUndo) {
          handleUndo()
        }
      },
      enabled: !isExecuting,
    },

    // Ctrl+Shift+Z / Ctrl+Y: 重做
    {
      key: 'z',
      ctrl: true,
      shift: true,
      handler: () => {
        if (!isExecuting && history.canRedo) {
          handleRedo()
        }
      },
      enabled: !isExecuting,
    },
    {
      key: 'y',
      ctrl: true,
      handler: () => {
        if (!isExecuting && history.canRedo) {
          handleRedo()
        }
      },
      enabled: !isExecuting,
    },

    // Ctrl+A: 全选节点
    {
      key: 'a',
      ctrl: true,
      handler: (e) => {
        if (!isExecuting && !isConfigOpen && !showInputDialog) {
          e.preventDefault()
          const selectableNodes = nodes.filter(n => n.type !== 'start')
          setSelectedNodeIds(new Set(selectableNodes.map(n => n.id)))
        }
      },
      enabled: !isExecuting && !isConfigOpen && !showInputDialog,
    },

    // Delete / Backspace: 删除选中的节点
    {
      key: 'Delete',
      handler: () => {
        if (!isExecuting && selectedNodeIds.size > 0) {
          handleDeleteNodesClick(Array.from(selectedNodeIds))
        }
      },
      enabled: !isExecuting && selectedNodeIds.size > 0,
    },
    {
      key: 'Backspace',
      handler: () => {
        if (!isExecuting && selectedNodeIds.size > 0) {
          handleDeleteNodesClick(Array.from(selectedNodeIds))
        }
      },
      enabled: !isExecuting && selectedNodeIds.size > 0,
    },

    // Ctrl+C: 复制选中的节点
    {
      key: 'c',
      ctrl: true,
      handler: () => {
        if (!isExecuting && selectedNodeIds.size > 0) {
          const selectedNodes = nodes.filter(n => selectedNodeIds.has(n.id))
          handleCopyNodes(selectedNodes)
        }
      },
      enabled: !isExecuting && selectedNodeIds.size > 0,
    },
  ])

  if (!currentWorkflow) {
    return (
      <div className="flex h-full flex-col bg-background">
        <div className="flex h-14 items-center border-b px-4 gap-4">
          <Skeleton className="h-4 w-4 rounded-full" />
          <div className="flex flex-1 items-center gap-2">
            <Skeleton className="h-5 w-32" />
          </div>
          <div className="flex items-center gap-2">
             <Skeleton className="h-9 w-24" />
             <Skeleton className="h-9 w-20" />
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col min-w-0">
             <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2 h-[53px]">
               <Skeleton className="h-5 w-20" />
               <div className="flex gap-2">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-24" />
               </div>
             </div>
             <div className="flex-1 bg-muted/10 p-4">
                <div className="space-y-3 max-w-3xl mx-auto">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Card key={i} className="h-[72px] flex items-center p-3">
                      <div className="flex items-center gap-3 w-full">
                        <Skeleton className="h-9 w-9 rounded-lg" />
                        <div className="flex-1 space-y-2">
                           <Skeleton className="h-4 w-1/3" />
                           <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
             </div>
          </div>
          <div className="w-[1px] bg-border" />
          <div className="flex w-96 flex-col border-l bg-background">
             <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2 h-[53px]">
               <Skeleton className="h-5 w-20" />
             </div>
             <div className="flex-1 p-4 space-y-4">
                <Skeleton className="h-32 w-full rounded-lg" />
                <Skeleton className="h-32 w-full rounded-lg" />
             </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <Header
        title={currentWorkflow.name}
        breadcrumbs={[
          { label: '首页', href: '/' },
          { label: '项目', href: `/project/${projectId}` },
          { label: currentWorkflow.name },
        ]}
        onNavigate={onNavigate}
      >
        {/* 执行控制按钮 */}
        <div className="flex items-center gap-2">
          {/* 更多操作菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExportWorkflow}>
                <Upload className="mr-2 h-4 w-4" />
                导出工作流
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleImportWorkflow}>
                <Download className="mr-2 h-4 w-4" />
                导入工作流
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowVersionDialog(true)}>
                <Save className="mr-2 h-4 w-4" />
                保存版本
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger disabled={versions.length === 0}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  恢复版本
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
                  {versions.length === 0 ? (
                    <DropdownMenuItem disabled>暂无历史版本</DropdownMenuItem>
                  ) : (
                    versions.slice(0, 10).map((version) => (
                      <DropdownMenuItem
                        key={version.id}
                        onClick={() => {
                          setSelectedVersion(version)
                          setShowRestoreDialog(true)
                        }}
                      >
                        <div className="flex flex-col">
                          <span>版本 {version.version_number}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(version.created_at).toLocaleString()}
                            {version.description && ` - ${version.description}`}
                          </span>
                        </div>
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 执行历史按钮 */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onNavigate(`/project/${projectId}/workflow/${workflowId}/history`)}
          >
            <History className="mr-2 h-4 w-4" />
            执行历史
          </Button>
          
          {!isExecuting ? (
            <Button size="sm" onClick={handleRun} disabled={nodes.length === 0}>
              <Play className="mr-2 h-4 w-4" />
              运行
            </Button>
          ) : (
            <>
              {isPaused ? (
                <Button size="sm" variant="outline" onClick={handleResume}>
                  <Play className="mr-2 h-4 w-4" />
                  继续
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={handlePause}>
                  <Pause className="mr-2 h-4 w-4" />
                  暂停
                </Button>
              )}
              <Button size="sm" variant="destructive" onClick={handleStop}>
                <Square className="mr-2 h-4 w-4" />
                停止
              </Button>
            </>
          )}
        </div>
      </Header>

      <div className="flex flex-1 overflow-hidden">
        {/* 节点列表区域 */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
            <span className="text-sm font-medium">节点列表</span>
            <div className="flex items-center gap-2">
              {/* 撤销/重做按钮 */}
              <div className="flex items-center gap-0.5 mr-2">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleUndo}
                      disabled={!history.canUndo || isExecuting}
                      className="h-8 w-8 p-0"
                    >
                      <Undo2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>撤销 (Ctrl+Z)</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleRedo}
                      disabled={!history.canRedo || isExecuting}
                      className="h-8 w-8 p-0"
                    >
                      <Redo2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>重做 (Ctrl+Shift+Z)</TooltipContent>
                </Tooltip>
              </div>
              
              {/* 粘贴按钮 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handlePasteNode}
                    disabled={!hasCopiedNode()}
                  >
                    <Clipboard className="mr-2 h-4 w-4" />
                    粘贴{getCopiedCount() > 1 ? ` (${getCopiedCount()})` : ''}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>粘贴节点 (Ctrl+V)</TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    添加节点
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {/* 基础节点 */}
                  <DropdownMenuItem onClick={() => handleAddNode('output')}>
                    <FileOutput className="mr-2 h-4 w-4 text-red-500" />
                    <span>输出节点</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  
                  {/* AI 节点 */}
                  <DropdownMenuItem onClick={() => handleAddNode('ai_chat')}>
                    <MessageSquare className="mr-2 h-4 w-4 text-violet-500" />
                    <span>AI 对话</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  
                  {/* 文本处理 */}
                  <DropdownMenuItem onClick={() => handleAddNode('text_extract')}>
                    <Scissors className="mr-2 h-4 w-4 text-orange-500" />
                    <span>内容提取</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddNode('text_concat')}>
                    <Type className="mr-2 h-4 w-4 text-cyan-500" />
                    <span>文本拼接</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  
                  {/* 控制结构 - 带开始/结束的块 */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Repeat className="mr-2 h-4 w-4 text-pink-500" />
                      <span>控制结构</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuItem onClick={() => handleAddBlock('loop')}>
                        <Repeat className="mr-2 h-4 w-4 text-pink-500" />
                        <span>for 循环</span>
                        <span className="ml-auto text-xs text-muted-foreground">开始...结束</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleAddBlock('condition')}>
                        <GitBranch className="mr-2 h-4 w-4 text-yellow-500" />
                        <span>if 条件分支</span>
                        <span className="ml-auto text-xs text-muted-foreground">if...else...end</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleAddBlock('parallel')}>
                        <Layers className="mr-2 h-4 w-4 text-indigo-500" />
                        <span>并发执行</span>
                        <span className="ml-auto text-xs text-muted-foreground">开始...结束</span>
                      </DropdownMenuItem>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  
                  {/* 变量 */}
                  <DropdownMenuItem onClick={() => handleAddNode('var_set')}>
                    <Variable className="mr-2 h-4 w-4 text-emerald-500" />
                    <span>设置变量</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAddNode('var_get')}>
                    <Variable className="mr-2 h-4 w-4 text-teal-500" />
                    <span>读取变量</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <ScrollArea className="flex-1 bg-muted/5">
            <div className="p-4">
              {isLoadingNodes ? (
                <div className="space-y-2 max-w-4xl mx-auto border rounded-lg bg-card overflow-hidden">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0">
                      <Skeleton className="h-4 w-8" />
                      <Skeleton className="h-5 w-5 rounded" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-3 w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="max-w-4xl mx-auto">
                  <WorkflowNodeTree
                    nodes={nodes}
                    selectedNodeId={selectedNode?.id}
                    runningNodeId={
                      nodeOutputs.find(o => o.isRunning)?.nodeId ||
                      (isExecuting && currentNodeIndex !== null && currentNodeIndex >= 0 && currentNodeIndex < nodes.length
                        ? nodes[currentNodeIndex]?.id
                        : undefined)
                    }
                    onSelectNode={handleEditNode}
                    onDeleteNode={handleDeleteClick}
                    onCopyNode={handleCopyNode}
                    onCopyNodes={handleCopyNodes}
                    onDeleteNodes={handleDeleteNodesClick}
                    onReorderNodes={handleReorderNodes}
                    disabled={isExecuting}
                    selectedNodeIds={selectedNodeIds}
                    onSelectionChange={setSelectedNodeIds}
                  />
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* 输出面板 */}
        <Separator orientation="vertical" />
        <div className="flex w-96 flex-col border-l bg-background overflow-hidden">
          <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
            <span className="text-sm font-medium">执行输出</span>
            {/* 执行状态指示器 */}
            {executionStatus === 'running' && (
              <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                执行中...
              </span>
            )}
            {executionStatus === 'paused' && (
              <span className="flex items-center gap-1 text-xs font-medium text-yellow-500">
                <Pause className="h-3 w-3" />
                已暂停
              </span>
            )}
            {executionStatus === 'completed' && (
              <span className="flex items-center gap-1 text-xs font-medium text-green-500">
                <CheckCircle2 className="h-3 w-3" />
                完成
              </span>
            )}
            {executionStatus === 'failed' && (
              <span className="flex items-center gap-1 text-xs font-medium text-red-500">
                <AlertCircle className="h-3 w-3" />
                失败
              </span>
            )}
            {executionStatus === 'timeout' && (
              <span className="flex items-center gap-1 text-xs font-medium text-orange-500">
                <Clock className="h-3 w-3" />
                超时
              </span>
            )}
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-4 p-4">
              {/* 节点输出列表 */}
              {nodeOutputs.map((output) => (
                <NodeOutputPanel
                  key={output.nodeId}
                  nodeId={output.nodeId}
                  nodeName={output.nodeName}
                  nodeType={nodeTypeConfig[output.nodeType as NodeType]?.label || output.nodeType}
                  output={output.output}
                  isRunning={output.isRunning}
                  isStreaming={output.isStreaming}
                  canEdit={isPaused}
                  onEdit={modifyNodeOutput}
                  resolvedConfig={output.resolvedConfig}
                />
              ))}
              
              {/* 最终输出 */}
              {executionStatus === 'completed' && finalOutput && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border-2 border-primary bg-card overflow-hidden shadow-sm"
                >
                  <div className="flex items-center gap-2 border-b bg-primary/5 px-4 py-2">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    <span className="text-sm font-medium">最终输出</span>
                  </div>
                  <StreamingOutput content={finalOutput} className="max-h-[400px] p-4" />
                </motion.div>
              )}

              {/* 错误信息 */}
              {executionError && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/20"
                >
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    <span className="font-medium text-sm">执行错误</span>
                  </div>
                  <p className="mt-2 text-sm text-red-600/90 dark:text-red-400/90 break-words">
                    {executionError}
                  </p>
                </motion.div>
              )}

              {/* 空状态 */}
              {nodeOutputs.length === 0 && !executionError && (
                <EmptyState
                  icon={Play}
                  title="暂无输出"
                  description="运行工作流后，输出将显示在这里"
                />
              )}
            </div>
          </ScrollArea>
        </div>
      </div>

      {/* 输入对话框 */}
      <Dialog open={showInputDialog} onOpenChange={setShowInputDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>输入内容</DialogTitle>
            <DialogDescription>
              请输入工作流的初始输入内容
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              value={initialInput}
              onChange={(e) => setInitialInput(e.target.value)}
              placeholder="请输入要处理的内容..."
              rows={6}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInputDialog(false)}>
              取消
            </Button>
            <Button onClick={handleStartWithInput}>
              <Play className="mr-2 h-4 w-4" />
              开始执行
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={!!nodeToDelete} onOpenChange={(open) => !open && setNodeToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {(() => {
                const node = nodes.find(n => n.id === nodeToDelete)
                const blockTypes = ['loop_start', 'loop_end', 'parallel_start', 'parallel_end', 'condition_if', 'condition_else', 'condition_end']
                if (node && blockTypes.includes(node.type)) {
                  return '确定要删除这个控制结构吗？'
                }
                return '确定要删除这个节点吗？'
              })()}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const node = nodes.find(n => n.id === nodeToDelete)
                const blockTypes = ['loop_start', 'loop_end', 'parallel_start', 'parallel_end', 'condition_if', 'condition_else', 'condition_end']
                if (node && blockTypes.includes(node.type) && node.block_id) {
                  const blockNodes = nodes.filter(n => n.block_id === node.block_id)
                  return `此操作将删除整个控制结构块（共 ${blockNodes.length} 个节点），包括块内的所有节点。删除后可通过 Ctrl+Z 撤销。`
                }
                return '删除后可通过 Ctrl+Z 撤销操作。'
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteNode} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 批量删除确认对话框 */}
      <AlertDialog open={!!nodesToDelete} onOpenChange={(open) => !open && setNodesToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确定要删除这些节点吗？</AlertDialogTitle>
            <AlertDialogDescription>
              您选择了 {nodesToDelete?.length || 0} 个节点进行删除。删除后可通过 Ctrl+Z 撤销操作。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteNodes} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除 {nodesToDelete?.length || 0} 个节点
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 节点配置抽屉 */}
      <NodeConfigDrawer
        node={selectedNode}
        nodes={nodes}
        projectId={projectId}
        open={isConfigOpen}
        onClose={() => {
          setIsConfigOpen(false)
          setSelectedNode(null)
        }}
        onSave={handleSaveNode}
      />

      {/* 保存版本对话框 */}
      <Dialog open={showVersionDialog} onOpenChange={setShowVersionDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>保存版本</DialogTitle>
            <DialogDescription>
              创建当前工作流的版本快照，可以在将来恢复到此状态
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Textarea
              value={versionDescription}
              onChange={(e) => setVersionDescription(e.target.value)}
              placeholder="版本描述（可选）..."
              rows={3}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVersionDialog(false)}>
              取消
            </Button>
            <Button onClick={handleSaveVersion}>
              <Save className="mr-2 h-4 w-4" />
              保存版本
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 恢复版本确认对话框 */}
      <AlertDialog open={showRestoreDialog} onOpenChange={setShowRestoreDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认恢复版本？</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedVersion && (
                <>
                  将恢复到版本 {selectedVersion.version_number}
                  （创建于 {new Date(selectedVersion.created_at).toLocaleString()}）
                  {selectedVersion.description && (
                    <>
                      <br />
                      <span className="font-medium">描述：</span>{selectedVersion.description}
                    </>
                  )}
                  <br /><br />
                  <span className="text-destructive">
                    警告：当前的工作流内容将被覆盖，建议先保存当前版本。
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedVersion(null)}>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestoreVersion}>
              确认恢复
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
