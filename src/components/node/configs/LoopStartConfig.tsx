// 循环开始节点配置组件

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
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
import type { LoopStartConfig, GlobalConfig } from '@/types'

interface LoopStartConfigFormProps {
  config: Partial<LoopStartConfig>
  globalConfig: GlobalConfig | null
  onChange: (config: Partial<LoopStartConfig>) => void
}

export function LoopStartConfigForm({
  config,
  globalConfig,
  onChange,
}: LoopStartConfigFormProps) {
  const loopType = config.loop_type || 'count'
  const maxIterations = config.max_iterations || 5

  return (
    <div className="space-y-6">
      {/* 循环类型 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>循环类型</Label>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p><strong>固定次数：</strong>循环执行指定次数</p>
              <p><strong>条件循环：</strong>每次迭代前检查条件，条件满足则继续</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <Select
          value={loopType}
          onValueChange={(value: 'count' | 'condition') =>
            onChange({ ...config, loop_type: value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="选择循环类型" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="count">
              <div className="flex items-center gap-2">
                <span>固定次数</span>
                <Badge variant="secondary" className="text-xs">for i in range(n)</Badge>
              </div>
            </SelectItem>
            <SelectItem value="condition">
              <div className="flex items-center gap-2">
                <span>条件循环</span>
                <Badge variant="secondary" className="text-xs">while condition</Badge>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 最大迭代次数 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label>最大迭代次数</Label>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                循环执行的最大次数，防止无限循环
              </TooltipContent>
            </Tooltip>
          </div>
          <span className="text-sm font-medium tabular-nums">{maxIterations} 次</span>
        </div>
        <Slider
          value={[maxIterations]}
          onValueChange={([value]) => onChange({ ...config, max_iterations: value })}
          min={1}
          max={50}
          step={1}
          className="py-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1 次</span>
          <span>50 次</span>
        </div>
      </div>

      {/* 条件循环配置 */}
      {loopType === 'condition' && (
        <>
          <div className="border-t pt-4 space-y-4">
            <h4 className="font-medium text-sm">继续条件配置</h4>
            
            {/* 输入来源 */}
            <div className="space-y-2">
              <Label>条件输入来源</Label>
              <Select
                value={config.condition_source || 'previous'}
                onValueChange={(value: 'previous' | 'variable') =>
                  onChange({ ...config, condition_source: value })
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
            {config.condition_source === 'variable' && (
              <div className="space-y-2">
                <Label htmlFor="condition_variable">变量名</Label>
                <Input
                  id="condition_variable"
                  placeholder="输入变量名"
                  value={config.condition_variable || ''}
                  onChange={(e) =>
                    onChange({ ...config, condition_variable: e.target.value })
                  }
                />
              </div>
            )}

            {/* 条件类型 */}
            <div className="space-y-2">
              <Label>条件类型</Label>
              <Select
                value={config.condition_type || 'keyword'}
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
            {config.condition_type === 'keyword' && (
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
                      <SelectItem value="any">包含任一关键词（继续）</SelectItem>
                      <SelectItem value="all">包含所有关键词（继续）</SelectItem>
                      <SelectItem value="none">不包含任何关键词（继续）</SelectItem>
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
                    例如: 继续, 再来, 还要
                  </p>
                </div>
              </div>
            )}

            {/* 长度配置 */}
            {config.condition_type === 'length' && (
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
                        <SelectItem value=">">大于</SelectItem>
                        <SelectItem value="<">小于</SelectItem>
                        <SelectItem value="=">等于</SelectItem>
                        <SelectItem value=">=">大于等于</SelectItem>
                        <SelectItem value="<=">小于等于</SelectItem>
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
                  当文本长度满足条件时继续循环
                </p>
              </div>
            )}

            {/* 正则表达式配置 */}
            {config.condition_type === 'regex' && (
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
                  当文本匹配正则表达式时继续循环
                </p>
              </div>
            )}

            {/* AI 判断配置 */}
            {config.condition_type === 'ai_judge' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="ai_prompt">判断提示词</Label>
                  <Input
                    id="ai_prompt"
                    placeholder="请判断是否需要继续..."
                    value={config.ai_prompt || ''}
                    onChange={(e) =>
                      onChange({ ...config, ai_prompt: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    AI 返回 true 时继续循环
                  </p>
                </div>
                {/* AI 提供商配置可以在这里添加 */}
              </div>
            )}
          </div>
        </>
      )}

      {/* 提示信息 */}
      <div className="rounded-lg bg-muted/50 p-3 text-sm">
        <p className="text-muted-foreground">
          <strong>提示：</strong>循环块中的所有节点会重复执行，直到达到最大次数或条件不满足。
          循环结束后，将从 <code className="bg-muted px-1 rounded">end for</code> 节点之后继续执行。
        </p>
      </div>
    </div>
  )
}

