// 文本拼接节点配置表单

import { Plus, Trash2, GripVertical } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PromptInputField, type PromptInputMode } from '@/components/ui/prompt-input-field'
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
    { mode: 'variable', variable: '' }
  ],
  separator: '\n',
}

// 迁移旧版数据
function migrateSource(source: SourceItem): SourceItem {
  // 如果已经是新格式，直接返回
  if (source.mode) return source
  // 从旧格式迁移
  if (source.type === 'variable') {
    return { mode: 'variable', variable: source.variable || '' }
  }
  return { mode: 'manual', manual: source.custom || '' }
}

export function TextConcatConfigForm({ config, onChange, nodes = [], currentNodeId }: TextConcatConfigProps) {
  // 合并默认配置，并迁移旧版数据
  const migratedSources = config.sources?.length 
    ? config.sources.map(migrateSource) 
    : defaultConfig.sources
  const currentConfig: TextConcatConfigType = { 
    ...defaultConfig, 
    ...config,
    sources: migratedSources,
  }

  // 更新配置
  const updateConfig = (updates: Partial<TextConcatConfigType>) => {
    onChange({ ...currentConfig, ...updates })
  }

  // 添加来源项
  const addSource = () => {
    updateConfig({
      sources: [...currentConfig.sources, { mode: 'manual', manual: '' }]
    })
  }

  // 删除来源项
  const removeSource = (index: number) => {
    if (currentConfig.sources.length <= 1) return
    updateConfig({
      sources: currentConfig.sources.filter((_, i) => i !== index)
    })
  }

  // 更新来源项模式
  const handleSourceModeChange = (index: number, mode: PromptInputMode) => {
    const source = currentConfig.sources[index]
    const newSources = [...currentConfig.sources]
    if (mode === 'manual') {
      newSources[index] = { mode: 'manual', manual: source.manual || '' }
    } else {
      newSources[index] = { mode: 'variable', variable: source.variable || '' }
    }
    updateConfig({ sources: newSources })
  }

  // 更新来源项手动输入值
  const handleSourceManualChange = (index: number, value: string) => {
    const newSources = [...currentConfig.sources]
    newSources[index] = { mode: 'manual', manual: value }
    updateConfig({ sources: newSources })
  }

  // 更新来源项变量引用值
  const handleSourceVariableChange = (index: number, value: string) => {
    const newSources = [...currentConfig.sources]
    newSources[index] = { mode: 'variable', variable: value }
    updateConfig({ sources: newSources })
  }

  // 渲染单个来源项
  const renderSourceItem = (source: SourceItem, index: number) => {
    const mode: PromptInputMode = source.mode === 'variable' ? 'variable' : 'manual'
    const manualValue = source.manual ?? ''
    const variableValue = source.variable ?? ''

    return (
      <Card key={index} className="relative">
        <CardContent className="pt-4 pb-4 pr-10">
          <div className="absolute left-2 top-4 text-muted-foreground cursor-move">
            <GripVertical className="h-4 w-4" />
          </div>
          
          <div className="ml-4">
            <PromptInputField
              label={`来源 #${index + 1}`}
              mode={mode}
              manualValue={manualValue}
              variableValue={variableValue}
              onModeChange={(m) => handleSourceModeChange(index, m)}
              onManualChange={(v) => handleSourceManualChange(index, v)}
              onVariableChange={(v) => handleSourceVariableChange(index, v)}
              nodes={nodes}
              currentNodeId={currentNodeId}
              placeholder="输入文本或输入 / 选择变量..."
              minHeight="60px"
            />
          </div>

          {currentConfig.sources.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-4 h-8 w-8 text-muted-foreground hover:text-destructive"
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

