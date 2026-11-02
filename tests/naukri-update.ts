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
    // Direct navigation to the core profile page container
    await page.goto('https://www.naukri.com/mnjuser/profile?id=&altresid', { waitUntil: 'domcontentloaded' });
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(4000);

    if (page.url().includes('nlogin') || page.url().includes('login')) {
      if (isCI) {
        throw new Error('Login required on CI, but no saved session found in user_data!');
      }
      console.log('Please log in manually...');
      await page.waitForURL('**/mnjuser/**', { timeout: 120000 });
    }

    console.log('Locating Resume Headline container...');
    
    // Fallback strategy: Try clicking the edit icon using multiple broad selectors or JS click execution
    const editIconFound = await page.evaluate(() => {
      const spans = Array.from(document.querySelectorAll('span, div, a'));
      const target = spans.find(el => el.textContent && el.textContent.toLowerCase().includes('resume headline'));
      if (target) {
        // Look for an edit sibling or parent action button
        const card = target.closest('.card') || target.parentElement?.parentElement;
        const editBtn = card?.querySelector('.edit-icon, [class*="edit"], [icon="edit"], span[role="button"]');
        if (editBtn) {
          (editBtn as HTMLElement).click();
          return true;
        }
      }
      return false;
    });

    if (!editIconFound) {
      // Direct fallback: try pressing the textarea or anchor if already visible, or click by standard text selector
      console.log('Attempting secondary fallback selector click...');
      await page.locator('.edit-icon').first().click({ timeout: 5000 }).catch(() => {
        console.log('Proceeding to look for textarea directly...');
      });
    }

    // Wait for the headline text area to open
    const desciptionStoring = page.locator('textarea#resumeHeadline');
    await desciptionStoring.waitFor({ state: 'visible', timeout: 15000 });

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