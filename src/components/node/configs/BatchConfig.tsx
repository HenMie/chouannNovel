// 批量执行节点配置表单

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { VariableSelect } from '@/components/ui/variable-select'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { X, Layers, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BatchConfig as BatchConfigType, WorkflowNode } from '@/types'

interface BatchConfigProps {
  config: Partial<BatchConfigType>
  onChange: (config: Partial<BatchConfigType>) => void
  nodes: WorkflowNode[]  // 工作流中的所有节点
  currentNodeId: string  // 当前节点 ID（用于过滤）
}

// 默认配置
const defaultConfig: BatchConfigType = {
  split_mode: 'line',
  separator: '\n',
  target_nodes: [],
  concurrency: 3,
  output_mode: 'concat',
  output_separator: '\n\n---\n\n',
}

// 节点类型标签
const nodeTypeLabels: Record<string, string> = {
  input: '输入',
  output: '输出',
  ai_chat: 'AI 对话',
  text_extract: '内容提取',
  text_concat: '文本拼接',
  condition: '条件判断',
  loop: '循环',
  batch: '批量执行',
}

export function BatchConfigForm({ config, onChange, nodes, currentNodeId }: BatchConfigProps) {
  // 合并默认配置
  const currentConfig: BatchConfigType = { ...defaultConfig, ...config }

  // 更新配置
  const updateConfig = (updates: Partial<BatchConfigType>) => {
    onChange({ ...currentConfig, ...updates })
  }

  // 获取当前节点在列表中的索引
  const currentNodeIndex = nodes.findIndex(n => n.id === currentNodeId)

  // 可选择的目标节点（当前节点之后的节点，排除 batch 和 loop 类型）
  const selectableNodes = nodes.filter((n, index) => 
    index > currentNodeIndex && 
    n.type !== 'batch' && 
    n.type !== 'loop'
  )

  // 切换节点选择
  const toggleNode = (nodeId: string) => {
    const current = currentConfig.target_nodes || []
    if (current.includes(nodeId)) {
      updateConfig({ target_nodes: current.filter(id => id !== nodeId) })
    } else {
      updateConfig({ target_nodes: [...current, nodeId] })
    }
  }

  // 移除节点
  const removeNode = (nodeId: string) => {
    const current = currentConfig.target_nodes || []
    updateConfig({ target_nodes: current.filter(id => id !== nodeId) })
  }

  // 获取节点名称
  const getNodeName = (nodeId: string) => {
    return nodes.find(n => n.id === nodeId)?.name || '未知节点'
  }

  // 获取节点类型
  const getNodeType = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId)
    return node ? nodeTypeLabels[node.type] || node.type : ''
  }

  return (
    <div className="space-y-6">
      {/* 数据源设置 */}
      <div className="space-y-4">
        <Label>输入数据源</Label>
        <VariableSelect
          placeholder="选择引用变量"
          value={currentConfig.input_variable || ''}
          onChange={(value) => updateConfig({ input_variable: value })}
          nodes={nodes}
          currentNodeId={currentNodeId}
        />
        <p className="text-xs text-muted-foreground">
          选择要批量处理的数据变量
        </p>
      </div>

      {/* 分割模式 */}
      <div className="space-y-4">
        <Label>分割模式</Label>
        <p className="text-xs text-muted-foreground">
          将输入内容分割成多个项，每项并发执行
        </p>
        <Select
          value={currentConfig.split_mode}
          onValueChange={(value: 'line' | 'separator' | 'json_array') =>
            updateConfig({ split_mode: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="line">按行分割</SelectItem>
            <SelectItem value="separator">自定义分隔符</SelectItem>
            <SelectItem value="json_array">JSON 数组</SelectItem>
          </SelectContent>
        </Select>

        {currentConfig.split_mode === 'separator' && (
          <div className="space-y-2">
            <Label htmlFor="separator">分隔符</Label>
            <Input
              id="separator"
              placeholder="例如：---"
              value={currentConfig.separator || ''}
              onChange={(e) => updateConfig({ separator: e.target.value })}
            />
          </div>
        )}

        {currentConfig.split_mode === 'json_array' && (
          <p className="text-xs text-muted-foreground">
            输入内容应为 JSON 数组格式，如：["item1", "item2", "item3"]
          </p>
        )}
      </div>

      {/* 并发控制 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>最大并发数</Label>
          <span className="text-sm text-muted-foreground">
            {currentConfig.concurrency}
          </span>
        </div>
        <Slider
          value={[currentConfig.concurrency]}
          onValueChange={([value]) => updateConfig({ concurrency: value })}
          min={1}
          max={10}
          step={1}
        />
        <p className="text-xs text-muted-foreground">
          同时处理的最大项数，建议设置为 3-5 以避免 API 限流
        </p>
      </div>

      {/* 目标节点选择 */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Label>执行节点</Label>
          <Layers className="h-4 w-4 text-muted-foreground" />
        </div>
        <p className="text-xs text-muted-foreground">
          选择要对每个分割项执行的节点（按顺序执行）
        </p>

        {/* 已选择的节点 */}
        {currentConfig.target_nodes && currentConfig.target_nodes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {currentConfig.target_nodes.map((nodeId, index) => (
              <Badge
                key={nodeId}
                variant="secondary"
                className="gap-1 pr-1"
              >
                <span className="text-muted-foreground mr-1">{index + 1}.</span>
                {getNodeName(nodeId)}
                <span className="text-xs text-muted-foreground">
                  ({getNodeType(nodeId)})
                </span>
                <button
                  className="ml-1 rounded-full hover:bg-destructive/20"
                  onClick={() => removeNode(nodeId)}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* 可选节点列表 */}
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[200px]">
              {selectableNodes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <AlertCircle className="mb-2 h-8 w-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    没有可选择的节点
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    请在当前节点之后添加其他节点
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {selectableNodes.map((node) => {
                    const isSelected = currentConfig.target_nodes?.includes(node.id)
                    return (
                      <div
                        key={node.id}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors',
                          isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'
                        )}
                        onClick={() => toggleNode(node.id)}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleNode(node.id)}
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">{node.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {nodeTypeLabels[node.type] || node.type}
                          </div>
                        </div>
                        {isSelected && (
                          <Badge variant="outline" className="text-xs">
                            第 {(currentConfig.target_nodes?.indexOf(node.id) ?? 0) + 1} 个
                          </Badge>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* 输出模式 */}
      <div className="space-y-4">
        <Label>输出模式</Label>
        <Select
          value={currentConfig.output_mode}
          onValueChange={(value: 'array' | 'concat') =>
            updateConfig({ output_mode: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="concat">拼接成文本</SelectItem>
            <SelectItem value="array">JSON 数组</SelectItem>
          </SelectContent>
        </Select>

        {currentConfig.output_mode === 'concat' && (
          <div className="space-y-2">
            <Label htmlFor="output_separator">输出分隔符</Label>
            <Input
              id="output_separator"
              placeholder="例如：\n\n---\n\n"
              value={currentConfig.output_separator || ''}
              onChange={(e) => updateConfig({ output_separator: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              支持转义字符：\n 表示换行，\t 表示制表符
            </p>
          </div>
        )}

        {currentConfig.output_mode === 'array' && (
          <p className="text-xs text-muted-foreground">
            输出为 JSON 数组格式，每个元素为一个执行结果
          </p>
        )}
      </div>
    </div>
  )
}

