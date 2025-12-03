import React from 'react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

export interface HeaderProps {
  title?: string
  breadcrumbs?: { label: string; href?: string }[]
  children?: React.ReactNode
  onNavigate?: (path: string) => void
}

export function Header({ title, breadcrumbs, children, onNavigate }: HeaderProps) {
  // 处理面包屑点击导航
  const handleBreadcrumbClick = (href: string) => {
    if (onNavigate) {
      onNavigate(href)
    }
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-background px-4">
      {/* 左侧：面包屑导航 */}
      <div className="flex items-center">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((item, index) => {
                const isLast = index === breadcrumbs.length - 1
                return (
                  <React.Fragment key={index}>
                    <BreadcrumbItem>
                      {isLast ? (
                        <BreadcrumbPage>{item.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          className="cursor-pointer"
                          onClick={() => handleBreadcrumbClick(item.href || '/')}
                        >
                          {item.label}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!isLast && <BreadcrumbSeparator />}
                  </React.Fragment>
                )
              })}
            </BreadcrumbList>
          </Breadcrumb>
        ) : (
          title && <h2 className="text-lg font-semibold">{title}</h2>
        )}
      </div>

      {/* 右侧：功能按钮 */}
      {children && (
        <div className="flex items-center gap-2">
          {children}
        </div>
      )}
    </header>
  )
}

