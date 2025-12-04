import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { generateUniqueName, toastLocator, selectors } from './fixtures/test-data'

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

async function addNode(page: Page, menuLabel: string, openSubmenu = false) {
  // 点击添加节点按钮打开下拉菜单
  const addBtn = page.locator(selectors.workflow.addNodeBtn)
  await addBtn.click()
  
  // 如果需要打开子菜单（控制结构）
  if (openSubmenu) {
    const submenuTrigger = page.locator('[role="menuitem"]').filter({ hasText: '控制结构' })
    await expect(submenuTrigger).toBeVisible({ timeout: 5000 })
    await submenuTrigger.hover()
    // 等待子菜单出现
    await page.waitForTimeout(300)
  }
  
  // 等待菜单项出现并点击
  const menuItem = page.getByRole('menuitem', { name: menuLabel }).first()
  await expect(menuItem).toBeVisible({ timeout: 5000 })
  await menuItem.click()
}

// 节点类型到菜单标签和搜索标签的映射
// submenu 为 true 表示需要先打开控制结构子菜单
const nodeTypeMapping: Record<string, { menu: string; search: string; submenu?: boolean }> = {
  '输出节点': { menu: '输出节点', search: '输出' },
  '输出': { menu: '输出节点', search: '输出' },
  'AI 对话': { menu: 'AI 对话', search: 'AI 对话' },
  '文本拼接': { menu: '文本拼接', search: '文本拼接' },
  '内容提取': { menu: '内容提取', search: '内容提取' },
  '设置变量': { menu: '更新变量', search: '更新变量' },
  '更新变量': { menu: '更新变量', search: '更新变量' },
  'for 循环': { menu: 'for 循环', search: 'For 循环', submenu: true },
  'end for': { menu: 'for 循环', search: 'end for', submenu: true },
  'if 条件分支': { menu: 'if 条件分支', search: 'IF 条件', submenu: true },
  'if 条件': { menu: 'if 条件分支', search: 'IF 条件', submenu: true },
  'else': { menu: 'if 条件分支', search: 'Else', submenu: true },
  'end if': { menu: 'if 条件分支', search: 'End IF', submenu: true },
}

function nodeLocator(page: Page, keyword: string) {
  const mapping = nodeTypeMapping[keyword]
  const searchKeyword = mapping?.search ?? keyword
  return page.locator(selectors.workflow.nodeItem).filter({ hasText: searchKeyword }).first()
}

async function ensureNode(page: Page, keyword: string) {
  const mapping = nodeTypeMapping[keyword]
  const searchKeyword = mapping?.search ?? keyword
  const menuLabel = mapping?.menu ?? keyword
  const needsSubmenu = mapping?.submenu ?? false
  
  const locator = page.locator(selectors.workflow.nodeItem).filter({ hasText: searchKeyword }).first()
  if (!(await locator.isVisible().catch(() => false))) {
    await addNode(page, menuLabel, needsSubmenu)
    await expect(locator).toBeVisible()
  }
  return locator
}

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
    await expect(toastLocator(page, '项目创建成功')).toBeVisible()
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
      await expect(toastLocator(page, '工作流创建成功')).toBeVisible()

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
      await expect(toastLocator(page, '工作流创建成功')).toBeVisible()
    })

    test('应该成功添加输出节点', async ({ page }) => {
      await ensureNode(page, '输出节点')
    })

    test('应该成功添加 AI 对话节点', async ({ page }) => {
      await ensureNode(page, 'AI 对话')
    })

    test('应该成功添加文本拼接节点', async ({ page }) => {
      await ensureNode(page, '文本拼接')
    })

    test('应该成功添加内容提取节点', async ({ page }) => {
      await ensureNode(page, '内容提取')
    })

    test('应该成功添加变量节点', async ({ page }) => {
      await ensureNode(page, '设置变量')
    })

    test('应该成功添加控制结构（循环）', async ({ page }) => {
      await ensureNode(page, 'for 循环')
      await ensureNode(page, 'end for')
    })

    test('应该成功添加控制结构（条件分支）', async ({ page }) => {
      await ensureNode(page, 'if 条件')
      await ensureNode(page, 'else')
      await ensureNode(page, 'end if')
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
      
      await expect(toastLocator(page, '工作流创建成功')).toBeVisible()
      
      // 添加一个 AI 对话节点
      await addNode(page, 'AI 对话')
    })

    test('应该能打开节点配置面板', async ({ page }) => {
      // 点击节点打开配置
      const node = await ensureNode(page, 'AI 对话')
      await node.click()
      
      // 验证配置面板打开
      await expect(page.locator('[role="dialog"], [data-state="open"]').first()).toBeVisible()
    })

    test('应该能修改节点名称', async ({ page }) => {
      const newNodeName = '自定义 AI 节点'
      
      // 点击节点打开配置
      const node = await ensureNode(page, 'AI 对话')
      await node.click()
      
      // 等待配置面板打开
      await expect(page.locator('[role="dialog"], [data-state="open"]').first()).toBeVisible()
      
      // 找到名称输入框并修改
      const nameInput = page.locator('input').first()
      await nameInput.fill(newNodeName)
      
      // 关闭配置面板（配置会自动保存）
      await page.keyboard.press('Escape')
      
      // 验证节点名称已更新
      await expect(nodeLocator(page, newNodeName)).toBeVisible()
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
      
      await expect(toastLocator(page, '工作流创建成功')).toBeVisible()
      
      // 添加一个输出节点
      await ensureNode(page, '输出节点')
    })

    test('应该成功删除节点', async ({ page }) => {
      // 右键点击节点或找到删除按钮
      const nodeItem = await ensureNode(page, '输出节点')
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
      await expect(
        page.locator(selectors.workflow.nodeItem).filter({ hasText: '输出节点' })
      ).toHaveCount(0)
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
      
      await expect(toastLocator(page, '工作流创建成功')).toBeVisible()
      
      // 返回项目页面
      await page.click('text=项目')
      await expect(page.locator('text=工作流列表')).toBeVisible()
    })

    test('应该成功删除工作流', async ({ page }) => {
      // 找到工作流卡片
      const workflowCard = page
        .locator(selectors.project.workflowCard)
        .filter({ hasText: workflowName })
        .first()
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
      await expect(
        page.locator(selectors.project.workflowCard).filter({ hasText: workflowName })
      ).toHaveCount(0)
    })
  })
})

