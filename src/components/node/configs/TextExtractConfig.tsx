// 文本提取节点配置表单

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { VariableSelect } from '@/components/ui/variable-select'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { TextExtractConfig as TextExtractConfigType, WorkflowNode } from '@/types'

interface TextExtractConfigProps {
  config: Partial<TextExtractConfigType>
  onChange: (config: Partial<TextExtractConfigType>) => void
  nodes?: WorkflowNode[]
  currentNodeId?: string
}

// 默认配置
const defaultConfig: TextExtractConfigType = {
  extract_mode: 'regex',
  regex_pattern: '',
  start_marker: '',
  end_marker: '',
  json_path: '',
}

export function TextExtractConfigForm({ config, onChange, nodes = [], currentNodeId }: TextExtractConfigProps) {
  // 合并默认配置
  const currentConfig: TextExtractConfigType = { ...defaultConfig, ...config }

  // 更新配置
  const updateConfig = (updates: Partial<TextExtractConfigType>) => {
    onChange({ ...currentConfig, ...updates })
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
          选择要提取内容的变量
        </p>
      </div>

      {/* 提取模式 */}
      <div className="space-y-4">
        <Label>提取模式</Label>
        <Select
          value={currentConfig.extract_mode}
          onValueChange={(value: 'regex' | 'start_end' | 'json_path' | 'md_to_text') =>
            updateConfig({ extract_mode: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="regex">正则表达式</SelectItem>
            <SelectItem value="start_end">起止标记</SelectItem>
            <SelectItem value="json_path">JSON 路径</SelectItem>
            <SelectItem value="md_to_text">Markdown 转纯文本</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 正则表达式配置 */}
      {currentConfig.extract_mode === 'regex' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="regex_pattern">正则表达式</Label>
            <Textarea
              id="regex_pattern"
              placeholder="例如：第(\d+)章\s+(.+)"
              className="min-h-[80px] font-mono text-sm"
              value={currentConfig.regex_pattern || ''}
              onChange={(e) => updateConfig({ regex_pattern: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              使用捕获组 () 来提取内容，如有多个捕获组，会用换行符连接
            </p>
          </div>
        </div>
      )}

      {/* 起止标记配置 */}
      {currentConfig.extract_mode === 'start_end' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="start_marker">起始标记</Label>
            <Input
              id="start_marker"
              placeholder="例如：【开始】"
              value={currentConfig.start_marker || ''}
              onChange={(e) => updateConfig({ start_marker: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end_marker">结束标记</Label>
            <Input
              id="end_marker"
              placeholder="例如：【结束】"
              value={currentConfig.end_marker || ''}
              onChange={(e) => updateConfig({ end_marker: e.target.value })}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            提取两个标记之间的内容（不包含标记本身）
          </p>
        </div>
      )}

      {/* JSON 路径配置 */}
      {currentConfig.extract_mode === 'json_path' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="json_path">JSON 路径</Label>
            <Input
              id="json_path"
              placeholder="例如：data.items[0].title"
              className="font-mono text-sm"
              value={currentConfig.json_path || ''}
              onChange={(e) => updateConfig({ json_path: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              支持点号访问和数组索引，例如：data.list[0].name
            </p>
          </div>
        </div>
      )}

      {/* Markdown 转纯文本说明 */}
      {currentConfig.extract_mode === 'md_to_text' && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            将 Markdown 格式文本转换为纯文本，移除所有格式标记（如标题、加粗、斜体、链接、代码块等）
          </p>
        </div>
      )}
    </div>
  )
}

