import { test, expect } from '@playwright/test'
import { instant } from '@next/playwright'

test('auth navigation reaches the signup shell without a full reload', async ({ page }) => {
  await page.goto('/login')
  const signupLink = page.getByRole('link', { name: 'Sign up' })
  await signupLink.scrollIntoViewIfNeeded()
  await expect(signupLink).toBeVisible()

  await instant(page, async () => {
    await signupLink.click()
    await page.waitForURL(/\/signup$/)
    await expect(page.getByRole('heading', { name: 'Create Your Account' })).toBeVisible()
  })
})