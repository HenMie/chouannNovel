// 变量选择器内容组件
// 共享的节点列表 + 变量列表面板

import { cn } from '@/lib/utils'
import { nodeColorMap, type NodeCategory, type OutputVariable } from './variable-picker-shared'

interface VariablePickerContentProps {
  categories: NodeCategory[]
  selectedCategoryIndex: number
  selectedVarIndex?: number
  onCategoryHover: (index: number) => void
  onCategoryClick: (index: number) => void
  onVariableHover?: (index: number) => void
  onVariableClick: (category: NodeCategory, variable: OutputVariable) => void
  // 是否显示变量高亮（PromptEditor 模式需要，Select 模式不需要）
  showVariableHighlight?: boolean
}

export function VariablePickerContent({
  categories,
  selectedCategoryIndex,
  selectedVarIndex = 0,
  onCategoryHover,
  onCategoryClick,
  onVariableHover,
  onVariableClick,
  showVariableHighlight = false,
}: VariablePickerContentProps) {
  const currentCategory = categories[selectedCategoryIndex]
  const currentVariables = currentCategory?.variables || []

  // 如果没有可用的变量，显示提示
  if (categories.length === 0) {
    return (
      <div className="px-4 py-6 text-center">
        <div className="text-sm text-muted-foreground">
          当前节点之前没有可引用的变量
        </div>
        <div className="mt-2 text-xs text-muted-foreground/70">
          请先添加开始节点或其他产生输出的节点
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[240px]">
      {/* 左列：节点列表 */}
      <div className="w-[160px] border-r bg-muted/20 overflow-y-auto">
        {categories.map((category, index) => {
          const Icon = category.icon
          const isSelected = index === selectedCategoryIndex
          const bgColor = nodeColorMap[category.nodeType]
          
          return (
            <div
              key={category.id}
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors',
                isSelected 
                  ? 'bg-primary/10 text-foreground' 
                  : 'text-muted-foreground hover:bg-muted/50'
              )}
              onMouseEnter={() => onCategoryHover(index)}
              onClick={() => onCategoryClick(index)}
            >
              <div className={cn(
                'flex h-5 w-5 items-center justify-center rounded flex-shrink-0',
                bgColor,
                'text-white'
              )}>
                <Icon className="h-3 w-3" />
              </div>
              <span className="text-sm truncate">{category.name}</span>
            </div>
          )
        })}
      </div>

      {/* 右列：变量列表 */}
      <div className="flex-1 overflow-y-auto p-2">
        {currentCategory && currentVariables.length > 0 ? (
          <div className="space-y-1">
            {currentVariables.map((item, index) => {
              const isSelected = showVariableHighlight && index === selectedVarIndex
              
              return (
                <div
                  key={`${currentCategory.id}-${item.varName}`}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-md cursor-pointer transition-all',
                    isSelected 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-primary hover:text-primary-foreground'
                  )}
                  onMouseEnter={() => onVariableHover?.(index)}
                  onClick={() => onVariableClick(currentCategory, item)}
                >
                  <span className="text-sm">{item.description}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
            该节点没有输出变量
          </div>
        )}
      </div>
    </div>
  )
}

