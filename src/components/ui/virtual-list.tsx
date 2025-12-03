import { useRef, ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'

interface VirtualListProps<T> {
  /** 列表数据 */
  items: T[]
  /** 预估的每项高度(像素) */
  estimateSize: number
  /** 渲染每一项的函数 */
  renderItem: (item: T, index: number) => ReactNode
  /** 容器类名 */
  className?: string
  /** 列表类名 */
  listClassName?: string
  /** 每项的唯一 key */
  getItemKey?: (item: T, index: number) => string | number
  /** 超出可视区域外渲染的额外项数 */
  overscan?: number
  /** 项之间的间距(像素) */
  gap?: number
  /** 内边距(像素) */
  padding?: number
}

/**
 * 虚拟列表组件
 * 使用 @tanstack/react-virtual 实现高性能大列表渲染
 */
export function VirtualList<T>({
  items,
  estimateSize,
  renderItem,
  className,
  listClassName,
  getItemKey,
  overscan = 5,
  gap = 0,
  padding = 0,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize + gap,
    overscan,
    getItemKey: getItemKey 
      ? (index) => getItemKey(items[index], index) 
      : undefined,
  })

  const virtualItems = virtualizer.getVirtualItems()

  return (
    <div
      ref={parentRef}
      className={cn("overflow-auto", className)}
    >
      <div
        className={listClassName}
        style={{
          height: `${virtualizer.getTotalSize() + padding * 2}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index]
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size - gap}px`,
                transform: `translateY(${virtualItem.start + padding}px)`,
              }}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface VirtualGridProps<T> {
  /** 列表数据 */
  items: T[]
  /** 列数 */
  columns: number
  /** 预估的每项高度(像素) */
  estimateSize: number
  /** 渲染每一项的函数 */
  renderItem: (item: T, index: number) => ReactNode
  /** 容器类名 */
  className?: string
  /** 每项的唯一 key */
  getItemKey?: (item: T, index: number) => string | number
  /** 超出可视区域外渲染的额外行数 */
  overscan?: number
  /** 行间距(像素) */
  rowGap?: number
  /** 列间距(像素) */
  columnGap?: number
  /** 内边距(像素) */
  padding?: number
}

/**
 * 虚拟网格组件
 * 适用于网格布局的大列表
 */
export function VirtualGrid<T>({
  items,
  columns,
  estimateSize,
  renderItem,
  className,
  getItemKey,
  overscan = 3,
  rowGap = 0,
  columnGap = 0,
  padding = 0,
}: VirtualGridProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null)

  // 计算行数
  const rowCount = Math.ceil(items.length / columns)

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize + rowGap,
    overscan,
  })

  const virtualRows = virtualizer.getVirtualItems()

  return (
    <div
      ref={parentRef}
      className={cn("overflow-auto", className)}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize() + padding * 2}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualRows.map((virtualRow) => {
          const rowStartIndex = virtualRow.index * columns
          const rowItems = items.slice(rowStartIndex, rowStartIndex + columns)

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size - rowGap}px`,
                transform: `translateY(${virtualRow.start + padding}px)`,
                display: 'grid',
                gridTemplateColumns: `repeat(${columns}, 1fr)`,
                gap: `0 ${columnGap}px`,
                paddingLeft: padding,
                paddingRight: padding,
              }}
            >
              {rowItems.map((item, colIndex) => {
                const itemIndex = rowStartIndex + colIndex
                return (
                  <div 
                    key={getItemKey ? getItemKey(item, itemIndex) : itemIndex}
                    className="min-w-0"
                  >
                    {renderItem(item, itemIndex)}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

