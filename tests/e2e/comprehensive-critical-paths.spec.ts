import { test, expect, Page } from '@playwright/test';

/**
 * P0 CRITICAL: Comprehensive Critical Paths Testing
 *
 * Purpose: Test complete user workflows that combine board navigation,
 * card management, and drag & drop operations to ensure the system
 * works end-to-end without the column detection bug corrupting data.
 *
 * Critical User Journeys:
 * 1. Dashboard → Board → Create Cards → Organize via Drag & Drop
 * 2. Multi-board navigation with drag operations
 * 3. Search/filter across moved cards
 * 4. Real-time collaboration simulation
 * 5. Data persistence across page refreshes
 */

test.describe('🔴 P0: Critical User Paths - End-to-End Workflows', () => {
  const baseURL = 'http://localhost:15175';
  let page: Page;

  test.beforeEach(async ({ page: testPage }) => {
    page = testPage;
    await page.goto(baseURL);
    await page.waitForLoadState('networkidle');
  });

  test('Complete project workflow: Dashboard → Board → Task Management → Completion', async () => {
    console.log('🔴 Testing complete project workflow');

    // PHASE 1: Dashboard Navigation and Board Creation
    console.log('Phase 1: Dashboard and Board Management');

    const projectName = `Critical Path Project ${Date.now()}`;

    // Create new board from dashboard
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', projectName);
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(1000);

    // Navigate to the new board
    await page.click(`.board-card:has-text("${projectName}")`);
    await page.waitForSelector('.column');
    console.log('✅ Board created and navigation successful');

    // PHASE 2: Task Creation and Planning
    console.log('Phase 2: Task Creation and Planning');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    const projectTasks = [
      'Set up development environment',
      'Design system architecture',
      'Implement core features',
      'Write test cases',
      'Deploy to production'
    ];

    // Create all tasks in TODO column
    for (const task of projectTasks) {
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', task);

      const descField = page.locator('textarea[placeholder*="description" i]');
      if (await descField.isVisible()) {
        await descField.fill(`Detailed description for: ${task}`);
      }

      await page.click('button:has-text("Save")');
      await page.waitForTimeout(1000);
    }

    // Verify all tasks created
    const todoCards = await todoColumn.locator('.ticket-card').count();
    expect(todoCards).toBe(projectTasks.length);
    console.log(`✅ Created ${projectTasks.length} project tasks`);

    // PHASE 3: Work Progression Simulation
    console.log('Phase 3: Simulating Work Progression');

    // Start working on first task
    const firstTask = todoColumn.locator('.ticket-card').filter({ hasText: 'Set up development environment' });
    await firstTask.dragTo(inProgressColumn);
    await page.waitForTimeout(1500);

    // Verify task moved to IN PROGRESS
    const taskInProgress = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'Set up development environment' }).isVisible();
    expect(taskInProgress).toBe(true);
    console.log('✅ First task moved to IN PROGRESS');

    // Complete first task
    const firstTaskInProgress = inProgressColumn.locator('.ticket-card').filter({ hasText: 'Set up development environment' });
    await firstTaskInProgress.dragTo(doneColumn);
    await page.waitForTimeout(1500);

    // Start second task while first is completing
    const secondTask = todoColumn.locator('.ticket-card').filter({ hasText: 'Design system architecture' });
    await secondTask.dragTo(inProgressColumn);
    await page.waitForTimeout(1500);

    // Verify workflow state
    const tasksInDone = await doneColumn.locator('.ticket-card').count();
    const tasksInProgress = await inProgressColumn.locator('.ticket-card').count();
    const tasksInTodo = await todoColumn.locator('.ticket-card').count();

    expect(tasksInDone).toBe(1); // Set up environment completed
    expect(tasksInProgress).toBe(1); // Design architecture in progress
    expect(tasksInTodo).toBe(3); // Remaining tasks

    console.log('✅ Work progression workflow functioning correctly');

    // PHASE 4: Project Completion
    console.log('Phase 4: Project Completion Simulation');

    // Complete all remaining tasks rapidly (simulating completion)
    const remainingTasks = await todoColumn.locator('.ticket-card').all();
    for (const task of remainingTasks) {
      await task.dragTo(inProgressColumn);
      await page.waitForTimeout(500);

      // Move to done immediately (fast completion)
      const taskText = await task.textContent();
      const taskInProgress = inProgressColumn.locator('.ticket-card').filter({ hasText: taskText || '' });
      if (await taskInProgress.isVisible()) {
        await taskInProgress.dragTo(doneColumn);
        await page.waitForTimeout(500);
      }
    }

    // Complete the design task that was in progress
    const designTask = inProgressColumn.locator('.ticket-card').filter({ hasText: 'Design system architecture' });
    if (await designTask.isVisible()) {
      await designTask.dragTo(doneColumn);
      await page.waitForTimeout(1000);
    }

    // CRITICAL ASSERTION: All tasks should be in DONE column
    const finalDoneCount = await doneColumn.locator('.ticket-card').count();
    expect(finalDoneCount).toBe(projectTasks.length);

    const finalTodoCount = await todoColumn.locator('.ticket-card').count();
    const finalInProgressCount = await inProgressColumn.locator('.ticket-card').count();

    expect(finalTodoCount).toBe(0);
    expect(finalInProgressCount).toBe(0);

    console.log('✅ Project completion workflow successful - all tasks in DONE');

    // PHASE 5: Project Review and Navigation Back
    console.log('Phase 5: Project Review and Dashboard Navigation');

    // Navigate back to dashboard
    const backButton = page.locator('button, a').filter({ hasText: /back|dashboard|home/i }).first();
    if (await backButton.isVisible()) {
      await backButton.click();
    } else {
      // Alternative: click on logo or use browser back
      await page.goBack();
    }

    await page.waitForSelector('.board-card');

    // Verify our project board is visible in dashboard
    const projectBoard = page.locator('.board-card').filter({ hasText: projectName });
    expect(await projectBoard.isVisible()).toBe(true);

    console.log('✅ Complete project workflow test passed');
  });

  test('Multi-board navigation and cross-board consistency', async () => {
    console.log('🔴 Testing multi-board navigation and data consistency');

    // Create multiple boards for testing
    const boards = [
      'Frontend Development Board',
      'Backend API Board',
      'Testing and QA Board'
    ];

    // PHASE 1: Create multiple boards
    for (const boardName of boards) {
      await page.click('button:has-text("Create Board")');
      await page.fill('input[placeholder*="board name" i]', boardName);
      await page.click('button:has-text("Create")');
      await page.waitForTimeout(1000);
    }

    // PHASE 2: Add tasks to each board and test navigation
    for (let i = 0; i < boards.length; i++) {
      const boardName = boards[i];
      console.log(`Setting up board: ${boardName}`);

      // Navigate to board
      await page.click(`.board-card:has-text("${boardName}")`);
      await page.waitForSelector('.column');

      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
      const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();

      // Add tasks specific to this board
      const boardTasks = [
        `${boardName} Task 1`,
        `${boardName} Task 2`,
        `${boardName} Critical Bug`
      ];

      for (const task of boardTasks) {
        await todoColumn.locator('button:has-text("Add Card")').click();
        await page.fill('input[placeholder*="title" i]', task);
        await page.click('button:has-text("Save")');
        await page.waitForTimeout(800);
      }

      // Move one task to IN PROGRESS on each board
      const criticalTask = todoColumn.locator('.ticket-card').filter({ hasText: 'Critical Bug' });
      await criticalTask.dragTo(inProgressColumn);
      await page.waitForTimeout(1000);

      // Verify task moved correctly
      const taskMoved = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'Critical Bug' }).isVisible();
      expect(taskMoved).toBe(true);
      console.log(`✅ Tasks organized on ${boardName}`);

      // Navigate back to dashboard
      const backButton = page.locator('button, a').filter({ hasText: /back|dashboard/i }).first();
      if (await backButton.isVisible()) {
        await backButton.click();
      } else {
        await page.goBack();
      }
      await page.waitForSelector('.board-card');
    }

    // PHASE 3: Verify data persistence across boards
    console.log('Phase 3: Verifying data persistence across boards');

    for (const boardName of boards) {
      await page.click(`.board-card:has-text("${boardName}")`);
      await page.waitForSelector('.column');

      const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
      const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();

      // Verify tasks are still where we left them
      const todoCount = await todoColumn.locator('.ticket-card').count();
      const inProgressCount = await inProgressColumn.locator('.ticket-card').count();

      expect(todoCount).toBe(2); // 2 tasks should remain in TODO
      expect(inProgressCount).toBe(1); // 1 task should be in IN PROGRESS

      // Verify the critical bug is still in IN PROGRESS
      const criticalBugInProgress = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'Critical Bug' }).isVisible();
      expect(criticalBugInProgress).toBe(true);

      console.log(`✅ Data consistency verified for ${boardName}`);

      // Go back to dashboard
      await page.goBack();
      await page.waitForSelector('.board-card');
    }

    console.log('✅ Multi-board navigation and consistency test passed');
  });

  test('Real-time collaboration simulation with rapid operations', async () => {
    console.log('🔴 Testing real-time collaboration simulation');

    // Create collaboration test board
    const boardName = `Collaboration Test ${Date.now()}`;
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // Create team tasks
    const teamTasks = [
      'User 1 Frontend Task',
      'User 2 Backend Task',
      'User 3 Database Task',
      'User 4 Testing Task',
      'Shared Integration Task'
    ];

    for (const task of teamTasks) {
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', task);
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(500); // Rapid creation
    }

    // Simulate rapid team collaboration (multiple users working simultaneously)
    console.log('Simulating rapid team collaboration...');

    // Track API calls to ensure no data corruption
    const apiCalls: Array<{
      operation: string;
      column: string;
      timestamp: number;
    }> = [];

    await page.route('**/api/tickets/**', async route => {
      const request = route.request();
      if (request.method() === 'PUT' || request.method() === 'PATCH') {
        const payload = request.postDataJSON();
        apiCalls.push({
          operation: 'move',
          column: payload.current_column,
          timestamp: Date.now()
        });
      }
      await route.continue();
    });

    // Rapid movements simulating team members working
    const rapidOperations = [
      { task: 'User 1 Frontend Task', target: inProgressColumn },
      { task: 'User 2 Backend Task', target: inProgressColumn },
      { task: 'User 3 Database Task', target: doneColumn },
      { task: 'User 4 Testing Task', target: inProgressColumn },
      { task: 'Shared Integration Task', target: doneColumn }
    ];

    // Execute operations with minimal delays (simulating concurrent users)
    for (const op of rapidOperations) {
      const taskCard = page.locator('.ticket-card').filter({ hasText: op.task }).first();
      if (await taskCard.isVisible()) {
        await taskCard.dragTo(op.target);
        await page.waitForTimeout(300); // Minimal delay between operations
      }
    }

    // Wait for all operations to complete
    await page.waitForTimeout(3000);

    // CRITICAL ASSERTIONS: Verify final state is correct
    const finalTodoCount = await todoColumn.locator('.ticket-card').count();
    const finalInProgressCount = await inProgressColumn.locator('.ticket-card').count();
    const finalDoneCount = await doneColumn.locator('.ticket-card').count();

    expect(finalTodoCount).toBe(0); // All tasks moved
    expect(finalInProgressCount).toBe(3); // Three tasks in progress
    expect(finalDoneCount).toBe(2); // Two tasks completed

    // Verify no API calls used wrong column IDs
    for (const apiCall of apiCalls) {
      expect(apiCall.column).not.toBe('Not Started'); // Bug would cause this
      expect(apiCall.column).not.toBe('TODO'); // Should use proper API values
    }

    console.log(`✅ Rapid collaboration simulation: ${apiCalls.length} operations completed successfully`);
  });

  test('Data persistence and consistency across page refreshes', async () => {
    console.log('🔴 Testing data persistence across page refreshes');

    // Create test board and organize tasks
    const boardName = `Persistence Test ${Date.now()}`;
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // Create and organize tasks
    const tasks = [
      { title: 'Persistence Task 1', finalColumn: inProgressColumn },
      { title: 'Persistence Task 2', finalColumn: doneColumn },
      { title: 'Persistence Task 3', finalColumn: todoColumn },
      { title: 'Persistence Task 4', finalColumn: doneColumn }
    ];

    // Create all tasks
    for (const task of tasks) {
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', task.title);
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(1000);
    }

    // Move tasks to their final positions (except task 3 which stays in TODO)
    for (const task of tasks) {
      if (task.finalColumn !== todoColumn) {
        const taskCard = todoColumn.locator('.ticket-card').filter({ hasText: task.title });
        if (await taskCard.isVisible()) {
          await taskCard.dragTo(task.finalColumn);
          await page.waitForTimeout(1500);
        }
      }
    }

    // Record state before refresh
    const preRefreshState = {
      todo: await todoColumn.locator('.ticket-card').allTextContents(),
      inProgress: await inProgressColumn.locator('.ticket-card').allTextContents(),
      done: await doneColumn.locator('.ticket-card').allTextContents()
    };

    console.log('Pre-refresh state:', preRefreshState);

    // CRITICAL TEST: Refresh page
    console.log('Refreshing page to test persistence...');
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.column');

    // Wait for data to load
    await page.waitForTimeout(2000);

    // Get state after refresh
    const postRefreshState = {
      todo: await todoColumn.locator('.ticket-card').allTextContents(),
      inProgress: await inProgressColumn.locator('.ticket-card').allTextContents(),
      done: await doneColumn.locator('.ticket-card').allTextContents()
    };

    console.log('Post-refresh state:', postRefreshState);

    // CRITICAL ASSERTIONS: State should be identical
    expect(postRefreshState.todo.length).toBe(preRefreshState.todo.length);
    expect(postRefreshState.inProgress.length).toBe(preRefreshState.inProgress.length);
    expect(postRefreshState.done.length).toBe(preRefreshState.done.length);

    // Verify specific tasks are in correct columns
    expect(postRefreshState.todo.some(card => card.includes('Persistence Task 3'))).toBe(true);
    expect(postRefreshState.inProgress.some(card => card.includes('Persistence Task 1'))).toBe(true);
    expect(postRefreshState.done.some(card => card.includes('Persistence Task 2'))).toBe(true);
    expect(postRefreshState.done.some(card => card.includes('Persistence Task 4'))).toBe(true);

    console.log('✅ Data persistence verified across page refresh');
  });

  test('Search and filter functionality across complex workflows', async () => {
    console.log('🔴 Testing search/filter after complex workflows');

    // Create board with many tasks for search testing
    const boardName = `Search Test ${Date.now()}`;
    await page.click('button:has-text("Create Board")');
    await page.fill('input[placeholder*="board name" i]', boardName);
    await page.click('button:has-text("Create")');
    await page.click(`.board-card:has-text("${boardName}")`);
    await page.waitForSelector('.column');

    const todoColumn = page.locator('.column').filter({ hasText: 'TODO' }).first();
    const inProgressColumn = page.locator('.column').filter({ hasText: 'IN PROGRESS' }).first();
    const doneColumn = page.locator('.column').filter({ hasText: 'DONE' }).first();

    // Create diverse tasks for search testing
    const searchTestTasks = [
      { title: 'URGENT: Fix critical bug', column: inProgressColumn },
      { title: 'Feature: User authentication', column: doneColumn },
      { title: 'Bug: Login form validation', column: todoColumn },
      { title: 'URGENT: Database performance', column: inProgressColumn },
      { title: 'Feature: Password reset', column: doneColumn },
      { title: 'Documentation: API endpoints', column: todoColumn }
    ];

    // Create all tasks in TODO first
    for (const task of searchTestTasks) {
      await todoColumn.locator('button:has-text("Add Card")').click();
      await page.fill('input[placeholder*="title" i]', task.title);
      await page.click('button:has-text("Save")');
      await page.waitForTimeout(800);
    }

    // Move tasks to their designated columns
    for (const task of searchTestTasks) {
      if (task.column !== todoColumn) {
        const taskCard = todoColumn.locator('.ticket-card').filter({ hasText: task.title });
        if (await taskCard.isVisible()) {
          await taskCard.dragTo(task.column);
          await page.waitForTimeout(1000);
        }
      }
    }

    // TEST SEARCH FUNCTIONALITY
    const searchField = page.locator('input[placeholder*="search" i], input[type="search"]').first();

    if (await searchField.isVisible()) {
      console.log('Testing search functionality...');

      // Search for URGENT tasks
      await searchField.fill('URGENT');
      await page.waitForTimeout(1000);

      const urgentResults = await page.locator('.ticket-card').filter({ hasText: 'URGENT' }).count();
      expect(urgentResults).toBe(2); // Should find both urgent tasks

      // Verify they're in correct columns even after search
      const urgentBugInProgress = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'Fix critical bug' }).isVisible();
      const urgentDbInProgress = await inProgressColumn.locator('.ticket-card').filter({ hasText: 'Database performance' }).isVisible();

      expect(urgentBugInProgress).toBe(true);
      expect(urgentDbInProgress).toBe(true);

      // Clear search and test another term
      await searchField.clear();
      await searchField.fill('Feature');
      await page.waitForTimeout(1000);

      const featureResults = await page.locator('.ticket-card').filter({ hasText: 'Feature' }).count();
      expect(featureResults).toBe(2); // Should find both feature tasks

      // Verify features are in DONE column
      const authFeatureInDone = await doneColumn.locator('.ticket-card').filter({ hasText: 'User authentication' }).isVisible();
      const passwordFeatureInDone = await doneColumn.locator('.ticket-card').filter({ hasText: 'Password reset' }).isVisible();

      expect(authFeatureInDone).toBe(true);
      expect(passwordFeatureInDone).toBe(true);

      // Clear search
      await searchField.clear();
      await page.waitForTimeout(500);

      console.log('✅ Search functionality works correctly after task movements');
    }

    // TEST FILTER FUNCTIONALITY (if available)
    const filterButton = page.locator('button, select').filter({ hasText: /filter|status/i }).first();

    if (await filterButton.isVisible()) {
      console.log('Testing filter functionality...');

      await filterButton.click();
      await page.waitForTimeout(500);

      // Try to filter by IN PROGRESS status
      const inProgressFilter = page.locator('option, button').filter({ hasText: /in progress/i }).first();
      if (await inProgressFilter.isVisible()) {
        await inProgressFilter.click();
        await page.waitForTimeout(1000);

        // Should only show IN PROGRESS tasks
        const visibleCards = await page.locator('.ticket-card').count();
        const expectedInProgressCards = 2; // URGENT tasks moved there

        expect(visibleCards).toBe(expectedInProgressCards);
        console.log('✅ Filter correctly shows IN PROGRESS tasks');
      }
    }

    console.log('✅ Search and filter functionality verified');
  });

  test.afterEach(async () => {
    // Clean up and log final state
    console.log('\n=== Critical Path Test Completed ===');

    // Take screenshot if test failed
    if (test.info().status !== 'passed') {
      await page.screenshot({
        path: `tests/results/critical-path-failure-${Date.now()}.png`,
        fullPage: true
      });
    }
  });
});
