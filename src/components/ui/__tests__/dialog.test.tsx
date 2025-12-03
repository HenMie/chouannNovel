// Dialog 组件测试
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '../dialog'
import { Button } from '../button'

// 基础 Dialog 测试组件
function BasicDialog({
  onOpenChange,
  open,
  showCloseButton = true,
}: {
  onOpenChange?: (open: boolean) => void
  open?: boolean
  showCloseButton?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>打开对话框</Button>
      </DialogTrigger>
      <DialogContent showCloseButton={showCloseButton}>
        <DialogHeader>
          <DialogTitle>对话框标题</DialogTitle>
          <DialogDescription>这是对话框的描述内容</DialogDescription>
        </DialogHeader>
        <div>对话框主体内容</div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">取消</Button>
          </DialogClose>
          <Button>确认</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 受控 Dialog 组件
function ControlledDialog() {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <span data-testid="dialog-state">{open ? 'open' : 'closed'}</span>
      <BasicDialog open={open} onOpenChange={setOpen} />
    </div>
  )
}

// 带确认操作的 Dialog
function ConfirmDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void
  onCancel: () => void
}) {
  const [open, setOpen] = useState(false)
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>删除</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>确认删除</DialogTitle>
          <DialogDescription>确定要删除此项目吗？此操作不可撤销。</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => {
              onCancel()
              setOpen(false)
            }}
          >
            取消
          </Button>
          <Button 
            variant="destructive"
            onClick={() => {
              onConfirm()
              setOpen(false)
            }}
          >
            确认删除
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

describe('Dialog 组件', () => {
  // ========== 打开/关闭测试 ==========
  describe('打开/关闭', () => {
    it('点击触发器应打开对话框', async () => {
      const user = userEvent.setup()
      render(<BasicDialog />)
      
      // 初始状态对话框应该关闭
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      
      // 点击打开按钮
      await user.click(screen.getByRole('button', { name: '打开对话框' }))
      
      // 对话框应该打开
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
    })

    it('点击关闭按钮应关闭对话框', async () => {
      const user = userEvent.setup()
      render(<BasicDialog />)
      
      // 打开对话框
      await user.click(screen.getByRole('button', { name: '打开对话框' }))
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
      
      // 点击关闭按钮
      const dialog = screen.getByRole('dialog')
      const closeButton = within(dialog).getByRole('button', { name: 'Close' })
      await user.click(closeButton)
      
      // 对话框应该关闭
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    it('点击遮罩层应关闭对话框', async () => {
      const user = userEvent.setup()
      render(<BasicDialog />)
      
      await user.click(screen.getByRole('button', { name: '打开对话框' }))
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
      
      // 点击遮罩层
      const overlay = document.querySelector('[data-slot="dialog-overlay"]')
      if (overlay) {
        await user.click(overlay)
      }
      
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    it('按 Escape 键应关闭对话框', async () => {
      const user = userEvent.setup()
      render(<BasicDialog />)
      
      await user.click(screen.getByRole('button', { name: '打开对话框' }))
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
      
      await user.keyboard('{Escape}')
      
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    it('应触发 onOpenChange 回调', async () => {
      const handleOpenChange = vi.fn()
      const user = userEvent.setup()
      
      render(<BasicDialog onOpenChange={handleOpenChange} />)
      
      await user.click(screen.getByRole('button', { name: '打开对话框' }))
      
      expect(handleOpenChange).toHaveBeenCalledWith(true)
    })

    it('可以隐藏关闭按钮', async () => {
      const user = userEvent.setup()
      render(<BasicDialog showCloseButton={false} />)
      
      await user.click(screen.getByRole('button', { name: '打开对话框' }))
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
      
      // 不应该有关闭按钮
      const dialog = screen.getByRole('dialog')
      expect(within(dialog).queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    })
  })

  // ========== 内容渲染测试 ==========
  describe('内容渲染', () => {
    it('应正确渲染标题', async () => {
      const user = userEvent.setup()
      render(<BasicDialog />)
      
      await user.click(screen.getByRole('button', { name: '打开对话框' }))
      
      await waitFor(() => {
        expect(screen.getByText('对话框标题')).toBeInTheDocument()
      })
    })

    it('应正确渲染描述', async () => {
      const user = userEvent.setup()
      render(<BasicDialog />)
      
      await user.click(screen.getByRole('button', { name: '打开对话框' }))
      
      await waitFor(() => {
        expect(screen.getByText('这是对话框的描述内容')).toBeInTheDocument()
      })
    })

    it('应正确渲染主体内容', async () => {
      const user = userEvent.setup()
      render(<BasicDialog />)
      
      await user.click(screen.getByRole('button', { name: '打开对话框' }))
      
      await waitFor(() => {
        expect(screen.getByText('对话框主体内容')).toBeInTheDocument()
      })
    })

    it('应正确渲染页脚按钮', async () => {
      const user = userEvent.setup()
      render(<BasicDialog />)
      
      await user.click(screen.getByRole('button', { name: '打开对话框' }))
      
      await waitFor(() => {
        const dialog = screen.getByRole('dialog')
        expect(within(dialog).getByRole('button', { name: '取消' })).toBeInTheDocument()
        expect(within(dialog).getByRole('button', { name: '确认' })).toBeInTheDocument()
      })
    })

    it('应设置正确的 data-slot 属性', async () => {
      const user = userEvent.setup()
      render(<BasicDialog />)
      
      await user.click(screen.getByRole('button', { name: '打开对话框' }))
      
      await waitFor(() => {
        expect(document.querySelector('[data-slot="dialog-content"]')).toBeInTheDocument()
        expect(document.querySelector('[data-slot="dialog-header"]')).toBeInTheDocument()
        expect(document.querySelector('[data-slot="dialog-title"]')).toBeInTheDocument()
        expect(document.querySelector('[data-slot="dialog-description"]')).toBeInTheDocument()
        expect(document.querySelector('[data-slot="dialog-footer"]')).toBeInTheDocument()
      })
    })
  })

  // ========== 确认/取消操作测试 ==========
  describe('确认/取消操作', () => {
    it('点击取消应触发取消回调并关闭对话框', async () => {
      const handleConfirm = vi.fn()
      const handleCancel = vi.fn()
      const user = userEvent.setup()
      
      render(<ConfirmDialog onConfirm={handleConfirm} onCancel={handleCancel} />)
      
      // 打开对话框
      await user.click(screen.getByRole('button', { name: '删除' }))
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
      
      // 点击取消
      const dialog = screen.getByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: '取消' }))
      
      expect(handleCancel).toHaveBeenCalledTimes(1)
      expect(handleConfirm).not.toHaveBeenCalled()
      
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })

    it('点击确认应触发确认回调并关闭对话框', async () => {
      const handleConfirm = vi.fn()
      const handleCancel = vi.fn()
      const user = userEvent.setup()
      
      render(<ConfirmDialog onConfirm={handleConfirm} onCancel={handleCancel} />)
      
      // 打开对话框
      await user.click(screen.getByRole('button', { name: '删除' }))
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
      
      // 点击确认
      const dialog = screen.getByRole('dialog')
      await user.click(within(dialog).getByRole('button', { name: '确认删除' }))
      
      expect(handleConfirm).toHaveBeenCalledTimes(1)
      expect(handleCancel).not.toHaveBeenCalled()
      
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    })
  })

  // ========== 受控模式测试 ==========
  describe('受控模式', () => {
    it('受控模式下应正确同步状态', async () => {
      const user = userEvent.setup()
      render(<ControlledDialog />)
      
      // 初始状态
      expect(screen.getByTestId('dialog-state')).toHaveTextContent('closed')
      
      // 打开对话框
      await user.click(screen.getByRole('button', { name: '打开对话框' }))
      
      await waitFor(() => {
        expect(screen.getByTestId('dialog-state')).toHaveTextContent('open')
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
    })

    it('open=true 时应显示对话框', () => {
      render(<BasicDialog open={true} />)
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('open=false 时应隐藏对话框', () => {
      render(<BasicDialog open={false} />)
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  // ========== 无障碍测试 ==========
  describe('无障碍', () => {
    it('对话框应有正确的 role', async () => {
      const user = userEvent.setup()
      render(<BasicDialog />)
      
      await user.click(screen.getByRole('button', { name: '打开对话框' }))
      
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument()
      })
    })

    it('关闭按钮应有 sr-only 文本', async () => {
      const user = userEvent.setup()
      render(<BasicDialog />)
      
      await user.click(screen.getByRole('button', { name: '打开对话框' }))
      
      await waitFor(() => {
        const dialog = screen.getByRole('dialog')
        expect(within(dialog).getByText('Close')).toHaveClass('sr-only')
      })
    })
  })
})

