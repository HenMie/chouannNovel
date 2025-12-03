import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GripVertical,
  Trash2,
  Settings,
  MessageSquare,
  FileInput,
  FileOutput,
  Repeat,
  GitBranch,
  Layers,
  Variable,
  Type,
  Scissors,
  Copy,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  Plus,
} from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  DropAnimation,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { WorkflowNode, NodeType, AIChatConfig, LoopStartConfig, ConditionIfConfig, VarSetConfig, VarGetConfig, TextExtractConfig, TextConcatConfig, ParallelStartConfig } from '@/types'

// 节点类型配置
const nodeTypeConfig: Record<
  NodeType,
  { 
    label: string
    icon: React.ComponentType<{ className?: string }>
    color: string
    bgColor: string
    textColor: string
    isBlockStart?: boolean
    isBlockEnd?: boolean
    blockType?: 'loop' | 'parallel' | 'condition'
  }
> = {
  input: { label: '输入', icon: FileInput, color: 'text-green-600', bgColor: 'bg-green-500', textColor: 'text-green-700' },
  output: { label: '输出', icon: FileOutput, color: 'text-red-600', bgColor: 'bg-red-500', textColor: 'text-red-700' },
  ai_chat: { label: 'AI 对话', icon: MessageSquare, color: 'text-violet-600', bgColor: 'bg-violet-500', textColor: 'text-violet-700' },
  text_extract: { label: '内容提取', icon: Scissors, color: 'text-orange-600', bgColor: 'bg-orange-500', textColor: 'text-orange-700' },
  text_concat: { label: '文本拼接', icon: Type, color: 'text-cyan-600', bgColor: 'bg-cyan-500', textColor: 'text-cyan-700' },
  var_set: { label: '设置变量', icon: Variable, color: 'text-emerald-600', bgColor: 'bg-emerald-500', textColor: 'text-emerald-700' },
  var_get: { label: '读取变量', icon: Variable, color: 'text-teal-600', bgColor: 'bg-teal-500', textColor: 'text-teal-700' },
  // 循环块
  loop_start: { 
    label: 'For 循环', 
    icon: Repeat, 
    color: 'text-pink-600', 
    bgColor: 'bg-pink-500',
    textColor: 'text-pink-700',
    isBlockStart: true,
    blockType: 'loop'
  },
  loop_end: { 
    label: '循环结束标记', 
    icon: CornerDownRight, 
    color: 'text-pink-600', 
    bgColor: 'bg-pink-500',
    textColor: 'text-pink-700',
    isBlockEnd: true,
    blockType: 'loop'
  },
  // 并发块
  parallel_start: { 
    label: '并发执行', 
    icon: Layers, 
    color: 'text-indigo-600', 
    bgColor: 'bg-indigo-500',
    textColor: 'text-indigo-700',
    isBlockStart: true,
    blockType: 'parallel'
  },
  parallel_end: { 
    label: '并发结束标记', 
    icon: CornerDownRight, 
    color: 'text-indigo-600', 
    bgColor: 'bg-indigo-500',
    textColor: 'text-indigo-700',
    isBlockEnd: true,
    blockType: 'parallel'
  },
  // 条件分支
  condition_if: { 
    label: 'IF 条件', 
    icon: GitBranch, 
    color: 'text-yellow-600', 
    bgColor: 'bg-yellow-500',
    textColor: 'text-yellow-700',
    isBlockStart: true,
    blockType: 'condition'
  },
  condition_else: { 
    label: 'Else', 
    icon: GitBranch, 
    color: 'text-yellow-600', 
    bgColor: 'bg-yellow-500',
    textColor: 'text-yellow-700',
    blockType: 'condition'
  },
  condition_end: { 
    label: 'End IF', 
    icon: CornerDownRight, 
    color: 'text-yellow-600', 
    bgColor: 'bg-yellow-500',
    textColor: 'text-yellow-700',
    isBlockEnd: true,
    blockType: 'condition'
  },
  // 旧类型
  condition: { label: '条件判断', icon: GitBranch, color: 'text-yellow-600', bgColor: 'bg-yellow-500', textColor: 'text-yellow-700' },
  loop: { label: '循环', icon: Repeat, color: 'text-pink-600', bgColor: 'bg-pink-500', textColor: 'text-pink-700' },
  batch: { label: '批量执行', icon: Layers, color: 'text-indigo-600', bgColor: 'bg-indigo-500', textColor: 'text-indigo-700' },
}

// 块线条颜色
const blockLineColors: Record<string, string> = {
  loop: 'bg-pink-300',
  parallel: 'bg-indigo-300',
  condition: 'bg-yellow-300',
}

// 变量标签组件
function Tag({ children, color = 'blue' }: { children: React.ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    pink: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
    yellow: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    cyan: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
    red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  }
  
  return (
    <span className={cn(
      'inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium',
      colors[color] || colors.blue
    )}>
      {children}
    </span>
  )
}

// 输入来源描述
function getInputSourceDesc(source?: string, variable?: string): React.ReactNode {
  if (source === 'variable' && variable) {
    return <Tag color="green">{variable}</Tag>
  }
  return <Tag color="gray">上一节点输出</Tag>
}

// 生成节点描述
function getNodeDescription(node: WorkflowNode): React.ReactNode {
  const config = node.config as any
  
  switch (node.type) {
    case 'input':
      return (
        <span className="text-muted-foreground">
          接收用户输入
          {config?.default_value && (
            <>，默认值为 <Tag color="blue">{config.default_value}</Tag></>
          )}
        </span>
      )
    
    case 'output':
      return (
        <span className="text-muted-foreground">
          输出 {getInputSourceDesc('previous')} 的结果
        </span>
      )
    
    case 'ai_chat': {
      const aiConfig = config as AIChatConfig
      const userPrompt = (aiConfig?.user_prompt || '{{上一节点}}').trim()
      let inputDesc: React.ReactNode = <Tag color="gray">上一节点输出</Tag>
      
      if (userPrompt && userPrompt !== '{{上一节点}}') {
        const preview = userPrompt.length > 20 ? `${userPrompt.slice(0, 20)}...` : userPrompt
        inputDesc = <Tag color="blue">{preview}</Tag>
      }
      
      return (
        <span className="text-muted-foreground">
          使用 <Tag color="purple">{aiConfig?.provider || 'AI'}</Tag> 的 <Tag color="purple">{aiConfig?.model || '模型'}</Tag> 处理 {inputDesc}
          {aiConfig?.system_prompt && (
            <span className="ml-1 text-xs opacity-60">（含系统提示词）</span>
          )}
          {aiConfig?.enable_history && <span className="ml-1 text-xs opacity-60">（带对话历史）</span>}
        </span>
      )
    }
    
    case 'var_set': {
      const varConfig = config as VarSetConfig
      const valueDesc = varConfig?.value_source === 'previous' 
        ? <Tag color="gray">上一节点输出</Tag>
        : varConfig?.custom_value 
        ? <Tag color="blue">{varConfig.custom_value.slice(0, 30)}{varConfig.custom_value.length > 30 ? '...' : ''}</Tag>
        : <Tag color="gray">空值</Tag>
      
      return (
        <span className="text-muted-foreground">
          设置字符串变量 <Tag color="green">{varConfig?.variable_name || '未命名'}</Tag> = {valueDesc}
        </span>
      )
    }
    
    case 'var_get': {
      const varConfig = config as VarGetConfig
      return (
        <span className="text-muted-foreground">
          读取变量 <Tag color="green">{varConfig?.variable_name || '未命名'}</Tag> 的值作为当前输出
        </span>
      )
    }
    
    case 'loop_start': {
      const loopConfig = config as LoopStartConfig
      if (loopConfig?.loop_type === 'count') {
        return (
          <span className="text-muted-foreground">
            从 <Tag color="pink">1</Tag> 开始到 <Tag color="pink">{loopConfig?.max_iterations || 5}</Tag> 结束，递增值为 <Tag color="pink">1</Tag>，将当前循环值保存到 <Tag color="green">loop_index</Tag>
          </span>
        )
      } else {
        // 条件循环
        const condType = loopConfig?.condition_type
        let condDesc: React.ReactNode = '满足条件'
        
        if (condType === 'keyword') {
          const mode = loopConfig?.keyword_mode === 'any' ? '包含任一' 
            : loopConfig?.keyword_mode === 'all' ? '包含全部' 
            : '不包含'
          const keywords = (loopConfig?.keywords || []).join(', ') || '...'
          condDesc = <><Tag color="yellow">{mode}</Tag> 关键词 <Tag color="orange">{keywords}</Tag></>
        } else if (condType === 'length') {
          condDesc = <>文本长度 <Tag color="yellow">{loopConfig?.length_operator || '>'}</Tag> <Tag color="orange">{loopConfig?.length_value || 0}</Tag></>
        } else if (condType === 'regex') {
          condDesc = <>匹配正则 <Tag color="orange">{loopConfig?.regex_pattern || '...'}</Tag></>
        } else if (condType === 'ai_judge') {
          condDesc = <><Tag color="purple">AI 智能判断</Tag></>
        }
        
        return (
          <span className="text-muted-foreground">
            当 {getInputSourceDesc(loopConfig?.condition_source, loopConfig?.condition_variable)} {condDesc} 时继续循环，最多 <Tag color="pink">{loopConfig?.max_iterations || 5}</Tag> 次
          </span>
        )
      }
    }
    
    case 'loop_end':
      return (
        <span className="text-muted-foreground">
          表示一个循环区域的结尾
        </span>
      )
    
    case 'parallel_start': {
      const parallelConfig = config as ParallelStartConfig
      const outputMode = parallelConfig?.output_mode === 'array' ? '数组格式' : '拼接文本'
      return (
        <span className="text-muted-foreground">
          并发执行以下任务，并发数 <Tag color="purple">{parallelConfig?.concurrency || 3}</Tag>，输出为 <Tag color="cyan">{outputMode}</Tag>
        </span>
      )
    }
    
    case 'parallel_end':
      return (
        <span className="text-muted-foreground">
          并发任务结束，合并所有结果
        </span>
      )
    
    case 'condition_if': {
      const condConfig = config as ConditionIfConfig
      const inputDesc = getInputSourceDesc(condConfig?.input_source, condConfig?.input_variable)
      
      let conditionDesc: React.ReactNode
      
      switch (condConfig?.condition_type) {
        case 'keyword': {
          const modeText = condConfig?.keyword_mode === 'any' ? '包含任一关键词' 
            : condConfig?.keyword_mode === 'all' ? '包含全部关键词' 
            : '不包含任何关键词'
          const keywords = (condConfig?.keywords || []).join(', ') || '未设置'
          conditionDesc = (
            <>
              <Tag color="yellow">{modeText}</Tag> <Tag color="orange">{keywords}</Tag>
            </>
          )
          break
        }
        case 'length': {
          const opText: Record<string, string> = {
            '>': '大于', '<': '小于', '=': '等于', '>=': '大于等于', '<=': '小于等于'
          }
          conditionDesc = (
            <>
              文本长度 <Tag color="yellow">{opText[condConfig?.length_operator || '>'] || '>'}</Tag> <Tag color="orange">{condConfig?.length_value || 0}</Tag>
            </>
          )
          break
        }
        case 'regex':
          conditionDesc = (
            <>
              <Tag color="yellow">匹配正则</Tag> <Tag color="orange">{condConfig?.regex_pattern || '...'}</Tag>
            </>
          )
          break
        case 'ai_judge':
          conditionDesc = (
            <>
              <Tag color="purple">AI 智能判断</Tag>
              {condConfig?.ai_prompt && <span className="ml-1 opacity-60">"{condConfig.ai_prompt.slice(0, 20)}..."</span>}
            </>
          )
          break
        default:
          conditionDesc = <Tag color="gray">未配置条件</Tag>
      }
      
      return (
        <span className="text-muted-foreground">
          如果 {inputDesc} {conditionDesc}，则执行以下操作
        </span>
      )
    }
    
    case 'condition_else':
      return (
        <span className="text-muted-foreground">
          否则执行以下操作
        </span>
      )
    
    case 'condition_end':
      return (
        <span className="text-muted-foreground">
          结束判断
        </span>
      )
    
    case 'text_extract': {
      const extractConfig = config as TextExtractConfig
      const inputDesc = getInputSourceDesc(extractConfig?.input_source, extractConfig?.input_variable)
      
      let modeDesc: React.ReactNode
      switch (extractConfig?.extract_mode) {
        case 'regex':
          modeDesc = <>使用 <Tag color="yellow">正则表达式</Tag> <Tag color="orange">{extractConfig?.regex_pattern || '...'}</Tag></>
          break
        case 'start_end':
          modeDesc = <>提取 <Tag color="orange">{extractConfig?.start_marker || '开始'}</Tag> 到 <Tag color="orange">{extractConfig?.end_marker || '结束'}</Tag> 之间的内容</>
          break
        case 'json_path':
          modeDesc = <>使用 <Tag color="yellow">JSON路径</Tag> <Tag color="orange">{extractConfig?.json_path || '...'}</Tag></>
          break
        default:
          modeDesc = <Tag color="gray">未配置</Tag>
      }
      
      return (
        <span className="text-muted-foreground">
          从 {inputDesc} 中 {modeDesc}
        </span>
      )
    }
    
    case 'text_concat': {
      const concatConfig = config as TextConcatConfig
      const sources = concatConfig?.sources || []
      const sourceDescs = sources.map((s, i) => {
        if (s.type === 'previous') return <Tag key={i} color="gray">上一输出</Tag>
        if (s.type === 'variable') return <Tag key={i} color="green">{s.variable || '变量'}</Tag>
        if (s.type === 'custom') return <Tag key={i} color="blue">{(s.custom || '').slice(0, 10)}{(s.custom || '').length > 10 ? '...' : ''}</Tag>
        return <Tag key={i} color="gray">未知</Tag>
      })
      
      const separator = concatConfig?.separator === '\n' ? '换行符' 
        : concatConfig?.separator === '' ? '无分隔' 
        : concatConfig?.separator || '无分隔'
      
      return (
        <span className="text-muted-foreground">
          拼接 {sourceDescs.length > 0 ? sourceDescs.reduce((prev, curr, i) => (
            <>{prev}{i > 0 && <span className="mx-0.5">+</span>}{curr}</>
          ), <></>) : <Tag color="gray">无内容</Tag>}
          ，使用 <Tag color="cyan">{separator}</Tag> 分隔
        </span>
      )
    }

    // 旧类型兼容
    case 'condition': {
      return (
        <span className="text-muted-foreground">
          条件判断节点（旧版本）
        </span>
      )
    }

    case 'loop': {
      const loopConfig = config as any
      return (
        <span className="text-muted-foreground">
          循环节点（旧版本），最多 <Tag color="pink">{loopConfig?.max_iterations || 10}</Tag> 次
        </span>
      )
    }

    case 'batch': {
      return (
        <span className="text-muted-foreground">
          批量执行节点（旧版本）
        </span>
      )
    }
    
    default:
      return (
        <span className="text-muted-foreground">
          {nodeTypeConfig[node.type as NodeType]?.label || '未知节点类型'}
        </span>
      )
  }
}

interface WorkflowNodeTreeProps {
  nodes: WorkflowNode[]
  selectedNodeId?: string
  runningNodeId?: string
  onSelectNode: (node: WorkflowNode) => void
  onDeleteNode: (nodeId: string) => void
  onCopyNode: (node: WorkflowNode) => void
  onReorderNodes: (nodeIds: string[]) => void
  disabled?: boolean
}

// 计算节点的缩进级别和所属块
function calculateNodeLevels(nodes: WorkflowNode[]): Map<string, { level: number; blockStack: { id: string; type: string }[] }> {
  const result = new Map<string, { level: number; blockStack: { id: string; type: string }[] }>()
  const blockStack: { id: string; type: string }[] = []
  
  for (const node of nodes) {
    const config = nodeTypeConfig[node.type]
    
    // 如果是块结束节点，先弹出栈
    if (config?.isBlockEnd) {
      blockStack.pop()
    }
    
    // 记录当前节点的级别
    result.set(node.id, {
      level: blockStack.length,
      blockStack: [...blockStack],
    })
    
    // 如果是块开始节点，压入栈
    if (config?.isBlockStart && node.block_id) {
      blockStack.push({ id: node.block_id, type: config.blockType || 'unknown' })
    }
  }
  
  return result
}

// 节点卡片组件（纯展示）
function NodeCard({
  node,
  index,
  blockStack,
  isActive,
  isRunning,
  isCollapsed,
  onDelete,
  onEdit,
  onCopy,
  onToggleCollapse,
  disabled,
  isDragging,
  isOverlay,
  dragHandleProps,
  style,
  wrapperRef,
}: {
  node: WorkflowNode
  index: number
  blockStack: { id: string; type: string }[]
  isActive?: boolean
  isRunning?: boolean
  isCollapsed?: boolean
  onDelete: () => void
  onEdit: () => void
  onCopy: () => void
  onToggleCollapse?: () => void
  disabled?: boolean
  isDragging?: boolean
  isOverlay?: boolean
  dragHandleProps?: any
  style?: React.CSSProperties
  wrapperRef?: (node: HTMLElement | null) => void
}) {
  const config = nodeTypeConfig[node.type]
  const Icon = config.icon
  const isBlockStart = config.isBlockStart

  // Overlay 状态下的特定样式
  const overlayStyle = isOverlay ? {
    cursor: 'grabbing',
    scale: 1.02,
  } : {}

  return (
    <div
      ref={wrapperRef}
      style={{ ...style, ...overlayStyle }}
      className={cn(
        'group relative flex items-stretch bg-card',
        isDragging && !isOverlay && 'opacity-30', // 原位置变淡
        isOverlay && 'z-50 rounded-md border bg-card shadow-xl ring-1 ring-primary/20', // 拖拽时的样式
        isActive && 'bg-primary/5',
        isRunning && 'bg-yellow-50 dark:bg-yellow-950/20',
        !isOverlay && 'transition-colors duration-200'
      )}
    >
      {/* 行号 (Overlay时不显示行号或显示假行号) */}
      <div className="w-10 flex-shrink-0 flex items-start justify-end pr-2 pt-2.5 text-xs text-muted-foreground/60 select-none font-mono">
        {index + 1}
      </div>

      {/* 缩进线 */}
      <div className="flex items-stretch">
        {blockStack.map((block, idx) => (
          <div
            key={idx}
            className="w-6 flex-shrink-0 relative"
          >
            {/* 竖线 */}
            <div 
              className={cn(
                'absolute left-2.5 top-0 bottom-0 w-0.5',
                blockLineColors[block.type] || 'bg-muted-foreground/20'
              )}
            />
          </div>
        ))}
      </div>

      {/* 折叠按钮区域 */}
      <div className="w-6 flex-shrink-0 flex items-start pt-2">
        {isBlockStart && onToggleCollapse && (
          <button
            className="p-0.5 rounded hover:bg-muted text-muted-foreground"
            onClick={(e) => {
              e.stopPropagation()
              onToggleCollapse()
            }}
          >
            {isCollapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      {/* 节点内容 */}
      <div 
        className={cn(
          'flex-1 py-2 pr-4 cursor-pointer min-w-0',
          'border-b border-transparent',
          !isDragging && 'hover:border-muted',
        )}
        onClick={() => {
          if (disabled) return
          onEdit()
        }}
      >
        {/* 第一行：图标 + 名称 */}
        <div className="flex items-center gap-2">
          {/* 运行状态指示器 */}
          {isRunning && (
            <div className="h-2 w-2 flex-shrink-0">
              <div className="absolute h-2 w-2 animate-ping rounded-full bg-yellow-500 opacity-75" />
              <div className="relative h-2 w-2 rounded-full bg-yellow-500" />
            </div>
          )}
          
          {/* 节点图标 */}
          <div className={cn(
            'flex h-5 w-5 items-center justify-center rounded flex-shrink-0',
            config.bgColor,
            'text-white'
          )}>
            <Icon className="h-3 w-3" />
          </div>

          {/* 节点名称 */}
          <span className={cn(
            'font-medium text-sm truncate',
            config.textColor
          )}>
            {node.name}
          </span>

          {/* 折叠提示 */}
          {isCollapsed && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              已折叠
            </span>
          )}
        </div>

        {/* 第二行：描述 */}
        <div className="mt-1 text-xs leading-relaxed pl-7">
          {getNodeDescription(node)}
        </div>
      </div>

      {/* 操作按钮 */}
      <div className={cn(
        'flex items-center gap-0.5 pr-2 transition-opacity',
        isOverlay ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
      )}>
        {/* 拖拽手柄 */}
        <button
          {...dragHandleProps}
          className={cn(
            'cursor-grab touch-none rounded p-1 text-muted-foreground/50 hover:bg-muted hover:text-foreground',
            disabled && 'cursor-not-allowed opacity-40',
            isOverlay && 'cursor-grabbing'
          )}
          disabled={disabled}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        {!isOverlay && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation()
                    onCopy()
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>复制</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit()
                  }}
                >
                  <Settings className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>配置</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete()
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>删除</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  )
}

// 可排序节点行组件
function SortableNodeRow(props: {
  node: WorkflowNode
  index: number
  blockStack: { id: string; type: string }[]
  isActive?: boolean
  isRunning?: boolean
  isCollapsed?: boolean
  onDelete: () => void
  onEdit: () => void
  onCopy: () => void
  onToggleCollapse?: () => void
  disabled?: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.node.id, disabled: props.disabled })

  const style = {
    transform: CSS.Translate.toString(transform), // 使用 Translate 避免缩放问题
    transition,
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      layout={false} // 禁用 layout 动画以避免与 dnd-kit 冲突
    >
      <NodeCard
        {...props}
        wrapperRef={setNodeRef}
        style={style}
        isDragging={isDragging}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </motion.div>
  )
}

export function WorkflowNodeTree({
  nodes,
  selectedNodeId,
  runningNodeId,
  onSelectNode,
  onDeleteNode,
  onCopyNode,
  onReorderNodes,
  disabled,
}: WorkflowNodeTreeProps) {
  // 折叠状态
  const [collapsedBlocks, setCollapsedBlocks] = useState<Set<string>>(new Set())
  // 拖拽状态
  const [activeId, setActiveId] = useState<string | null>(null)

  // 计算节点级别
  const nodeLevels = useMemo(() => calculateNodeLevels(nodes), [nodes])

  // 获取可见节点
  const visibleNodes = useMemo(() => {
    const result: WorkflowNode[] = []
    let skipUntilBlockEnd: string | null = null
    
    for (const node of nodes) {
      const config = nodeTypeConfig[node.type]
      
      // 如果正在跳过折叠的块
      if (skipUntilBlockEnd) {
        if (config?.isBlockEnd && node.block_id === skipUntilBlockEnd) {
          skipUntilBlockEnd = null
        }
        continue
      }
      
      result.push(node)
      
      // 如果是折叠的块开始节点，开始跳过
      if (config?.isBlockStart && node.block_id && collapsedBlocks.has(node.block_id)) {
        skipUntilBlockEnd = node.block_id
      }
    }
    
    return result
  }, [nodes, collapsedBlocks])

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 防止误触
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (over && active.id !== over.id) {
      const oldIndex = nodes.findIndex((n) => n.id === active.id)
      const newIndex = nodes.findIndex((n) => n.id === over.id)
      const newOrder = arrayMove(nodes, oldIndex, newIndex)
      onReorderNodes(newOrder.map((n) => n.id))
    }
  }
  
  const handleDragCancel = () => {
    setActiveId(null)
  }

  const toggleBlockCollapse = useCallback((blockId: string) => {
    setCollapsedBlocks(prev => {
      const next = new Set(prev)
      if (next.has(blockId)) {
        next.delete(blockId)
      } else {
        next.add(blockId)
      }
      return next
    })
  }, [])

  const activeNode = useMemo(() => 
    nodes.find(n => n.id === activeId),
    [activeId, nodes]
  )
  
  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: '0.4',
        },
      },
    }),
  }

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* 头部 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30 text-xs text-muted-foreground">
        <span className="w-10 text-right pr-2">行号</span>
        <span className="flex-1">节点</span>
        <span>操作</span>
      </div>

      {/* 节点列表 */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext items={visibleNodes} strategy={verticalListSortingStrategy}>
          <div className="divide-y divide-border/50">
            <AnimatePresence mode="popLayout">
              {visibleNodes.map((node) => {
                const nodeInfo = nodeLevels.get(node.id)
                const config = nodeTypeConfig[node.type]
                const isBlockStart = config?.isBlockStart
                const nodeIndex = nodes.indexOf(node)
                
                return (
                  <SortableNodeRow
                    key={node.id}
                    node={node}
                    index={nodeIndex}
                    blockStack={nodeInfo?.blockStack || []}
                    isActive={selectedNodeId === node.id}
                    isRunning={runningNodeId === node.id}
                    isCollapsed={isBlockStart && node.block_id ? collapsedBlocks.has(node.block_id) : false}
                    onDelete={() => onDeleteNode(node.id)}
                    onEdit={() => onSelectNode(node)}
                    onCopy={() => onCopyNode(node)}
                    disabled={disabled}
                    onToggleCollapse={
                      isBlockStart && node.block_id
                        ? () => toggleBlockCollapse(node.block_id!)
                        : undefined
                    }
                  />
                )
              })}
            </AnimatePresence>
          </div>
        </SortableContext>
        
        <DragOverlay dropAnimation={dropAnimation}>
          {activeNode ? (
            <NodeCard
              node={activeNode}
              index={nodes.indexOf(activeNode)}
              blockStack={nodeLevels.get(activeNode.id)?.blockStack || []}
              isActive={selectedNodeId === activeNode.id}
              isRunning={runningNodeId === activeNode.id}
              isCollapsed={false} // 拖拽时保持展开或保持原样？一般展开更好看
              onDelete={() => {}}
              onEdit={() => {}}
              onCopy={() => {}}
              isOverlay
              dragHandleProps={{}} // Overlay 不需要事件监听
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* 空状态 */}
      {nodes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Plus className="h-8 w-8 mb-2 opacity-50" />
          <p className="text-sm">暂无节点</p>
          <p className="text-xs mt-1">点击"添加节点"开始构建工作流</p>
        </div>
      )}
    </div>
  )
}

export { nodeTypeConfig }
