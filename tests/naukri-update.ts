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
    await page.waitForTimeout(5000); // Allow dynamic widgets to mount

    if (page.url().includes('nlogin') || page.url().includes('login')) {
      if (isCI) {
        throw new Error('Login required on CI, but no saved session found in user_data!');
      }
      console.log('Please log in manually...');
      await page.waitForURL('**/mnjuser/**', { timeout: 120000 });
    }

    console.log('Locating Resume Headline and opening edit mode...');
    
    // Step 1: Click the Edit icon/button for Resume Headline using precise DOM traversal
    const clickedEdit = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('div, section, span, h2'));
      const headlineHeader = allElements.find(el => el.textContent && el.textContent.trim().toLowerCase() === 'resume headline');
      
      if (headlineHeader) {
        const card = headlineHeader.closest('.card') || headlineHeader.parentElement?.parentElement?.parentElement;
        const editBtn = card?.querySelector('.edit-icon, [class*="edit"], span[role="button"], em');
        if (editBtn) {
          (editBtn as HTMLElement).click();
          return true;
        }
      }
      // Fallback: search for any edit icon associated with resume headline
      const fallbackEdit = document.querySelector('#lazyResumeHead .edit-icon, [id*="ResumeHead"] [class*="edit"]');
      if (fallbackEdit) {
        (fallbackEdit as HTMLElement).click();
        return true;
      }
      return false;
    });

    console.log(`Edit button click triggered: ${clickedEdit}`);
    
    // Wait for the modal/textarea to render after clicking edit
    await page.waitForTimeout(4000);

    console.log('Updating resume headline text...');
    
    const newHeadline = 'SDET / QA Automation Engineer | 4+ Yrs | Playwright, Selenium (Java), REST Assured, TestNG, Maven | API + UI Automation | CI/CD: Jenkins, GitHub Actions | Test Automation Expert | Immediate Joiner';

    // Step 2: Use Playwright locator with extended timeout to find and fill the textarea
    const descriptionStoring = page.locator('textarea#resumeHeadline');
    await descriptionStoring.waitFor({ state: 'visible', timeout: 20000 });

    let getDescriptionData = await descriptionStoring.inputValue();

    if (getDescriptionData.length > 0 && getDescriptionData.endsWith('.')) {
      await descriptionStoring.fill(newHeadline);
    } else {
      await descriptionStoring.fill(newHeadline + '.');
    }

    // Step 3: Click Save
    const saveButton = page.locator('button[type="submit"], button.btn-dark-ot, button:has-text("Save")').first();
    await saveButton.click();
    
    // Wait for save operation to finish
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