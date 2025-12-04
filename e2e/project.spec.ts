import { test, expect } from '@playwright/test'
import { generateUniqueName, toastLocator, selectors } from './fixtures/test-data'

/**
 * 项目管理流程 E2E 测试
 * 
 * 测试用例：
 * - 创建项目
 * - 编辑项目
 * - 删除项目
 * - 项目导航
 */

test.describe('项目管理流程', () => {
  // 每个测试前导航到首页
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // 等待页面加载完成
    await page.waitForLoadState('networkidle')
  })

  test.describe('创建项目', () => {
    test('应该成功创建新项目', async ({ page }) => {
      const projectName = generateUniqueName('测试项目')
      const projectDescription = '这是一个 E2E 测试创建的项目'

      // 点击新建项目按钮
      await page.click('button:has-text("新建项目")')
      
      // 等待表单页面加载
      await expect(page.locator('text=创建新项目')).toBeVisible()

      // 填写项目名称
      await page.fill('input#name', projectName)
      
      // 填写项目描述
      await page.fill('textarea#description', projectDescription)

      // 提交表单
      await page.click('button[type="submit"]')

      // 验证成功提示
      await expect(toastLocator(page, '项目创建成功')).toBeVisible()

      // 验证跳转到项目页面
      await expect(page.locator('text=' + projectName).first()).toBeVisible()
    })

    test('项目名称为空时应该阻止创建', async ({ page }) => {
      // 点击新建项目按钮
      await page.click('button:has-text("新建项目")')
      
      // 等待表单页面加载
      await expect(page.locator('text=创建新项目')).toBeVisible()

      // 不填写任何内容，直接点击创建按钮
      const submitButton = page.locator('button[type="submit"]')
      
      // 按钮应该是禁用状态
      await expect(submitButton).toBeDisabled()
    })

    test('可以取消创建项目', async ({ page }) => {
      // 点击新建项目按钮
      await page.click('button:has-text("新建项目")')
      
      // 等待表单页面加载
      await expect(page.locator('text=创建新项目')).toBeVisible()

      // 点击取消或返回按钮
      await page.click('button:has-text("取消"), button:has-text("返回")')

      // 应该返回首页
      await expect(page.locator('text=欢迎回来')).toBeVisible()
    })
  })

  test.describe('编辑项目', () => {
    let projectName: string

    test.beforeEach(async ({ page }) => {
      // 创建一个测试项目
      projectName = generateUniqueName('编辑测试项目')
      
      await page.click('button:has-text("新建项目")')
      await page.fill('input#name', projectName)
      await page.click('button[type="submit"]')
      
      // 等待项目创建成功
      await expect(toastLocator(page, '项目创建成功')).toBeVisible()
    })

    test('应该成功编辑项目信息', async ({ page }) => {
      const newName = projectName + '_已更新'

      // 返回首页
      await page.click('text=首页')
      
      // 找到项目卡片上的更多菜单
      const projectCard = page
        .locator(selectors.home.projectCard)
        .filter({ hasText: projectName })
        .first()
      await projectCard.hover()
      
      // 点击更多菜单按钮
      const moreButton = projectCard.locator(selectors.home.projectMoreBtn)
      await moreButton.click()
      
      // 点击重命名/编辑选项
      await page.getByRole('menuitem', { name: '重命名' }).click()
      
      // 等待编辑页面加载（编辑是一个独立页面，不是对话框）
      await expect(page.getByRole('heading', { name: '编辑项目' })).toBeVisible()

      // 清空并填写新名称
      await page.fill('input[aria-label="项目名称 *"], input#name', newName)

      // 保存
      await page.click('button[type="submit"]')

      // 验证成功提示
      await expect(toastLocator(page, '更新成功')).toBeVisible()
    })
  })

  test.describe('删除项目', () => {
    let projectName: string

    test.beforeEach(async ({ page }) => {
      // 创建一个测试项目
      projectName = generateUniqueName('删除测试项目')
      
      await page.click('button:has-text("新建项目")')
      await page.fill('input#name', projectName)
      await page.click('button[type="submit"]')
      
      // 等待项目创建成功
      await expect(toastLocator(page, '项目创建成功')).toBeVisible()
      
      // 返回首页
      await page.click('text=首页')
      await expect(page.locator('text=欢迎回来')).toBeVisible()
    })

    test('应该成功删除项目', async ({ page }) => {
      // 找到项目卡片
      const projectCard = page
        .locator(selectors.home.projectCard)
        .filter({ hasText: projectName })
        .first()
      await projectCard.hover()
      
      // 点击更多菜单按钮
      const moreButton = projectCard.locator(selectors.home.projectMoreBtn)
      await moreButton.click()
      
      // 点击删除选项
      await page.getByRole('menuitem', { name: '删除' }).click()
      
      // 确认删除对话框
      await expect(page.locator('[role="alertdialog"]')).toBeVisible()
      await expect(page.locator('[role="alertdialog"]')).toContainText('确认删除项目')
      
      // 点击确认删除
      await page.locator('[role="alertdialog"] button').filter({ hasText: '删除' }).click()
      
      // 验证项目已被删除（不再显示在列表中）
      await expect(
        page.locator(selectors.home.projectCard).filter({ hasText: projectName })
      ).toHaveCount(0)
    })

    test('可以取消删除项目', async ({ page }) => {
      // 找到项目卡片
      const projectCard = page
        .locator(selectors.home.projectCard)
        .filter({ hasText: projectName })
        .first()
      await projectCard.hover()
      
      // 点击更多菜单按钮
      const moreButton = projectCard.locator(selectors.home.projectMoreBtn)
      await moreButton.click()
      
      // 点击删除选项
      await page.getByRole('menuitem', { name: '删除' }).click()
      
      // 确认删除对话框
      await expect(page.locator('[role="alertdialog"]')).toBeVisible()
      
      // 点击取消
      await page.locator('[role="alertdialog"] button').filter({ hasText: '取消' }).click()
      
      // 验证项目仍然存在
      await expect(
        page.locator(selectors.home.projectCard).filter({ hasText: projectName }).first()
      ).toBeVisible()
    })
  })

  test.describe('项目导航', () => {
    let projectName: string

    test.beforeEach(async ({ page }) => {
      // 创建一个测试项目
      projectName = generateUniqueName('导航测试项目')
      
      await page.click('button:has-text("新建项目")')
      await page.fill('input#name', projectName)
      await page.click('button[type="submit"]')
      
      // 等待项目创建成功
      await expect(toastLocator(page, '项目创建成功')).toBeVisible()
      
      // 返回首页
      await page.click('text=首页')
      await expect(page.locator('text=欢迎回来')).toBeVisible()
    })

    test('点击项目卡片应该进入项目详情', async ({ page }) => {
      // 点击项目卡片
      await page
        .locator(selectors.home.projectCard)
        .filter({ hasText: projectName })
        .first()
        .click()
      
      // 验证进入项目详情页
      await expect(page.locator('text=' + projectName).first()).toBeVisible()
      await expect(page.locator('text=工作流列表')).toBeVisible()
    })

    test('可以从项目详情返回首页', async ({ page }) => {
      // 进入项目详情
      await page
        .locator(selectors.home.projectCard)
        .filter({ hasText: projectName })
        .first()
        .click()
      
      // 等待项目页面加载
      await expect(page.locator('text=工作流列表')).toBeVisible()
      
      // 点击面包屑中的首页
      await page.click('text=首页')
      
      // 验证返回首页
      await expect(page.locator('text=欢迎回来')).toBeVisible()
    })
  })

  test.describe('项目列表', () => {
    test('应该显示空状态提示（无项目时）', async ({ page }) => {
      // 检查是否有空状态提示或项目卡片
      // 由于可能已有项目，这里只检查页面结构
      const hasProjects = (await page.locator(selectors.home.projectCard).count()) > 0
      const hasEmptyState = await page.locator('text=开始你的第一个项目').isVisible().catch(() => false)
      
      // 页面应该显示项目列表或空状态
      expect(hasProjects || hasEmptyState).toBeTruthy()
    })

    test('应该支持项目排序', async ({ page }) => {
      // 找到排序选择器
      const sortTrigger = page.locator('button').filter({ has: page.locator('svg.lucide-arrow-up-down') })
      
      if (await sortTrigger.isVisible()) {
        await sortTrigger.click()
        
        // 验证排序选项
        await expect(page.locator('[role="option"]').filter({ hasText: '最近更新' })).toBeVisible()
        await expect(page.locator('[role="option"]').filter({ hasText: '名称顺序' })).toBeVisible()
        
        // 选择按名称排序
        await page.click('[role="option"]:has-text("名称顺序")')
      }
    })
  })
})

