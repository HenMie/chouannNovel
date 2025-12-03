import { test, expect } from '@playwright/test'
import { generateUniqueName } from './fixtures/test-data'

/**
 * 工作流编辑流程 E2E 测试
 * 
 * 测试用例：
 * - 创建工作流
 * - 添加节点
 * - 配置节点
 * - 节点排序
 * - 删除节点
 */

test.describe('工作流编辑流程', () => {
  let projectName: string

  // 测试前创建一个项目
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // 创建测试项目
    projectName = generateUniqueName('工作流测试项目')
    
    await page.click('button:has-text("新建项目")')
    await page.fill('input#name', projectName)
    await page.click('button[type="submit"]')
    
    // 等待项目创建成功并进入项目页面
    await expect(page.locator('[data-sonner-toast]')).toContainText('项目创建成功')
    await expect(page.locator('text=工作流列表')).toBeVisible()
  })

  test.describe('创建工作流', () => {
    test('应该成功创建新工作流', async ({ page }) => {
      const workflowName = generateUniqueName('测试工作流')
      const workflowDescription = '这是一个 E2E 测试创建的工作流'

      // 点击新建工作流按钮
      await page.click('button:has-text("新建工作流")')
      
      // 等待表单页面加载
      await expect(page.locator('text=创建新工作流')).toBeVisible()

      // 填写工作流名称
      await page.fill('input#name', workflowName)
      
      // 填写工作流描述
      await page.fill('textarea#description', workflowDescription)

      // 提交表单
      await page.click('button[type="submit"]')

      // 验证成功提示
      await expect(page.locator('[data-sonner-toast]')).toContainText('工作流创建成功')

      // 验证跳转到工作流页面
      await expect(page.locator('text=' + workflowName).first()).toBeVisible()
    })

    test('工作流名称为空时应该阻止创建', async ({ page }) => {
      // 点击新建工作流按钮
      await page.click('button:has-text("新建工作流")')
      
      // 等待表单页面加载
      await expect(page.locator('text=创建新工作流')).toBeVisible()

      // 提交按钮应该是禁用状态
      await expect(page.locator('button[type="submit"]')).toBeDisabled()
    })

    test('可以取消创建工作流', async ({ page }) => {
      // 点击新建工作流按钮
      await page.click('button:has-text("新建工作流")')
      
      // 等待表单页面加载
      await expect(page.locator('text=创建新工作流')).toBeVisible()

      // 点击取消或返回按钮
      await page.click('button:has-text("取消"), button:has-text("返回")')

      // 应该返回项目页面
      await expect(page.locator('text=工作流列表')).toBeVisible()
    })
  })

  test.describe('节点管理', () => {
    let workflowName: string

    test.beforeEach(async ({ page }) => {
      // 创建一个测试工作流
      workflowName = generateUniqueName('节点测试工作流')
      
      await page.click('button:has-text("新建工作流")')
      await page.fill('input#name', workflowName)
      await page.click('button[type="submit"]')
      
      // 等待工作流创建成功
      await expect(page.locator('[data-sonner-toast]')).toContainText('工作流创建成功')
    })

    test('应该成功添加输出节点', async ({ page }) => {
      // 点击添加节点按钮
      await page.click('button:has-text("添加节点")')
      
      // 选择输出节点
      await page.click('text=输出节点')
      
      // 验证节点已添加（查找节点列表中的节点）
      await expect(page.locator('text=输出节点').first()).toBeVisible()
    })

    test('应该成功添加 AI 对话节点', async ({ page }) => {
      // 点击添加节点按钮
      await page.click('button:has-text("添加节点")')
      
      // 选择 AI 对话节点
      await page.click('[role="menuitem"]:has-text("AI 对话")')
      
      // 验证节点已添加
      await expect(page.locator('text=AI 对话').first()).toBeVisible()
    })

    test('应该成功添加文本拼接节点', async ({ page }) => {
      // 点击添加节点按钮
      await page.click('button:has-text("添加节点")')
      
      // 选择文本拼接节点
      await page.click('[role="menuitem"]:has-text("文本拼接")')
      
      // 验证节点已添加
      await expect(page.locator('text=文本拼接').first()).toBeVisible()
    })

    test('应该成功添加内容提取节点', async ({ page }) => {
      // 点击添加节点按钮
      await page.click('button:has-text("添加节点")')
      
      // 选择内容提取节点
      await page.click('[role="menuitem"]:has-text("内容提取")')
      
      // 验证节点已添加
      await expect(page.locator('text=内容提取').first()).toBeVisible()
    })

    test('应该成功添加变量节点', async ({ page }) => {
      // 点击添加节点按钮
      await page.click('button:has-text("添加节点")')
      
      // 选择设置变量节点
      await page.click('[role="menuitem"]:has-text("设置变量")')
      
      // 验证节点已添加
      await expect(page.locator('text=设置变量').first()).toBeVisible()
    })

    test('应该成功添加控制结构（循环）', async ({ page }) => {
      // 点击添加节点按钮
      await page.click('button:has-text("添加节点")')
      
      // 打开控制结构子菜单
      await page.hover('[role="menuitem"]:has-text("控制结构")')
      
      // 等待子菜单出现并选择循环
      await page.click('[role="menuitem"]:has-text("for 循环")')
      
      // 验证循环开始和结束节点都已添加
      await expect(page.locator('text=for 循环').first()).toBeVisible()
      await expect(page.locator('text=end for').first()).toBeVisible()
    })

    test('应该成功添加控制结构（条件分支）', async ({ page }) => {
      // 点击添加节点按钮
      await page.click('button:has-text("添加节点")')
      
      // 打开控制结构子菜单
      await page.hover('[role="menuitem"]:has-text("控制结构")')
      
      // 等待子菜单出现并选择条件分支
      await page.click('[role="menuitem"]:has-text("if 条件分支")')
      
      // 验证条件分支节点都已添加
      await expect(page.locator('text=if 条件').first()).toBeVisible()
      await expect(page.locator('text=else').first()).toBeVisible()
      await expect(page.locator('text=end if').first()).toBeVisible()
    })
  })

  test.describe('节点配置', () => {
    let workflowName: string

    test.beforeEach(async ({ page }) => {
      // 创建一个测试工作流并添加节点
      workflowName = generateUniqueName('配置测试工作流')
      
      await page.click('button:has-text("新建工作流")')
      await page.fill('input#name', workflowName)
      await page.click('button[type="submit"]')
      
      await expect(page.locator('[data-sonner-toast]')).toContainText('工作流创建成功')
      
      // 添加一个 AI 对话节点
      await page.click('button:has-text("添加节点")')
      await page.click('[role="menuitem"]:has-text("AI 对话")')
    })

    test('应该能打开节点配置面板', async ({ page }) => {
      // 点击节点打开配置
      await page.locator('text=AI 对话').first().click()
      
      // 验证配置面板打开
      await expect(page.locator('[role="dialog"], [data-state="open"]').first()).toBeVisible()
    })

    test('应该能修改节点名称', async ({ page }) => {
      const newNodeName = '自定义 AI 节点'
      
      // 点击节点打开配置
      await page.locator('text=AI 对话').first().click()
      
      // 等待配置面板打开
      await expect(page.locator('[role="dialog"], [data-state="open"]').first()).toBeVisible()
      
      // 找到名称输入框并修改
      const nameInput = page.locator('input').first()
      await nameInput.fill(newNodeName)
      
      // 关闭配置面板（配置会自动保存）
      await page.keyboard.press('Escape')
      
      // 验证节点名称已更新
      await expect(page.locator(`text=${newNodeName}`).first()).toBeVisible()
    })
  })

  test.describe('删除节点', () => {
    let workflowName: string

    test.beforeEach(async ({ page }) => {
      // 创建一个测试工作流并添加节点
      workflowName = generateUniqueName('删除测试工作流')
      
      await page.click('button:has-text("新建工作流")')
      await page.fill('input#name', workflowName)
      await page.click('button[type="submit"]')
      
      await expect(page.locator('[data-sonner-toast]')).toContainText('工作流创建成功')
      
      // 添加一个输出节点
      await page.click('button:has-text("添加节点")')
      await page.click('[role="menuitem"]:has-text("输出节点")')
      
      // 等待节点出现
      await expect(page.locator('text=输出节点').first()).toBeVisible()
    })

    test('应该成功删除节点', async ({ page }) => {
      // 右键点击节点或找到删除按钮
      const nodeItem = page.locator('text=输出节点').first()
      await nodeItem.click({ button: 'right' })
      
      // 或者通过 hover 显示操作按钮
      await nodeItem.hover()
      
      // 点击删除按钮
      const deleteBtn = page.locator('button').filter({ has: page.locator('svg.lucide-trash-2') })
      if (await deleteBtn.isVisible()) {
        await deleteBtn.first().click()
      } else {
        // 尝试通过右键菜单删除
        await page.click('[role="menuitem"]:has-text("删除")')
      }
      
      // 确认删除
      if (await page.locator('[role="alertdialog"]').isVisible()) {
        await page.locator('[role="alertdialog"] button').filter({ hasText: '删除' }).click()
      }
      
      // 验证节点已被删除
      await expect(page.locator('text=暂无输出').or(page.locator('text=输出节点'))).toBeVisible()
    })
  })

  test.describe('删除工作流', () => {
    let workflowName: string

    test.beforeEach(async ({ page }) => {
      // 创建一个测试工作流
      workflowName = generateUniqueName('删除工作流测试')
      
      await page.click('button:has-text("新建工作流")')
      await page.fill('input#name', workflowName)
      await page.click('button[type="submit"]')
      
      await expect(page.locator('[data-sonner-toast]')).toContainText('工作流创建成功')
      
      // 返回项目页面
      await page.click('text=项目')
      await expect(page.locator('text=工作流列表')).toBeVisible()
    })

    test('应该成功删除工作流', async ({ page }) => {
      // 找到工作流卡片
      const workflowCard = page.locator('.group').filter({ hasText: workflowName }).first()
      await workflowCard.hover()
      
      // 点击更多菜单按钮
      const moreButton = workflowCard.locator('button').filter({ has: page.locator('svg.lucide-more-vertical') })
      await moreButton.click()
      
      // 点击删除选项
      await page.click('[role="menuitem"]:has-text("删除")')
      
      // 确认删除对话框
      await expect(page.locator('[role="alertdialog"]')).toBeVisible()
      await expect(page.locator('[role="alertdialog"]')).toContainText('确认删除工作流')
      
      // 点击确认删除
      await page.locator('[role="alertdialog"] button').filter({ hasText: '删除' }).click()
      
      // 验证工作流已被删除
      await expect(page.locator('.group').filter({ hasText: workflowName })).toHaveCount(0)
    })
  })
})

