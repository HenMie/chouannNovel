// 并发执行节点配置组件

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
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
import { HelpCircle, Zap } from 'lucide-react'
import type { ParallelStartConfig } from '@/types'

interface ParallelConfigFormProps {
  config: Partial<ParallelStartConfig>
  onChange: (config: Partial<ParallelStartConfig>) => void
}

export function ParallelConfigForm({
  config,
  onChange,
}: ParallelConfigFormProps) {
  const concurrency = config.concurrency || 3
  const outputMode = config.output_mode || 'array'
  const retryCount = config.retry_count ?? 3

  return (
    <div className="space-y-6">
      {/* 并发数 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label>并发数</Label>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                同时执行的任务数量。较高的并发数可以加快执行速度，
                但可能会增加 API 调用频率限制的风险。
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-primary" />
            <span className="text-sm font-medium tabular-nums">{concurrency} 个</span>
          </div>
        </div>
        <Slider
          value={[concurrency]}
          onValueChange={([value]) => onChange({ ...config, concurrency: value })}
          min={1}
          max={10}
          step={1}
          className="py-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>1 个（串行）</span>
          <span>10 个（高并发）</span>
        </div>
      </div>

      {/* 输出模式 */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label>输出模式</Label>
          <Tooltip>
            <TooltipTrigger>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p><strong>数组格式：</strong>各任务输出作为 JSON 数组</p>
              <p><strong>拼接文本：</strong>各任务输出用分隔符连接</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <Select
          value={outputMode}
          onValueChange={(value: 'array' | 'concat') =>
            onChange({ ...config, output_mode: value })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="选择输出模式" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="array">数组格式（JSON Array）</SelectItem>
            <SelectItem value="concat">拼接文本</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* 失败重试次数 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Label>失败重试次数</Label>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                单个并发任务失败后自动重试。0 表示不重试，默认 3 次。
              </TooltipContent>
            </Tooltip>
          </div>
          <span className="text-sm font-medium tabular-nums">{retryCount} 次</span>
        </div>
        <Slider
          value={[retryCount]}
          onValueChange={([value]) => onChange({ ...config, retry_count: value })}
          min={0}
          max={10}
          step={1}
          className="py-2"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0 次（不重试）</span>
          <span>10 次（高容错）</span>
        </div>
      </div>

      {/* 拼接分隔符 */}
      {outputMode === 'concat' && (
        <div className="space-y-2">
          <Label htmlFor="output_separator">输出分隔符</Label>
          <Input
            id="output_separator"
            placeholder="输入分隔符（默认换行）"
            value={config.output_separator || ''}
            onChange={(e) =>
              onChange({ ...config, output_separator: e.target.value })
            }
          />
          <p className="text-xs text-muted-foreground">
            用于连接各任务输出的字符，留空则使用换行符
          </p>
        </div>
      )}

      {/* 使用说明 */}
      <div className="rounded-lg bg-muted/50 p-3 space-y-2">
        <h4 className="font-medium text-sm">使用说明</h4>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>并发块内的节点会同时执行</li>
          <li>每个并发任务接收相同的输入</li>
          <li>所有任务完成后，结果会合并输出</li>
          <li>单任务失败会按配置自动重试，耗尽后终止工作流</li>
          <li>适合对同一输入进行多种处理</li>
        </ul>
      </div>
    </div>
  )
}

