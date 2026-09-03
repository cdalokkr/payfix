import { test, expect } from '@playwright/test'
import { instant } from '@next/playwright'

test('auth navigation reaches the signup shell without a full reload', async ({ page }) => {
  await page.goto('/login')

  await instant(page, async () => {
    await page.getByRole('link', { name: 'Sign up' }).click()
    await expect(page).toHaveURL(/\/signup$/)
    await expect(page.getByRole('heading', { name: 'Create Your Account' })).toBeVisible()
  })
})