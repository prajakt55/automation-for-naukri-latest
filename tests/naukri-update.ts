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
    console.log('Current Page Title:', await page.title());
    console.log('Current URL:', page.url());

    if (page.url().includes('nlogin') || page.url().includes('login') || page.url().includes('signup')) {
      throw new Error('Redirected to login/signup page on CI! Session cookies in user_data may have expired or were blocked.');
    }

    console.log('Scrolling down to trigger lazy-loaded profile widgets...');
    for (let i = 0; i < 4; i++) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(1500);
    }

    console.log('Polling DOM for Resume Headline edit button...');
    
    // Use a robust JavaScript polling evaluation to find and click the exact aria-label element
    const clicked = await page.evaluate(async () => {
      const findAndClick = () => {
        const btn = document.querySelector('[aria-label="Edit resume headline"]');
        if (btn) {
          (btn as HTMLElement).click();
          return true;
        }
        return false;
      };

      if (findAndClick()) return true;

      // If not found immediately, wait up to 10 seconds via polling
      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise(r => setTimeout(r, 1000));
        if (findAndClick()) return true;
      }
      return false;
    });

    if (!clicked) {
      // Take a diagnostic screenshot before throwing
      await page.screenshot({ path: 'ci-failure-debug.png', fullPage: true });
      throw new Error('Could not find the "Edit resume headline" element in the DOM on CI. Check ci-failure-debug.png artifact.');
    }

    console.log('Edit button clicked successfully! Waiting for textarea...');
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
    try {
      await page.screenshot({ path: 'ci-failure-debug.png', fullPage: true });
      console.log('Saved ci-failure-debug.png screenshot for inspection.');
    } catch (e) {}
    process.exit(1);
  } finally {
    await browser.close();
    console.log('Automation finished.');
  }
}

updateNaukriDescription();