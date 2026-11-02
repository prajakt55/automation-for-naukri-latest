import { chromium } from 'playwright';

async function updateNaukriDescription() {
  const userDataDir = './user_data';
  const isCI = !!process.env.CI; // Automatically detects if running on GitHub Actions

  console.log('Launching browser with anti-detection flags...');
  const browser = await chromium.launchPersistentContext(userDataDir, {
    // Use system chrome locally, built-in chromium on GitHub Actions Linux
    ...(isCI ? {} : { channel: 'chrome' }),
    headless: isCI, // false locally, true on GitHub Actions
    slowMo: 50,
    ignoreDefaultArgs: ['--enable-automation'],
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      ...(isCI ? ['--disable-dev-shm-usage'] : [])
    ]
  });

  let page = browser.pages().find(p => p.url().includes('naukri.com'));
  if (!page) {
    page = browser.pages().length > 0 ? browser.pages()[0] : await browser.newPage();
  }

  // Hide webdriver flag from bot detection
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  try {
    console.log('Navigating to Naukri homepage...');
    await page.goto('https://www.naukri.com', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000); // Allow security check cookies to pass

    if (page.url().includes('nlogin') || page.url().includes('login')) {
      if (isCI) {
        throw new Error('Login required on CI, but no saved session found in user_data!');
      }
      console.log('--- ACTION REQUIRED ---');
      console.log('Please log in manually in the opened browser window.');
      await page.waitForURL('**/mnjuser/**', { timeout: 120000 });
      console.log('Login successful! Session cookies saved.');
    }

    console.log('Navigating to profile page...');
    await page.goto('https://www.naukri.com/mnjuser/profile?id=&altresid', { waitUntil: 'domcontentloaded' });
    
    // Wait for network requests and give dynamic widgets extra time to render on CI
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000); 
    console.log('Successfully reached the profile page!');

    // Resilient selector using case-insensitive text matching for "Resume Headline"
    const editButton = page.locator('div.widgetHead').filter({ hasText: /resume headline/i }).locator('span[role="button"], span.edit-icon, [class*="edit"]');
    
    await editButton.first().waitFor({ state: 'visible', timeout: 30000 });
    await editButton.first().scrollIntoViewIfNeeded();
    await editButton.first().click();

    const desciptionStoring = page.locator('textarea#resumeHeadline');
    let getDesctiptionData = await desciptionStoring.inputValue();

    const newHeadline = 'SDET / QA Automation Engineer | 4+ Yrs | Playwright, Selenium (Java), REST Assured, TestNG, Maven | API + UI Automation | CI/CD: Jenkins, GitHub Actions | Test Automation Expert | Immediate Joiner';

    if (getDesctiptionData.length > 0 && getDesctiptionData.endsWith('.')) {
      await desciptionStoring.fill(newHeadline);
      await page.getByRole('button', { name: 'Save' }).click();
    } else {
      await desciptionStoring.fill(newHeadline + '.');
      await page.getByRole('button', { name: 'Save' }).click();
    }

    console.log('Resume headline successfully updated and saved!');

  } catch (error) {
    console.error('An error occurred during automation:', error);
    process.exit(1);
  } finally {
    await browser.close();
    console.log('Automation finished.');
  }
}

updateNaukriDescription();