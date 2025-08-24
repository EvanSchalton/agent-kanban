import { Page, Locator, expect } from '@playwright/test';

export class BasePage {
  protected page: Page;
  protected baseURL: string;

  constructor(page: Page) {
    this.page = page;
    this.baseURL = 'http://localhost:15173';
  }

  async navigate(path: string = '/'): Promise<void> {
    await this.page.goto(`${this.baseURL}${path}`);
    await this.waitForPageLoad();
  }

  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
  }

  async waitForElement(selector: string, timeout: number = 10000): Promise<void> {
    await this.page.waitForSelector(selector, { timeout });
  }

  async click(selector: string): Promise<void> {
    await this.page.click(selector);
  }

  async clickByText(text: string): Promise<void> {
    await this.page.click(`text="${text}"`);
  }

  async clickButtonWithText(text: string): Promise<void> {
    await this.page.click(`button:has-text("${text}")`);
  }

  async fill(selector: string, value: string): Promise<void> {
    await this.page.fill(selector, value);
  }

  async fillByPlaceholder(placeholder: string, value: string): Promise<void> {
    await this.page.fill(`[placeholder*="${placeholder}"]`, value);
  }

  async getText(selector: string): Promise<string> {
    return await this.page.textContent(selector) || '';
  }

  async isVisible(selector: string, timeout: number = 5000): Promise<boolean> {
    try {
      await this.page.waitForSelector(selector, { timeout, state: 'visible' });
      return true;
    } catch {
      return false;
    }
  }

  async isNotVisible(selector: string, timeout: number = 5000): Promise<boolean> {
    try {
      await this.page.waitForSelector(selector, { timeout, state: 'hidden' });
      return true;
    } catch {
      return false;
    }
  }

  async waitForText(text: string, timeout: number = 10000): Promise<void> {
    await this.page.waitForSelector(`text="${text}"`, { timeout });
  }

  async waitAndClick(selector: string, timeout: number = 10000): Promise<void> {
    await this.waitForElement(selector, timeout);
    await this.click(selector);
  }

  async getLocator(selector: string): Locator {
    return this.page.locator(selector);
  }

  async getLocatorByText(text: string): Locator {
    return this.page.locator(`text="${text}"`);
  }

  async takeScreenshot(filename: string): Promise<void> {
    await this.page.screenshot({
      path: `tests/e2e/screenshots/${filename}`,
      fullPage: true
    });
  }

  async reload(): Promise<void> {
    await this.page.reload();
    await this.waitForPageLoad();
  }

  async pressKey(key: string): Promise<void> {
    await this.page.keyboard.press(key);
  }

  async waitForTimeout(milliseconds: number): Promise<void> {
    await this.page.waitForTimeout(milliseconds);
  }

  async dragAndDrop(sourceSelector: string, targetSelector: string): Promise<void> {
    const source = this.page.locator(sourceSelector);
    const target = this.page.locator(targetSelector);
    await source.dragTo(target);
  }

  async getElementCount(selector: string): Promise<number> {
    return await this.page.locator(selector).count();
  }

  async selectOption(selector: string, value: string): Promise<void> {
    await this.page.selectOption(selector, value);
  }

  async checkCheckbox(selector: string): Promise<void> {
    await this.page.check(selector);
  }

  async uncheckCheckbox(selector: string): Promise<void> {
    await this.page.uncheck(selector);
  }

  async isChecked(selector: string): Promise<boolean> {
    return await this.page.isChecked(selector);
  }

  async getInputValue(selector: string): Promise<string> {
    return await this.page.inputValue(selector);
  }

  async clearInput(selector: string): Promise<void> {
    await this.page.fill(selector, '');
  }

  async doubleClick(selector: string): Promise<void> {
    await this.page.dblclick(selector);
  }

  async rightClick(selector: string): Promise<void> {
    await this.page.click(selector, { button: 'right' });
  }

  async hover(selector: string): Promise<void> {
    await this.page.hover(selector);
  }

  async focus(selector: string): Promise<void> {
    await this.page.focus(selector);
  }

  async blur(selector: string): Promise<void> {
    await this.page.locator(selector).blur();
  }

  async scrollToElement(selector: string): Promise<void> {
    await this.page.locator(selector).scrollIntoViewIfNeeded();
  }

  async expectElementToBeVisible(selector: string): Promise<void> {
    await expect(this.page.locator(selector)).toBeVisible();
  }

  async expectElementNotToBeVisible(selector: string): Promise<void> {
    await expect(this.page.locator(selector)).not.toBeVisible();
  }

  async expectTextToBeVisible(text: string): Promise<void> {
    await expect(this.page.locator(`text="${text}"`)).toBeVisible();
  }

  async expectElementToHaveText(selector: string, text: string): Promise<void> {
    await expect(this.page.locator(selector)).toHaveText(text);
  }

  async expectElementToContainText(selector: string, text: string): Promise<void> {
    await expect(this.page.locator(selector)).toContainText(text);
  }

  async expectElementToHaveValue(selector: string, value: string): Promise<void> {
    await expect(this.page.locator(selector)).toHaveValue(value);
  }

  async expectElementToHaveCount(selector: string, count: number): Promise<void> {
    await expect(this.page.locator(selector)).toHaveCount(count);
  }

  async expectElementToBeEnabled(selector: string): Promise<void> {
    await expect(this.page.locator(selector)).toBeEnabled();
  }

  async expectElementToBeDisabled(selector: string): Promise<void> {
    await expect(this.page.locator(selector)).toBeDisabled();
  }

  async closeDialog(accept: boolean = true): Promise<void> {
    this.page.on('dialog', async dialog => {
      if (accept) {
        await dialog.accept();
      } else {
        await dialog.dismiss();
      }
    });
  }

  async getTitle(): Promise<string> {
    return await this.page.title();
  }

  async getURL(): Promise<string> {
    return this.page.url();
  }
}
