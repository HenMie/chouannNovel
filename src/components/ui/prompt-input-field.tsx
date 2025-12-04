import * as React from 'react'
import { Braces, Type } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Label } from './label'
import { Button } from './button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu'
import { PromptEditor } from './prompt-editor'
import { VariableSelect } from './variable-select'
import type { WorkflowNode } from '@/types'

// 输入模式类型
export type PromptInputMode = 'manual' | 'variable'

interface PromptInputFieldProps {
  id?: string
  label: string
  description?: string
  mode: PromptInputMode
  manualValue: string
  variableValue: string
  onModeChange: (mode: PromptInputMode) => void
  onManualChange: (value: string) => void
  onVariableChange: (value: string) => void
  nodes?: WorkflowNode[]
  currentNodeId?: string
  placeholder?: string
  minHeight?: string
  className?: string
  disabled?: boolean
}

const MODE_OPTIONS: Record<
  PromptInputMode,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  manual: {
    label: '手动输入',
    icon: Type,
  },
  variable: {
    label: '变量引用',
    icon: Braces,
  },
}

export function PromptInputField({
  id,
  label,
  description,
  mode,
  manualValue,
  variableValue,
  onModeChange,
  onManualChange,
  onVariableChange,
  nodes = [],
  currentNodeId,
  placeholder = '输入提示词，输入 / 触发变量选择...',
  minHeight,
  className,
  disabled = false,
}: PromptInputFieldProps) {
  const currentOption = MODE_OPTIONS[mode]

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <Label htmlFor={id}>{label}</Label>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              className="gap-1.5"
            >
              <currentOption.icon className="h-4 w-4 text-primary" />
              <span>{currentOption.label}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(MODE_OPTIONS) as PromptInputMode[]).map((option) => {
              const Icon = MODE_OPTIONS[option].icon
              return (
                <DropdownMenuItem
                  key={option}
                  className="gap-2"
                  onSelect={() => {
                    if (mode !== option) {
                      onModeChange(option)
                    }
                  }}
                >
                  <Icon className="h-4 w-4" />
                  <span>{MODE_OPTIONS[option].label}</span>
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {mode === 'manual' ? (
        <PromptEditor
          id={id}
          value={manualValue}
          onChange={onManualChange}
          placeholder={placeholder}
          minHeight={minHeight}
          nodes={nodes}
          currentNodeId={currentNodeId}
          disabled={disabled}
        />
      ) : (
        <div className="space-y-2">
          <VariableSelect
            value={variableValue}
            onChange={onVariableChange}
            nodes={nodes}
            currentNodeId={currentNodeId}
            placeholder="选择要引用的变量"
            disabled={disabled || nodes.length === 0}
          />
          {nodes.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              暂无可引用变量，请先在流程中添加有输出的节点
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              将直接引用变量内容，运行时提示词等于所选变量的值
            </p>
          )}
        </div>
      )}
    </div>
  )
}


