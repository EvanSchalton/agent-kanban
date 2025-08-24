// Quick test to verify drag drop console logs
const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  // Listen to console messages
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('Processing move') || text.includes('Drag') || text.includes('drop')) {
      console.log('CONSOLE:', text);
    }
  });

  page.on('pageerror', error => {
    console.log('PAGE ERROR:', error.message);
  });

  await page.goto('http://localhost:15173');
  await page.waitForTimeout(2000);

  // Check if board loaded
  const boardExists = await page.$('.board');
  console.log('Board loaded:', !!boardExists);

  // Try to find tickets
  const tickets = await page.$$('.ticket-card');
  console.log('Tickets found:', tickets.length);

  if (tickets.length >= 2) {
    // Simulate drag and drop
    const ticket1 = tickets[0];
    const ticket2 = tickets[1];

    const box1 = await ticket1.boundingBox();
    const box2 = await ticket2.boundingBox();

    if (box1 && box2) {
      // Start drag
      await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2);
      await page.mouse.down();

      // Move to second ticket
      await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
      await page.waitForTimeout(100);

      // Drop
      await page.mouse.up();

      console.log('Drag and drop simulated');
      await page.waitForTimeout(1000);
    }
  }

  await browser.close();
})();
