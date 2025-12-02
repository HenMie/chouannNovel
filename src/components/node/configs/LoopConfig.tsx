// 循环节点配置表单

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getAvailableModels, getModelConfig, type ModelConfig } from '@/lib/ai'
import type { 
  LoopConfig as LoopConfigType, 
  ConditionConfig as ConditionConfigType,
  GlobalConfig, 
  AIProvider,
  WorkflowNode 
} from '@/types'

interface LoopConfigProps {
  config: Partial<LoopConfigType>
  globalConfig: GlobalConfig | null
  nodes?: WorkflowNode[]
  currentNodeId?: string
  onChange: (config: Partial<LoopConfigType>) => void
}

// 默认条件配置
const defaultCondition: ConditionConfigType = {
  input_source: 'previous',
  condition_type: 'keyword',
  keywords: [],
  keyword_mode: 'any',
  true_action: 'next',
  false_action: 'end',
}

// 默认配置
const defaultConfig: LoopConfigType = {
  max_iterations: 10,
  condition_type: 'count',
  condition: defaultCondition,
}

// 条件类型标签（仅用于循环的子集）
const loopConditionTypeLabels: Record<Exclude<ConditionConfigType['condition_type'], 'ai_judge'>, string> = {
  keyword: '关键词匹配',
  length: '长度判断',
  regex: '正则匹配',
}

export function LoopConfigForm({ 
  config, 
  globalConfig,
  nodes = [],
  currentNodeId,
  onChange 
}: LoopConfigProps) {
  // 合并默认配置
  const currentConfig: LoopConfigType = { 
    ...defaultConfig, 
    ...config,
    condition: { ...defaultCondition, ...config.condition }
  }

  // 更新配置
  const updateConfig = (updates: Partial<LoopConfigType>) => {
    onChange({ ...currentConfig, ...updates })
  }

  // 更新条件配置
  const updateCondition = (updates: Partial<ConditionConfigType>) => {
    updateConfig({
      condition: { ...currentConfig.condition!, ...updates }
    })
  }

  // 解析关键词字符串
  const keywordsString = (currentConfig.condition?.keywords || []).join('\n')
  const handleKeywordsChange = (value: string) => {
    const keywords = value.split('\n').filter(k => k.trim())
    updateCondition({ keywords })
  }

  return (
    <div className="space-y-6">
      {/* 循环类型 */}
      <div className="space-y-4">
        <Label>循环类型</Label>
        <Select
          value={currentConfig.condition_type}
          onValueChange={(value: 'count' | 'condition') =>
            updateConfig({ condition_type: value })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="count">固定次数循环</SelectItem>
            <SelectItem value="condition">条件循环</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* 最大迭代次数 */}
      <div className="space-y-2">
        <Label htmlFor="max_iterations">最大迭代次数</Label>
        <Input
          id="max_iterations"
          type="number"
          min={1}
          max={100}
          value={currentConfig.max_iterations}
          onChange={(e) => updateConfig({ max_iterations: parseInt(e.target.value) || 10 })}
        />
        <p className="text-xs text-muted-foreground">
          {currentConfig.condition_type === 'count' 
            ? '循环将执行指定次数后结束' 
            : '防止无限循环的安全限制'}
        </p>
      </div>

      {/* 条件循环配置 */}
      {currentConfig.condition_type === 'condition' && (
        <>
          <Separator />
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Badge variant="secondary">循环条件</Badge>
                满足条件时继续循环
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 数据源设置 */}
              <div className="space-y-2">
                <Label>输入数据源</Label>
                <Select
                  value={currentConfig.condition?.input_source || 'previous'}
                  onValueChange={(value: 'previous' | 'variable') =>
                    updateCondition({ input_source: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="previous">上一节点输出</SelectItem>
                    <SelectItem value="variable">引用变量</SelectItem>
                  </SelectContent>
                </Select>

                {currentConfig.condition?.input_source === 'variable' && (
                  <Input
                    placeholder="变量名"
                    value={currentConfig.condition?.input_variable || ''}
                    onChange={(e) => updateCondition({ input_variable: e.target.value })}
                  />
                )}
              </div>

              <Separator />

              {/* 条件类型 */}
              <div className="space-y-2">
                <Label>条件类型</Label>
                <Select
                  value={currentConfig.condition?.condition_type || 'keyword'}
                  onValueChange={(value: ConditionConfigType['condition_type']) =>
                    updateCondition({ condition_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(loopConditionTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 关键词匹配配置 */}
              {currentConfig.condition?.condition_type === 'keyword' && (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="keywords">关键词列表</Label>
                    <Textarea
                      id="keywords"
                      placeholder="每行一个关键词（包含则继续循环）..."
                      className="min-h-[80px]"
                      value={keywordsString}
                      onChange={(e) => handleKeywordsChange(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>匹配模式</Label>
                    <Select
                      value={currentConfig.condition?.keyword_mode || 'any'}
                      onValueChange={(value: 'any' | 'all' | 'none') =>
                        updateCondition({ keyword_mode: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">包含任意一个（继续循环）</SelectItem>
                        <SelectItem value="all">包含全部（继续循环）</SelectItem>
                        <SelectItem value="none">不包含任何一个（继续循环）</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {/* 长度判断配置 */}
              {currentConfig.condition?.condition_type === 'length' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 space-y-2">
                      <Label>比较运算符</Label>
                      <Select
                        value={currentConfig.condition?.length_operator || '>'}
                        onValueChange={(value: '>' | '<' | '=' | '>=' | '<=') =>
                          updateCondition({ length_operator: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="<">小于 (&lt;)</SelectItem>
                          <SelectItem value="<=">小于等于 (&lt;=)</SelectItem>
                          <SelectItem value="=">等于 (=)</SelectItem>
                          <SelectItem value=">">大于 (&gt;)</SelectItem>
                          <SelectItem value=">=">大于等于 (&gt;=)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1 space-y-2">
                      <Label htmlFor="length_value">字符数</Label>
                      <Input
                        id="length_value"
                        type="number"
                        min={0}
                        value={currentConfig.condition?.length_value || 0}
                        onChange={(e) => 
                          updateCondition({ length_value: parseInt(e.target.value) || 0 })
                        }
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    当长度满足条件时继续循环
                  </p>
                </div>
              )}

              {/* 正则匹配配置 */}
              {currentConfig.condition?.condition_type === 'regex' && (
                <div className="space-y-2">
                  <Label htmlFor="regex_pattern">正则表达式</Label>
                  <Textarea
                    id="regex_pattern"
                    placeholder="例如：待续|未完成|继续"
                    className="min-h-[60px] font-mono text-sm"
                    value={currentConfig.condition?.regex_pattern || ''}
                    onChange={(e) => updateCondition({ regex_pattern: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    当正则表达式匹配成功时继续循环
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <Separator />

      {/* 循环说明 */}
      <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
        <p className="text-sm font-medium">循环执行说明</p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>循环节点会重复执行其之后的所有节点</li>
          <li>每次循环结束后，会根据条件判断是否继续</li>
          <li>达到最大迭代次数后会自动停止循环</li>
          <li>可配合条件节点实现复杂的流程控制</li>
        </ul>
      </div>
    </div>
  )
}

