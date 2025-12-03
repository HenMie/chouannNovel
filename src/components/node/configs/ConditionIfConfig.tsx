// 条件分支开始节点配置组件

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { HelpCircle } from 'lucide-react'
import type { ConditionIfConfig, GlobalConfig } from '@/types'

interface ConditionIfConfigFormProps {
  config: Partial<ConditionIfConfig>
  globalConfig: GlobalConfig | null
  onChange: (config: Partial<ConditionIfConfig>) => void
}

export function ConditionIfConfigForm({
  config,
  globalConfig,
  onChange,
}: ConditionIfConfigFormProps) {
  const inputSource = config.input_source || 'previous'
  const conditionType = config.condition_type || 'keyword'

  return (
    <div className="space-y-6">
      {/* 输入来源 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>条件输入来源</Label>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              选择用于判断条件的输入数据来源
            </TooltipContent>
          </Tooltip>
        </div>
        <Select
          value={inputSource}
          onValueChange={(value: 'previous' | 'variable') =>
            onChange({ ...config, input_source: value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="选择输入来源" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="previous">上一节点输出</SelectItem>
            <SelectItem value="variable">指定变量</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 变量名输入 */}
      {inputSource === 'variable' && (
        <div className="space-y-2">
          <Label htmlFor="input_variable">变量名</Label>
          <Input
            id="input_variable"
            placeholder="输入变量名"
            value={config.input_variable || ''}
            onChange={(e) =>
              onChange({ ...config, input_variable: e.target.value })
            }
          />
        </div>
      )}

      {/* 条件类型 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>条件类型</Label>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p><strong>关键词匹配：</strong>检查是否包含指定关键词</p>
              <p><strong>文本长度：</strong>比较文本字符数</p>
              <p><strong>正则表达式：</strong>使用正则进行匹配</p>
              <p><strong>AI 判断：</strong>使用 AI 进行智能判断</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <Select
          value={conditionType}
          onValueChange={(value: 'keyword' | 'length' | 'regex' | 'ai_judge') =>
            onChange({ ...config, condition_type: value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="选择条件类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="keyword">关键词匹配</SelectItem>
            <SelectItem value="length">文本长度</SelectItem>
            <SelectItem value="regex">正则表达式</SelectItem>
            <SelectItem value="ai_judge">AI 智能判断</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 关键词配置 */}
      {conditionType === 'keyword' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>匹配模式</Label>
            <Select
              value={config.keyword_mode || 'any'}
              onValueChange={(value: 'any' | 'all' | 'none') =>
                onChange({ ...config, keyword_mode: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">包含任一关键词 → true</SelectItem>
                <SelectItem value="all">包含所有关键词 → true</SelectItem>
                <SelectItem value="none">不包含任何关键词 → true</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="keywords">关键词列表</Label>
            <Input
              id="keywords"
              placeholder="输入关键词，用逗号分隔"
              value={(config.keywords || []).join(', ')}
              onChange={(e) =>
                onChange({
                  ...config,
                  keywords: e.target.value.split(',').map((k) => k.trim()).filter(Boolean),
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              例如: 成功, 完成, OK
            </p>
          </div>
        </div>
      )}

      {/* 长度配置 */}
      {conditionType === 'length' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label>比较运算符</Label>
              <Select
                value={config.length_operator || '>'}
                onValueChange={(value: '>' | '<' | '=' | '>=' | '<=') =>
                  onChange({ ...config, length_operator: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value=">">大于 (&gt;)</SelectItem>
                  <SelectItem value="<">小于 (&lt;)</SelectItem>
                  <SelectItem value="=">等于 (=)</SelectItem>
                  <SelectItem value=">=">大于等于 (≥)</SelectItem>
                  <SelectItem value="<=">小于等于 (≤)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="length_value">长度值</Label>
              <Input
                id="length_value"
                type="number"
                min={0}
                value={config.length_value || 0}
                onChange={(e) =>
                  onChange({ ...config, length_value: parseInt(e.target.value) || 0 })
                }
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            当文本长度满足条件时返回 true
          </p>
        </div>
      )}

      {/* 正则表达式配置 */}
      {conditionType === 'regex' && (
        <div className="space-y-2">
          <Label htmlFor="regex_pattern">正则表达式</Label>
          <Input
            id="regex_pattern"
            placeholder="输入正则表达式"
            value={config.regex_pattern || ''}
            onChange={(e) =>
              onChange({ ...config, regex_pattern: e.target.value })
            }
          />
          <p className="text-xs text-muted-foreground">
            当文本匹配正则表达式时返回 true
          </p>
        </div>
      )}

      {/* AI 判断配置 */}
      {conditionType === 'ai_judge' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ai_prompt">判断提示词</Label>
            <Input
              id="ai_prompt"
              placeholder="请判断以下内容是否..."
              value={config.ai_prompt || ''}
              onChange={(e) =>
                onChange({ ...config, ai_prompt: e.target.value })
              }
            />
            <p className="text-xs text-muted-foreground">
              AI 将根据此提示词判断输入内容，返回 true 或 false
            </p>
          </div>
          {/* 可以添加 AI 提供商和模型选择 */}
        </div>
      )}

      {/* 分支说明 */}
      <div className="rounded-lg bg-muted/50 p-3 space-y-2">
        <h4 className="font-medium text-sm">分支逻辑</h4>
        <div className="text-sm text-muted-foreground space-y-1">
          <p>
            <code className="bg-muted px-1 rounded">if</code> 条件为 <strong>true</strong>：
            执行 if 和 else 之间的节点
          </p>
          <p>
            <code className="bg-muted px-1 rounded">if</code> 条件为 <strong>false</strong>：
            跳过执行 else 之后的节点
          </p>
        </div>
      </div>
    </div>
  )
}

