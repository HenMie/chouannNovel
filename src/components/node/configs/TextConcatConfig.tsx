// 文本拼接节点配置表单

import { Plus, Trash2, GripVertical } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PromptEditor } from '@/components/ui/prompt-editor'
import { VariableSelect } from '@/components/ui/variable-select'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import type { TextConcatConfig as TextConcatConfigType, WorkflowNode } from '@/types'

interface TextConcatConfigProps {
  config: Partial<TextConcatConfigType>
  onChange: (config: Partial<TextConcatConfigType>) => void
  nodes?: WorkflowNode[]
  currentNodeId?: string
}

// 来源项类型
type SourceItem = TextConcatConfigType['sources'][number]

// 默认配置
const defaultConfig: TextConcatConfigType = {
  sources: [
    { type: 'variable', variable: '' }
  ],
  separator: '\n',
}

export function TextConcatConfigForm({ config, onChange, nodes = [], currentNodeId }: TextConcatConfigProps) {
  // 合并默认配置
  const currentConfig: TextConcatConfigType = { 
    ...defaultConfig, 
    ...config,
    sources: config.sources?.length ? config.sources : defaultConfig.sources,
  }

  // 更新配置
  const updateConfig = (updates: Partial<TextConcatConfigType>) => {
    onChange({ ...currentConfig, ...updates })
  }

  // 添加来源项
  const addSource = () => {
    updateConfig({
      sources: [...currentConfig.sources, { type: 'custom', custom: '' }]
    })
  }

  // 删除来源项
  const removeSource = (index: number) => {
    if (currentConfig.sources.length <= 1) return
    updateConfig({
      sources: currentConfig.sources.filter((_, i) => i !== index)
    })
  }

  // 更新来源项
  const updateSource = (index: number, updates: Partial<SourceItem>) => {
    const newSources = [...currentConfig.sources]
    newSources[index] = { ...newSources[index], ...updates }
    updateConfig({ sources: newSources })
  }

  // 渲染单个来源项
  const renderSourceItem = (source: SourceItem, index: number) => {
    return (
      <Card key={index} className="relative">
        <CardContent className="pt-4 pb-4 pr-10">
          <div className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground cursor-move">
            <GripVertical className="h-4 w-4" />
          </div>
          
          <div className="ml-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-medium shrink-0">
                #{index + 1}
              </span>
              <Select
                value={source.type}
                onValueChange={(value: SourceItem['type']) =>
                  updateSource(index, { type: value, variable: undefined, custom: undefined })
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="variable">引用变量</SelectItem>
                  <SelectItem value="custom">自定义文本</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {source.type === 'variable' && (
              <VariableSelect
                placeholder="选择引用变量"
                value={source.variable || ''}
                onChange={(value) => updateSource(index, { type: 'variable', variable: value })}
                nodes={nodes}
                currentNodeId={currentNodeId}
              />
            )}

            {source.type === 'custom' && (
              <PromptEditor
                placeholder="输入自定义文本，输入 / 选择变量..."
                minHeight="60px"
                value={source.custom || ''}
                onChange={(value) => updateSource(index, { custom: value })}
                nodes={nodes}
                currentNodeId={currentNodeId}
              />
            )}
          </div>

          {currentConfig.sources.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={() => removeSource(index)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* 来源列表 */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>文本来源</Label>
          <Button variant="outline" size="sm" onClick={addSource}>
            <Plus className="mr-1 h-4 w-4" />
            添加来源
          </Button>
        </div>
        
        <div className="space-y-2">
          {currentConfig.sources.map((source, index) => renderSourceItem(source, index))}
        </div>

        <p className="text-xs text-muted-foreground">
          将按顺序拼接所有来源的文本
        </p>
      </div>

      {/* 分隔符设置 */}
      <div className="space-y-4">
        <Label htmlFor="separator">分隔符</Label>
        <div className="space-y-2">
          <Select
            value={
              currentConfig.separator === '\n' ? 'newline' :
              currentConfig.separator === '\n\n' ? 'double_newline' :
              currentConfig.separator === '' ? 'none' :
              'custom'
            }
            onValueChange={(value) => {
              const separatorMap: Record<string, string> = {
                'newline': '\n',
                'double_newline': '\n\n',
                'none': '',
                'custom': currentConfig.separator,
              }
              updateConfig({ separator: separatorMap[value] || currentConfig.separator })
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">无分隔符</SelectItem>
              <SelectItem value="newline">换行</SelectItem>
              <SelectItem value="double_newline">双换行</SelectItem>
              <SelectItem value="custom">自定义</SelectItem>
            </SelectContent>
          </Select>

          {currentConfig.separator !== '\n' && 
           currentConfig.separator !== '\n\n' && 
           currentConfig.separator !== '' && (
            <Input
              id="separator"
              placeholder="输入自定义分隔符"
              value={currentConfig.separator}
              onChange={(e) => updateConfig({ separator: e.target.value })}
            />
          )}
        </div>
      </div>
    </div>
  )
}

