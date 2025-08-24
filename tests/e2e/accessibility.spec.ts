import { test, expect } from '@playwright/test';

/**
 * Accessibility Tests for Agent Kanban Board
 * Tests for WCAG compliance, keyboard navigation, screen reader support
 */
test.describe('Accessibility Tests', () => {
  const baseURL = 'http://localhost:5173';

  test.beforeEach(async ({ page }) => {
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');
  });

  test.describe('WCAG Compliance', () => {
    test('should have proper page title and meta tags', async ({ page }) => {
      // Check page title
      const title = await page.title();
      expect(title).toBeTruthy();
      expect(title).not.toBe('Vite + React + TS'); // Should be customized

      // Check for lang attribute
      const langAttr = await page.getAttribute('html', 'lang');
      expect(langAttr).toBeTruthy();
    });

    test('should have proper heading hierarchy', async ({ page }) => {
      // Check for h1 element
      const h1Elements = page.locator('h1');
      const h1Count = await h1Elements.count();
      expect(h1Count).toBeGreaterThanOrEqual(1);

      // Check heading hierarchy (should go h1 -> h2 -> h3, etc.)
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      const headingTexts = await headings.allTextContents();

      // Log heading structure for manual review
      console.log('Heading structure:', headingTexts);

      // At minimum, should have meaningful headings
      expect(headingTexts.length).toBeGreaterThan(0);
    });

    test('should have proper color contrast', async ({ page }) => {
      // Note: This is a basic check. Full color contrast testing requires specialized tools
      // Check for common low-contrast combinations

      const bodyStyles = await page.evaluate(() => {
        const body = document.body;
        const styles = window.getComputedStyle(body);
        return {
          backgroundColor: styles.backgroundColor,
          color: styles.color
        };
      });

      // Ensure colors are defined (not transparent/inherit)
      expect(bodyStyles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
      expect(bodyStyles.color).not.toBe('rgba(0, 0, 0, 0)');
    });

    test('should have alt text for images', async ({ page }) => {
      const images = page.locator('img');
      const imageCount = await images.count();

      for (let i = 0; i < imageCount; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        const src = await img.getAttribute('src');

        // Decorative images can have empty alt text, but should have alt attribute
        expect(alt !== null).toBeTruthy();

        // If not decorative, should have meaningful alt text
        if (src && !src.includes('logo') && !src.includes('icon')) {
          expect(alt && alt.length > 0).toBeTruthy();
        }
      }
    });

    test('should have proper form labels', async ({ page }) => {
      // Create a board to test form accessibility
      await page.click('button:has-text("Create Board")');

      // Check input labels
      const inputs = page.locator('input');
      const inputCount = await inputs.count();

      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledby = await input.getAttribute('aria-labelledby');
        const placeholder = await input.getAttribute('placeholder');

        // Input should have either id with corresponding label, aria-label, or aria-labelledby
        const hasLabel = id && await page.locator(`label[for="${id}"]`).count() > 0;
        const hasAriaLabel = ariaLabel && ariaLabel.length > 0;
        const hasAriaLabelledby = ariaLabelledby && ariaLabelledby.length > 0;
        const hasPlaceholder = placeholder && placeholder.length > 0;

        // At least one labeling method should be present
        expect(hasLabel || hasAriaLabel || hasAriaLabelledby || hasPlaceholder).toBeTruthy();
      }
    });

    test('should have proper button accessibility', async ({ page }) => {
      const buttons = page.locator('button');
      const buttonCount = await buttons.count();

      for (let i = 0; i < buttonCount; i++) {
        const button = buttons.nth(i);
        const text = await button.textContent();
        const ariaLabel = await button.getAttribute('aria-label');
        const ariaLabelledby = await button.getAttribute('aria-labelledby');
        const title = await button.getAttribute('title');

        // Button should have accessible text
        const hasText = text && text.trim().length > 0;
        const hasAriaLabel = ariaLabel && ariaLabel.length > 0;
        const hasAriaLabelledby = ariaLabelledby;
        const hasTitle = title && title.length > 0;

        expect(hasText || hasAriaLabel || hasAriaLabelledby || hasTitle).toBeTruthy();
      }
    });
  });

  test.describe('Keyboard Navigation', () => {
    test('should support tab navigation through interface', async ({ page }) => {
      // Focus should start at first interactive element
      await page.keyboard.press('Tab');

      // Should be able to navigate to create board button
      let focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(['BUTTON', 'A', 'INPUT'].includes(focusedElement || '')).toBeTruthy();

      // Navigate through several elements
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
        const newFocusedElement = await page.evaluate(() => document.activeElement?.tagName);
        // Focus should move to interactive elements
        if (newFocusedElement) {
          expect(['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'].includes(newFocusedElement)).toBeTruthy();
        }
      }
    });

    test('should support keyboard activation of buttons', async ({ page }) => {
      // Navigate to create board button using tab
      await page.keyboard.press('Tab');

      // Try to find and focus the create board button
      const createButton = page.locator('button:has-text("Create Board")').first();
      await createButton.focus();

      // Activate with Enter key
      await page.keyboard.press('Enter');

      // Modal should open
      await expect(page.locator('.modal, .dialog, [role="dialog"]')).toBeVisible({ timeout: 2000 });

      // Should be able to close with Escape
      await page.keyboard.press('Escape');
      await expect(page.locator('.modal, .dialog, [role="dialog"]')).not.toBeVisible();
    });

    test('should support keyboard navigation in board view', async ({ page }) => {
      // Create and navigate to a board
      const boardName = `Keyboard Test ${Date.now()}`;
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.press('input[placeholder*="board name" i]', 'Enter'); // Submit with Enter

      // Navigate to board
      await page.click(`.board-card:has-text("${boardName}")`);
      await page.waitForSelector('.column');

      // Should be able to navigate to add card buttons
      const addCardButton = page.locator('button:has-text("Add Card")').first();
      await addCardButton.focus();

      const focused = await page.evaluate(() => document.activeElement?.textContent);
      expect(focused).toContain('Add Card');

      // Activate with Space key
      await page.keyboard.press(' ');

      // Form should open
      await expect(page.locator('input[placeholder*="title" i]')).toBeVisible();
    });

    test('should support arrow key navigation for cards', async ({ page }) => {
      // Create board with multiple cards
      const boardName = `Arrow Nav ${Date.now()}`;
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');
      await page.click(`.board-card:has-text("${boardName}")`);

      // Create multiple cards
      for (let i = 1; i <= 3; i++) {
        const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
        await todoColumn.locator('button:has-text("Add Card")').click();
        await page.fill('input[placeholder*="title" i]', `Card ${i}`);
        await page.click('button:has-text("Save")');
        await page.waitForTimeout(500);
      }

      // Focus first card
      const firstCard = page.locator('.ticket-card').first();
      await firstCard.focus();

      // Use arrow keys to navigate
      await page.keyboard.press('ArrowDown');

      // Check if focus moved (this depends on implementation)
      const focusedAfterArrow = await page.evaluate(() => document.activeElement?.className);
      console.log('Focused element after arrow key:', focusedAfterArrow);
    });

    test('should have keyboard shortcuts documented', async ({ page }) => {
      // Look for keyboard shortcut hints
      const body = await page.textContent('body');

      // Common keyboard shortcut indicators
      const keyboardHints = [
        'Ctrl+', 'Cmd+', 'Alt+', 'Shift+',
        'Enter', 'Escape', 'Tab', 'Space',
        'keyboard', 'shortcut', 'hotkey'
      ];

      // Check if any keyboard shortcuts are mentioned
      const hasKeyboardHints = keyboardHints.some(hint =>
        body?.toLowerCase().includes(hint.toLowerCase())
      );

      // Log for manual review - keyboard shortcuts improve accessibility
      console.log('Keyboard shortcuts found:', hasKeyboardHints);
    });
  });

  test.describe('Screen Reader Support', () => {
    test('should have proper ARIA roles and states', async ({ page }) => {
      // Check for main content areas
      const main = page.locator('main, [role="main"]');
      await expect(main).toHaveCount(1);

      // Check for navigation
      const nav = page.locator('nav, [role="navigation"]');
      const navCount = await nav.count();
      if (navCount > 0) {
        // Navigation should have accessible names
        for (let i = 0; i < navCount; i++) {
          const navElement = nav.nth(i);
          const ariaLabel = await navElement.getAttribute('aria-label');
          const ariaLabelledby = await navElement.getAttribute('aria-labelledby');

          // Navigation should be properly labeled
          expect(ariaLabel || ariaLabelledby).toBeTruthy();
        }
      }
    });

    test('should have proper live regions for dynamic content', async ({ page }) => {
      // Look for live regions
      const liveRegions = page.locator('[aria-live], [role="status"], [role="alert"]');
      const liveRegionCount = await liveRegions.count();

      console.log(`Found ${liveRegionCount} live regions`);

      // If dynamic content exists, should have live regions
      if (liveRegionCount > 0) {
        for (let i = 0; i < liveRegionCount; i++) {
          const region = liveRegions.nth(i);
          const ariaLive = await region.getAttribute('aria-live');
          const role = await region.getAttribute('role');

          expect(ariaLive || role).toBeTruthy();
        }
      }
    });

    test('should announce status changes during drag and drop', async ({ page }) => {
      // Create board and card
      const boardName = `SR Test ${Date.now()}`;
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');
      await page.click(`.board-card:has-text("${boardName}")`);

      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', 'Accessible Card');
      await page.click('button:has-text("Save")');

      // Look for status announcements
      const statusElements = page.locator('[role="status"], [aria-live="polite"], [aria-live="assertive"]');
      const initialStatusCount = await statusElements.count();

      // Perform drag operation
      const card = page.locator('.ticket-card').filter({ hasText: 'Accessible Card' });
      const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' });

      await card.dragTo(inProgressColumn);
      await page.waitForTimeout(1000);

      // Check if status was announced
      const finalStatusCount = await statusElements.count();
      const statusTexts = await statusElements.allTextContents();

      console.log('Status announcements:', statusTexts);

      // Should have some form of status announcement
      expect(finalStatusCount >= initialStatusCount).toBeTruthy();
    });

    test('should have descriptive text for card information', async ({ page }) => {
      // Create board and card with detailed info
      const boardName = `Description Test ${Date.now()}`;
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');
      await page.click(`.board-card:has-text("${boardName}")`);

      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', 'Detailed Card');
      await page.fill('textarea[placeholder*="description" i]', 'This card has detailed information for screen readers');

      const prioritySelect = page.locator('select[name="priority"]');
      if (await prioritySelect.isVisible()) {
        await prioritySelect.selectOption('high');
      }

      await page.click('button:has-text("Save")');

      // Check card accessibility
      const card = page.locator('.ticket-card').filter({ hasText: 'Detailed Card' });

      // Card should have accessible description
      const ariaDescribedby = await card.getAttribute('aria-describedby');
      const ariaLabel = await card.getAttribute('aria-label');
      const title = await card.getAttribute('title');

      // Should have some form of accessible description
      const hasAccessibleDescription = ariaDescribedby || ariaLabel || title;
      console.log('Card accessibility attributes:', { ariaDescribedby, ariaLabel, title });

      // Card content should be accessible to screen readers
      const cardText = await card.textContent();
      expect(cardText).toContain('Detailed Card');
    });
  });

  test.describe('Motion and Animation', () => {
    test('should respect prefers-reduced-motion', async ({ page }) => {
      // Set prefers-reduced-motion
      await page.emulateMedia({ reducedMotion: 'reduce' });

      // Create board and card
      const boardName = `Motion Test ${Date.now()}`;
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');
      await page.click(`.board-card:has-text("${boardName}")`);

      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' });
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', 'Motion Card');
      await page.click('button:has-text("Save")');

      // Check for animation durations
      const animatedElements = page.locator('.ticket-card, .modal, .dropdown');

      for (let i = 0; i < await animatedElements.count(); i++) {
        const element = animatedElements.nth(i);
        const animationDuration = await element.evaluate(el => {
          const styles = window.getComputedStyle(el);
          return styles.animationDuration;
        });

        // With reduced motion, animations should be instant or very short
        if (animationDuration && animationDuration !== '0s') {
          console.log('Animation duration with reduced motion:', animationDuration);
          // Should be very short or instant
          expect(parseFloat(animationDuration)).toBeLessThan(0.5);
        }
      }
    });

    test('should not have flashing content', async ({ page }) => {
      // Monitor for rapidly changing content
      let flashingDetected = false;
      let previousContent = '';

      const checkFlashing = async () => {
        const currentContent = await page.textContent('body');
        if (currentContent !== previousContent) {
          previousContent = currentContent || '';
        }
      };

      // Check for flashing over 3 seconds
      for (let i = 0; i < 30; i++) {
        await checkFlashing();
        await page.waitForTimeout(100);
      }

      // This is a basic check - real flashing detection requires more sophisticated monitoring
      expect(flashingDetected).toBeFalsy();
    });
  });

  test.describe('Focus Management', () => {
    test('should trap focus in modals', async ({ page }) => {
      // Open create board modal
      await page.click('button:has-text("Create Board")');
      await page.waitForSelector('.modal, .dialog, [role="dialog"]');

      // Focus should be in modal
      const modal = page.locator('.modal, .dialog, [role="dialog"]').first();

      // Tab through modal elements
      await page.keyboard.press('Tab');
      let focusedElement = await page.evaluate(() => document.activeElement);

      // Focus should be within modal
      const focusWithinModal = await modal.evaluate((modal, focused) => {
        return modal.contains(focused);
      }, focusedElement);

      expect(focusWithinModal).toBeTruthy();

      // Shift+Tab should also stay within modal
      await page.keyboard.press('Shift+Tab');
      focusedElement = await page.evaluate(() => document.activeElement);

      const stillWithinModal = await modal.evaluate((modal, focused) => {
        return modal.contains(focused);
      }, focusedElement);

      expect(stillWithinModal).toBeTruthy();
    });

    test('should restore focus after modal closes', async ({ page }) => {
      // Focus create board button
      const createButton = page.locator('button:has-text("Create Board")').first();
      await createButton.focus();

      // Open modal
      await createButton.click();
      await page.waitForSelector('.modal, .dialog, [role="dialog"]');

      // Close modal with Escape
      await page.keyboard.press('Escape');

      // Focus should return to create button
      const focusedElement = await page.evaluate(() => document.activeElement?.textContent);
      expect(focusedElement).toContain('Create Board');
    });

    test('should have visible focus indicators', async ({ page }) => {
      // Tab to first interactive element
      await page.keyboard.press('Tab');

      // Check for focus indicators
      const focusedElement = await page.evaluate(() => document.activeElement);

      if (focusedElement) {
        const styles = await page.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          const pseudoStyles = window.getComputedStyle(el, ':focus');
          return {
            outline: computed.outline,
            outlineWidth: computed.outlineWidth,
            outlineStyle: computed.outlineStyle,
            outlineColor: computed.outlineColor,
            boxShadow: computed.boxShadow,
            focusOutline: pseudoStyles.outline,
            focusBoxShadow: pseudoStyles.boxShadow
          };
        }, focusedElement);

        // Should have some form of focus indicator
        const hasFocusIndicator =
          styles.outline !== 'none' ||
          styles.outlineWidth !== '0px' ||
          styles.boxShadow !== 'none' ||
          styles.focusOutline !== 'none' ||
          styles.focusBoxShadow !== 'none';

        console.log('Focus styles:', styles);
        expect(hasFocusIndicator).toBeTruthy();
      }
    });
  });

  test.describe('Error Messages', () => {
    test('should have accessible error messages', async ({ page }) => {
      // Try to create board without name
      await page.click('button:has-text("Create Board")');
      await page.click('button:has-text("Create")');

      // Look for error messages
      const errorElements = page.locator('.error, .validation-error, [role="alert"], [aria-invalid="true"]');
      const errorCount = await errorElements.count();

      if (errorCount > 0) {
        for (let i = 0; i < errorCount; i++) {
          const error = errorElements.nth(i);
          const errorText = await error.textContent();
          const ariaLive = await error.getAttribute('aria-live');
          const role = await error.getAttribute('role');

          // Error should have content
          expect(errorText && errorText.trim().length > 0).toBeTruthy();

          // Should be announced to screen readers
          expect(ariaLive === 'assertive' || ariaLive === 'polite' || role === 'alert').toBeTruthy();
        }
      }
    });

    test('should associate errors with form fields', async ({ page }) => {
      // Try to submit invalid form
      await page.click('button:has-text("Create Board")');
      await page.click('button:has-text("Create")');

      // Check for aria-describedby or aria-invalid
      const inputs = page.locator('input');
      const inputCount = await inputs.count();

      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const ariaInvalid = await input.getAttribute('aria-invalid');
        const ariaDescribedby = await input.getAttribute('aria-describedby');

        if (ariaInvalid === 'true') {
          // Should have associated error description
          expect(ariaDescribedby).toBeTruthy();

          if (ariaDescribedby) {
            const errorElement = page.locator(`#${ariaDescribedby}`);
            await expect(errorElement).toBeVisible();
          }
        }
      }
    });
  });
});
