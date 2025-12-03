// EmptyState 组件测试
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Inbox, FileQuestion, Search, FolderOpen } from 'lucide-react'
import { EmptyState } from '../empty-state'
import { Button } from '../button'

describe('EmptyState 组件', () => {
  // ========== 基础渲染测试 ==========
  describe('渲染', () => {
    it('应正确渲染标题', () => {
      render(<EmptyState title="暂无数据" />)
      expect(screen.getByText('暂无数据')).toBeInTheDocument()
    })

    it('应正确渲染描述', () => {
      render(
        <EmptyState 
          title="暂无数据" 
          description="这里还没有任何内容" 
        />
      )
      expect(screen.getByText('这里还没有任何内容')).toBeInTheDocument()
    })

    it('应在没有描述时不渲染描述元素', () => {
      render(<EmptyState title="暂无数据" />)
      // 只有标题，没有描述
      expect(screen.queryByText('这里还没有任何内容')).not.toBeInTheDocument()
    })
  })

  // ========== 图标测试 ==========
  describe('图标', () => {
    it('应正确渲染图标', () => {
      render(<EmptyState title="暂无数据" icon={Inbox} />)
      // 图标在一个圆形容器中
      const iconContainer = document.querySelector('.rounded-full')
      expect(iconContainer).toBeInTheDocument()
    })

    it('应支持不同的图标', () => {
      const { rerender } = render(<EmptyState title="没有文件" icon={FileQuestion} />)
      expect(document.querySelector('.rounded-full')).toBeInTheDocument()
      
      rerender(<EmptyState title="搜索无结果" icon={Search} />)
      expect(document.querySelector('.rounded-full')).toBeInTheDocument()
    })

    it('没有图标时不应渲染图标容器', () => {
      render(<EmptyState title="暂无数据" />)
      expect(document.querySelector('.rounded-full')).not.toBeInTheDocument()
    })
  })

  // ========== 自定义图片测试 ==========
  describe('自定义图片', () => {
    it('应正确渲染自定义图片', () => {
      render(
        <EmptyState 
          title="暂无数据" 
          image={<img src="/empty.png" alt="空状态" data-testid="empty-image" />} 
        />
      )
      expect(screen.getByTestId('empty-image')).toBeInTheDocument()
    })

    it('自定义图片应优先于图标', () => {
      render(
        <EmptyState 
          title="暂无数据" 
          icon={Inbox}
          image={<img src="/empty.png" alt="空状态" data-testid="empty-image" />} 
        />
      )
      // 应该渲染图片
      expect(screen.getByTestId('empty-image')).toBeInTheDocument()
      // 不应该渲染图标容器
      expect(document.querySelector('.rounded-full')).not.toBeInTheDocument()
    })

    it('应支持 SVG 作为图片', () => {
      render(
        <EmptyState 
          title="暂无数据" 
          image={
            <svg data-testid="custom-svg" width="100" height="100">
              <circle cx="50" cy="50" r="40" />
            </svg>
          } 
        />
      )
      expect(screen.getByTestId('custom-svg')).toBeInTheDocument()
    })
  })

  // ========== 操作按钮测试 ==========
  describe('操作按钮', () => {
    it('应正确渲染操作按钮', () => {
      render(
        <EmptyState 
          title="暂无项目" 
          action={<Button>创建项目</Button>} 
        />
      )
      expect(screen.getByRole('button', { name: '创建项目' })).toBeInTheDocument()
    })

    it('操作按钮应可点击', () => {
      const handleClick = vi.fn()
      render(
        <EmptyState 
          title="暂无项目" 
          action={<Button onClick={handleClick}>创建项目</Button>} 
        />
      )
      
      fireEvent.click(screen.getByRole('button', { name: '创建项目' }))
      expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('应支持多个操作按钮', () => {
      render(
        <EmptyState 
          title="暂无项目" 
          action={
            <div className="flex gap-2">
              <Button variant="outline">导入</Button>
              <Button>新建</Button>
            </div>
          } 
        />
      )
      expect(screen.getByRole('button', { name: '导入' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '新建' })).toBeInTheDocument()
    })

    it('没有操作按钮时不应渲染操作区域', () => {
      const { container } = render(<EmptyState title="暂无数据" />)
      // 只有标题
      expect(container.querySelectorAll('button')).toHaveLength(0)
    })
  })

  // ========== 样式测试 ==========
  describe('样式', () => {
    it('应支持自定义 className', () => {
      const { container } = render(
        <EmptyState title="暂无数据" className="custom-empty-state" />
      )
      expect(container.firstChild).toHaveClass('custom-empty-state')
    })

    it('应应用默认样式类', () => {
      const { container } = render(<EmptyState title="暂无数据" />)
      const element = container.firstChild as HTMLElement
      expect(element).toHaveClass('flex')
      expect(element).toHaveClass('flex-col')
      expect(element).toHaveClass('items-center')
      expect(element).toHaveClass('justify-center')
      expect(element).toHaveClass('text-center')
    })

    it('应包含动画样式类', () => {
      const { container } = render(<EmptyState title="暂无数据" />)
      const element = container.firstChild as HTMLElement
      expect(element).toHaveClass('animate-in')
      expect(element).toHaveClass('fade-in-50')
    })
  })

  // ========== 不同场景测试 ==========
  describe('不同场景', () => {
    it('搜索无结果场景', () => {
      render(
        <EmptyState 
          icon={Search}
          title="未找到匹配结果" 
          description="尝试使用不同的关键词搜索"
          action={<Button variant="outline">清除搜索</Button>}
        />
      )
      expect(screen.getByText('未找到匹配结果')).toBeInTheDocument()
      expect(screen.getByText('尝试使用不同的关键词搜索')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '清除搜索' })).toBeInTheDocument()
    })

    it('空文件夹场景', () => {
      render(
        <EmptyState 
          icon={FolderOpen}
          title="文件夹为空" 
          description="此文件夹中没有任何文件"
          action={<Button>上传文件</Button>}
        />
      )
      expect(screen.getByText('文件夹为空')).toBeInTheDocument()
      expect(screen.getByText('此文件夹中没有任何文件')).toBeInTheDocument()
    })

    it('新用户欢迎场景', () => {
      render(
        <EmptyState 
          icon={Inbox}
          title="欢迎使用" 
          description="开始创建你的第一个项目"
          action={
            <div className="flex gap-2">
              <Button variant="outline">查看教程</Button>
              <Button>立即开始</Button>
            </div>
          }
        />
      )
      expect(screen.getByText('欢迎使用')).toBeInTheDocument()
      expect(screen.getByText('开始创建你的第一个项目')).toBeInTheDocument()
    })

    it('错误状态场景', () => {
      render(
        <EmptyState 
          icon={FileQuestion}
          title="页面未找到" 
          description="您访问的页面不存在或已被删除"
          action={<Button>返回首页</Button>}
        />
      )
      expect(screen.getByText('页面未找到')).toBeInTheDocument()
    })
  })

  // ========== 组合测试 ==========
  describe('组合', () => {
    it('完整配置应正确渲染', () => {
      render(
        <EmptyState 
          icon={Inbox}
          title="暂无消息"
          description="您的收件箱是空的"
          action={<Button>刷新</Button>}
          className="min-h-[300px]"
        />
      )
      
      // 所有元素都应该存在
      expect(screen.getByText('暂无消息')).toBeInTheDocument()
      expect(screen.getByText('您的收件箱是空的')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: '刷新' })).toBeInTheDocument()
    })

    it('最小配置应正确渲染', () => {
      render(<EmptyState title="空" />)
      expect(screen.getByText('空')).toBeInTheDocument()
    })
  })
})

