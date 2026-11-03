import { chromium } from 'playwright';

async function updateNaukriDescription() {
  const userDataDir = './user_data';
  const isCI = !!process.env.CI;

  console.log('Launching browser with anti-detection flags...');
  const browser = await chromium.launchPersistentContext(userDataDir, {
    ...(isCI ? {} : { channel: 'chrome' }),
    headless: isCI,
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

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  try {
    console.log('Navigating to Naukri profile...');
    await page.goto('https://www.naukri.com/mnjuser/profile?id=&altresid', { waitUntil: 'domcontentloaded' });
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000); // Allow widgets to fully load on CI

    if (page.url().includes('nlogin') || page.url().includes('login')) {
      if (isCI) {
        throw new Error('Login required on CI, but no saved session found in user_data!');
      }
      console.log('Please log in manually...');
      await page.waitForURL('**/mnjuser/**', { timeout: 120000 });
    }

    console.log('Locating Resume Headline edit button...');
    
    // Exact match for your HTML: <span class="edit icon" role="button" tabindex="0" aria-label="Edit resume headline">
    const editButton = page.locator('span.edit.icon[aria-label="Edit resume headline"]');
    
    await editButton.waitFor({ state: 'visible', timeout: 30000 });
    await editButton.scrollIntoViewIfNeeded();
    
    // Using force: true ensures clicks aren't blocked by transparent overlays or layout quirks in CI
    await editButton.click({ force: true });
    
    console.log('Edit button clicked successfully. Waiting for textarea...');
    await page.waitForTimeout(3000);

    const descriptionStoring = page.locator('textarea#resumeHeadline');
    await descriptionStoring.waitFor({ state: 'visible', timeout: 20000 });

    let getDescriptionData = await descriptionStoring.inputValue();
    const newHeadline = 'SDET / QA Automation Engineer | 4+ Yrs | Playwright, Selenium (Java), REST Assured, TestNG, Maven | API + UI Automation | CI/CD: Jenkins, GitHub Actions | Test Automation Expert | Immediate Joiner';

    if (getDescriptionData.length > 0 && getDescriptionData.endsWith('.')) {
      await descriptionStoring.fill(newHeadline);
    } else {
      await descriptionStoring.fill(newHeadline + '.');
    }

    // Click Save
    const saveButton = page.locator('button[type="submit"], button.btn-dark-ot, button:has-text("Save")').first();
    await saveButton.click();
    
    await page.waitForTimeout(4000);
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