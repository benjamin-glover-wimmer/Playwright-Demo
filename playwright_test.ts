import * as fs from 'fs';
import { chromium, Browser, Page } from 'playwright';

interface TestObject {
  testName: string;
  functionalUnit: string;
  startUrl: string;
  startPageLoadObjects: { selector: string, expectedContent?: string }[];
  wait: number;
  steps: Step[];
}

interface Step {
  name: string;
  action: 'click' | 'fetch' | 'input';
  object?: string;
  url?: string;
  PageLoadObjects: { selector: string, expectedContent?: string }[];
  wait: number;
  input?: string;
}

const loadJsonArray = (filePath: string): TestObject => {
  const data = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(data);
};

const executeTest = async (testObject: TestObject, headless: boolean) => {
  let failedStep: string | null = null;
  const stepStatus: boolean[] = [];
  console.log(`Starting test: ${testObject.testName}`);
  
  // Launch the browser in headless or non-headless mode based on the argument
  const browser: Browser = await chromium.launch({ headless });
  const page: Page = await browser.newPage();

  console.log(`Navigating to start URL: ${testObject.startUrl}`);
  await page.goto(testObject.startUrl);

  // Handle start page load objects
  const startLoads = await Promise.all(
    testObject.startPageLoadObjects.map(async (item) => {
      try {
        console.log(`Waiting for selector: ${item.selector}`);
        await page.waitForSelector(item.selector, { timeout: testObject.wait });
        if (item.expectedContent) {
          const pageContent = await page.innerHTML(item.selector);
          if (!pageContent.includes(item.expectedContent)) {
            console.log(`Expected content NOT found for ${item.selector}`);
            stepStatus.push(false);
          } else {
            console.log(`Expected content found for ${item.selector}`);
            stepStatus.push(true);
          }
        }
        return true;
      } catch (e) {
        console.log(`Failed to load selector: ${item.selector}`);
        return false;
      }
    })
  );

  if (startLoads.includes(false)) {
    console.log('Start page load failed');
  }

  // Handle steps
  for (const step of testObject.steps) {
    const stepLoads: boolean[] = [];
    console.log(`Step: ${step.name} - Action: ${step.action}`);

    if (step.action === 'click' && step.object) {
      console.log(`Clicking on object: ${step.object}`);
      await page.click(step.object);
      for (const item of step.PageLoadObjects) {
        try {
          console.log(`Waiting for selector: ${item.selector}`);
          await page.waitForSelector(item.selector, { timeout: step.wait });
          stepLoads.push(true);

          // Check for expected content if provided
          if (item.expectedContent) {
            const pageContent = await page.innerHTML(item.selector);
            if (!pageContent.includes(item.expectedContent)) {
              console.log(`Expected content NOT found for ${item.selector}`);
              stepLoads.push(false);
            } else {
              console.log(`Expected content found for ${item.selector}`);
            }
          }
        } catch {
          console.log(`Failed to find selector: ${item.selector}`);
          stepLoads.push(false);
          failedStep = step.name;
        }
      }
    }

    if (step.action === 'fetch' && step.url) {
      console.log(`Navigating to URL: ${step.url}`);
      await page.goto(step.url);
      for (const item of step.PageLoadObjects) {
        try {
          console.log(`Waiting for selector: ${item.selector}`);
          await page.waitForSelector(item.selector, { timeout: step.wait });
          stepLoads.push(true);

          // Check for expected content if provided
          if (item.expectedContent) {
            const pageContent = await page.innerHTML(item.selector);
            if (!pageContent.includes(item.expectedContent)) {
              console.log(`Expected content NOT found for ${item.selector}`);
              stepLoads.push(false);
            } else {
              console.log(`Expected content found for ${item.selector}`);
            }
          }
        } catch {
          console.log(`Failed to find selector: ${item.selector}`);
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

    if (stepLoads.includes(false)) {
      console.log(`Step ${step.name} failed`);
      stepStatus.push(false);
    } else {
      console.log(`Step ${step.name} passed`);
      stepStatus.push(true);
    }
  }

  if (!stepStatus.includes(false)) {
    console.log(`Test ${testObject.testName} Passed`);
  } else {
    console.log(`Test ${testObject.testName} Failed`);
  }

  await browser.close();
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