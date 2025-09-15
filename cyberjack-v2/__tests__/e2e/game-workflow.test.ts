// __tests__/e2e/game-workflow.test.ts

import { test, expect } from '@playwright/test'

test.describe('Game Workflow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Переходим на главную страницу
    await page.goto('http://localhost:3000')
  })

  test('complete game workflow', async ({ page }) => {
    // 1. Проверяем главную страницу
    await expect(page.locator('h1')).toContainText('CyberJack v2.0')

    // 2. Переходим в игровой интерфейс
    await page.click('text=Игровой интерфейс')
    await expect(page).toHaveURL(/.*\/game/)

    // 3. Проверяем загрузку персонажей
    await expect(page.locator('[data-testid="character-list"]')).toBeVisible()
    await expect(page.locator('[data-testid="character-card"]')).toHaveCount.greaterThan(0)

    // 4. Выбираем первого персонажа
    await page.click('[data-testid="character-card"]:first-child')
    await expect(page.locator('[data-testid="character-details"]')).toBeVisible()

    // 5. Проверяем отображение характеристик
    await expect(page.locator('[data-testid="characteristics-panel"]')).toBeVisible()
    await expect(page.locator('[data-testid="characteristic-item"]')).toHaveCount.greaterThan(0)

    // 6. Проверяем панель действий
    await expect(page.locator('[data-testid="actions-panel"]')).toBeVisible()
    await expect(page.locator('[data-testid="action-button"]')).toHaveCount.greaterThan(0)

    // 7. Выполняем действие с холдом
    const actionButton = page.locator('[data-testid="action-button"]:first-child')
    await actionButton.click()

    // Проверяем, что появился индикатор холда
    await expect(page.locator('[data-testid="action-hold-indicator"]')).toBeVisible()

    // Держим действие 2 секунды
    await page.mouse.down('[data-testid="action-zone"]')
    await page.waitForTimeout(2000)
    await page.mouse.up()

    // 8. Проверяем изменения характеристик
    await expect(page.locator('[data-testid="characteristic-value"]')).toContainText(/\d+/)

    // 9. Проверяем чат с ИИ
    await expect(page.locator('[data-testid="chat-panel"]')).toBeVisible()

    // Отправляем сообщение
    await page.fill('[data-testid="chat-input"]', 'Привет! Как дела?')
    await page.click('[data-testid="send-button"]')

    // Ждем ответ ИИ
    await expect(page.locator('[data-testid="ai-response"]')).toBeVisible({ timeout: 10000 })
    await expect(page.locator('[data-testid="ai-response"]')).toContainText(/.+/)

    // 10. Проверяем систему времени
    await expect(page.locator('[data-testid="time-display"]')).toBeVisible()
    await expect(page.locator('[data-testid="time-display"]')).toContainText(/\d{2}:\d{2}/)

    // 11. Проверяем навигацию между персонажами
    await page.click('[data-testid="character-card"]:nth-child(2)')
    await expect(page.locator('[data-testid="character-details"]')).toBeVisible()

    // Проверяем, что характеристики изменились
    await expect(page.locator('[data-testid="characteristic-item"]')).toHaveCount.greaterThan(0)
  })

  test('admin panel workflow', async ({ page }) => {
    // 1. Переходим в админ-панель
    await page.click('text=Админ-панель')
    await expect(page).toHaveURL(/.*\/admin/)

    // 2. Проверяем вкладки админ-панели
    await expect(page.locator('[data-testid="admin-tabs"]')).toBeVisible()
    await expect(page.locator('text=Характеристики')).toBeVisible()
    await expect(page.locator('text=Действия')).toBeVisible()
    await expect(page.locator('text=Позы')).toBeVisible()
    await expect(page.locator('text=Анатомия')).toBeVisible()

    // 3. Тестируем управление характеристиками
    await page.click('text=Характеристики')
    await expect(page.locator('[data-testid="characteristics-admin"]')).toBeVisible()

    // Создаем новую характеристику
    await page.click('[data-testid="create-characteristic-button"]')
    await page.fill('[data-testid="characteristic-name"]', 'Test Characteristic')
    await page.fill('[data-testid="characteristic-category"]', 'Test Category')
    await page.fill('[data-testid="characteristic-description"]', 'Test description')
    await page.click('[data-testid="save-characteristic-button"]')

    // Проверяем, что характеристика создалась
    await expect(page.locator('text=Test Characteristic')).toBeVisible()

    // 4. Тестируем управление действиями
    await page.click('text=Действия')
    await expect(page.locator('[data-testid="actions-admin"]')).toBeVisible()

    // Создаем новое действие
    await page.click('[data-testid="create-action-button"]')
    await page.fill('[data-testid="action-name"]', 'Test Action')
    await page.fill('[data-testid="action-category"]', 'Test Category')
    await page.fill('[data-testid="action-description"]', 'Test action description')
    await page.fill('[data-testid="action-intensity"]', '50')
    await page.click('[data-testid="save-action-button"]')

    // Проверяем, что действие создалось
    await expect(page.locator('text=Test Action')).toBeVisible()

    // 5. Тестируем управление позами
    await page.click('text=Позы')
    await expect(page.locator('[data-testid="poses-admin"]')).toBeVisible()

    // Проверяем список поз
    await expect(page.locator('[data-testid="pose-item"]')).toHaveCount.greaterThan(0)

    // 6. Тестируем управление анатомией
    await page.click('text=Анатомия')
    await expect(page.locator('[data-testid="anatomy-admin"]')).toBeVisible()

    // Создаем новую анатомическую зону
    await page.click('[data-testid="create-anatomy-button"]')
    await page.fill('[data-testid="anatomy-name"]', 'Test Zone')
    await page.fill('[data-testid="anatomy-category"]', 'Test Category')
    await page.fill('[data-testid="anatomy-description"]', 'Test anatomy description')
    await page.click('[data-testid="save-anatomy-button"]')

    // Проверяем, что зона создалась
    await expect(page.locator('text=Test Zone')).toBeVisible()
  })

  test('database interface workflow', async ({ page }) => {
    // 1. Переходим в интерфейс базы данных
    await page.click('text=Интерфейс БД')
    await expect(page).toHaveURL(/.*\/db/)

    // 2. Проверяем основные разделы
    await expect(page.locator('text=Персонажи')).toBeVisible()
    await expect(page.locator('text=Пользователи')).toBeVisible()
    await expect(page.locator('text=Система')).toBeVisible()

    // 3. Тестируем управление персонажами
    await page.click('text=Персонажи')
    await expect(page.locator('[data-testid="characters-list"]')).toBeVisible()

    // Проверяем список персонажей
    await expect(page.locator('[data-testid="character-item"]')).toHaveCount.greaterThan(0)

    // Создаем нового персонажа
    await page.click('[data-testid="create-character-button"]')
    await page.fill('[data-testid="character-name"]', 'E2E Test Character')
    await page.fill('[data-testid="character-description"]', 'Character created in E2E test')
    await page.fill('[data-testid="character-age"]', '25')
    await page.click('[data-testid="save-character-button"]')

    // Проверяем, что персонаж создался
    await expect(page.locator('text=E2E Test Character')).toBeVisible()

    // 4. Тестируем управление пользователями
    await page.click('text=Пользователи')
    await expect(page.locator('[data-testid="users-list"]')).toBeVisible()

    // Проверяем список пользователей
    await expect(page.locator('[data-testid="user-item"]')).toHaveCount.greaterThan(0)

    // 5. Тестируем системные настройки
    await page.click('text=Система')
    await expect(page.locator('[data-testid="system-settings"]')).toBeVisible()
  })

  test('responsive design', async ({ page }) => {
    // Тестируем на мобильном размере экрана
    await page.setViewportSize({ width: 375, height: 667 })

    // Проверяем, что интерфейс адаптируется
    await page.goto('http://localhost:3000/game')
    await expect(page.locator('[data-testid="character-list"]')).toBeVisible()

    // Проверяем мобильную навигацию
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible()

    // Тестируем на планшетном размере
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.reload()

    // Проверяем, что интерфейс корректно отображается
    await expect(page.locator('[data-testid="character-list"]')).toBeVisible()
    await expect(page.locator('[data-testid="character-details"]')).toBeVisible()
  })

  test('error handling', async ({ page }) => {
    // Тестируем обработку ошибок при недоступности API
    await page.route('**/api/**', route => route.abort())

    await page.goto('http://localhost:3000/game')

    // Проверяем, что отображается сообщение об ошибке
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible()

    // Восстанавливаем API
    await page.unroute('**/api/**')
    await page.reload()

    // Проверяем, что интерфейс загрузился
    await expect(page.locator('[data-testid="character-list"]')).toBeVisible()
  })

  test('performance and loading states', async ({ page }) => {
    // Проверяем индикаторы загрузки
    await page.goto('http://localhost:3000/game')

    // Должен быть индикатор загрузки при первой загрузке
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible()

    // Ждем загрузки данных
    await expect(page.locator('[data-testid="character-list"]')).toBeVisible()
    await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible()

    // Проверяем время загрузки
    const startTime = Date.now()
    await page.goto('http://localhost:3000/admin')
    await expect(page.locator('[data-testid="admin-tabs"]')).toBeVisible()
    const loadTime = Date.now() - startTime

    // Загрузка должна быть быстрой (менее 3 секунд)
    expect(loadTime).toBeLessThan(3000)
  })

  test('accessibility', async ({ page }) => {
    // Проверяем доступность интерфейса
    await page.goto('http://localhost:3000')

    // Проверяем наличие alt-текстов для изображений
    const images = page.locator('img')
    const imageCount = await images.count()
    for (let i = 0; i < imageCount; i++) {
      const alt = await images.nth(i).getAttribute('alt')
      expect(alt).toBeTruthy()
    }

    // Проверяем наличие aria-labels для кнопок
    const buttons = page.locator('button')
    const buttonCount = await buttons.count()
    for (let i = 0; i < buttonCount; i++) {
      const ariaLabel = await buttons.nth(i).getAttribute('aria-label')
      const text = await buttons.nth(i).textContent()
      expect(ariaLabel || text).toBeTruthy()
    }

    // Проверяем навигацию с клавиатуры
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')

    // Должна произойти навигация
    await expect(page).toHaveURL(/.*\/game/)
  })
})
