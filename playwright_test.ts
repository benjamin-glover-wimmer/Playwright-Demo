import fs from 'fs';
import { chromium, Browser, Page } from 'playwright';

interface TestObject {
  id: number;
  testName: string;
  functionalUnit: string;
  startUrl: string;
  startPageLoadObjects: string[]; 
  wait: number;
  steps: Step[];
}

interface Step {
  name: string;
  action: 'click' | 'fetch' | 'input';
  object?: string;
  url?: string;
  PageLoadObjects: string[];
  wait: number;
  input?: string;
}

const loadJsonArray = (filePath: string): TestObject => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data) as TestObject;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    throw error;
  }
};

const executeTest = async (testObject: TestObject, headless: boolean) => {
  let failedStep: string | null = null;
  const stepStatus: boolean[] = [];
  
  console.log(`Starting test: ${testObject.testName}`);
  
  // Ensure screenshots directory exists
  const screenshotsDir = './screenshots';
  if (!fs.existsSync(screenshotsDir)){
    fs.mkdirSync(screenshotsDir);
  }

  // Launch the browser in headless or non-headless mode based on the argument
  const browser: Browser = await chromium.launch({ headless });
  const page: Page = await browser.newPage();

  try {
    console.log(`Navigating to start URL: ${testObject.startUrl}`);
    await page.goto(testObject.startUrl, { waitUntil: 'networkidle' });

    // Take initial screenshot
    await page.screenshot({ path: `./screenshots/${testObject.testName}_start.png` });

    // Handle start page load objects
    const startLoads = await Promise.all(
      testObject.startPageLoadObjects.map(async (selector) => {
        try {
          console.log(`Waiting for start page selector: ${selector}`);
          await page.waitForSelector(selector, { 
            timeout: testObject.wait,
            state: 'visible'
          });
          console.log(`Selector ${selector} found successfully`);
          return true;
        } catch (e) {
          console.error(`Failed to load selector: ${selector}`, e);
          return false;
        }
      })
    );

    if (startLoads.includes(false)) {
      console.log('Start page load had some failures');
      stepStatus.push(false);
    }

    // Handle steps
    for (const step of testObject.steps) {
      const stepLoads: boolean[] = [];
      console.log(`Step: ${step.name} - Action: ${step.action}`);

      try {
        if (step.action === 'click' && step.object) {
          console.log(`Clicking on object: ${step.object}`);
          await page.click(step.object);
          
          // Wait for page load objects
          for (const selector of step.PageLoadObjects) {
            try {
              console.log(`Waiting for selector: ${selector}`);
              await page.waitForSelector(selector, { 
                timeout: step.wait,
                state: 'visible'
              });
              stepLoads.push(true);
            } catch (e) {
              console.error(`Failed to find selector: ${selector}`, e);
              stepLoads.push(false);
              failedStep = step.name;
            }
          }
        }

        if (step.action === 'fetch' && step.url) {
          console.log(`Navigating to URL: ${step.url}`);
          await page.goto(step.url, { waitUntil: 'networkidle' });
          
          // Wait for page load objects
          for (const selector of step.PageLoadObjects) {
            try {
              console.log(`Waiting for selector: ${selector}`);
              await page.waitForSelector(selector, { 
                timeout: step.wait,
                state: 'visible'
              });
              stepLoads.push(true);
            } catch (e) {
              console.error(`Failed to find selector: ${selector}`, e);
              stepLoads.push(false);
              failedStep = step.name;
            }
          }
        }

        if (step.action === 'input' && step.object && step.input) {
          console.log(`Filling input for object: ${step.object} with value: ${step.input}`);
          await page.fill(step.object, step.input);
          stepLoads.push(true);
        }

        // Take a screenshot after each step
        await page.screenshot({ 
          path: `./screenshots/${testObject.testName}_${step.name.replace(/\s+/g, '_')}.png` 
        });

        // Evaluate step status
        if (stepLoads.includes(false)) {
          console.log(`Step ${step.name} failed`);
          stepStatus.push(false);
        } else {
          console.log(`Step ${step.name} passed`);
          stepStatus.push(true);
        }
      } catch (stepError) {
        console.error(`Error in step ${step.name}:`, stepError);
        stepStatus.push(false);
        failedStep = step.name;
      }
    }

    // Evaluate overall test status
    if (!stepStatus.includes(false)) {
      console.log(`Test ${testObject.testName} Passed`);
    } else {
      console.log(`Test ${testObject.testName} Failed`);
      console.log(`Failed step: ${failedStep}`);
    }
  } catch (error) {
    console.error(`Test ${testObject.testName} encountered a critical error:`, error);
    
    // Take a screenshot when a critical error occurs
    await page.screenshot({ path: `./screenshots/${testObject.testName}_critical_error.png` });
  } finally {
    await browser.close();
  }
};

const runTests = async () => {
  const args = process.argv.slice(2);
  const headless = args.includes('--headless');

  for (const jsonFile of args.filter(file => file !== '--headless')) {
    const testObject = loadJsonArray(jsonFile);
    console.log(`Running test from ${jsonFile}:`);
    await executeTest(testObject, headless);
  }
};

runTests();