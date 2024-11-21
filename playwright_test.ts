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
  PageLoadObjects: Array<{
    selector: string;
    expectedContent?: string | RegExp | ((content: string) => boolean);
    wait?: number;
  }>;
  wait: number;
  input?: string;
}

interface TestResult {
  testName: string;
  status: 'passed' | 'failed';
}

const isInteger = (content: string): boolean => {
  const parsed = parseInt(content, 10);
  return !isNaN(parsed) && Number.isInteger(parsed);
};

const isNumeric = (content: string): boolean => {
  return !isNaN(parseFloat(content)) && isFinite(parseFloat(content));
};

const validateContent = (
  content: string,
  expected: string | RegExp | ((content: string) => boolean)
): boolean => {
  if (typeof expected === 'string') {
    return content === expected;
  } else if (expected instanceof RegExp) {
    return expected.test(content);
  } else if (typeof expected === 'function') {
    return expected(content);
  }
  return false;
};

const loadJsonArray = (filePath: string): TestObject => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data) as TestObject;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    throw error;
  }
};

const executeTest = async (testObject: TestObject, headless: boolean): Promise<TestResult> => {
  let overallStatus: 'passed' | 'failed' = 'passed';

  console.log(`Starting test: ${testObject.testName}`);

  // Launch the browser in headless or non-headless mode based on the argument
  const browser: Browser = await chromium.launch({ headless });
  const page: Page = await browser.newPage();

  try {
    console.log(`Navigating to start URL: ${testObject.startUrl}`);
    await page.goto(testObject.startUrl, { waitUntil: 'networkidle' });

    // Handle start page load objects
    for (const selector of testObject.startPageLoadObjects) {
      try {
        console.log(`Waiting for start page selector: ${selector}`);
        await page.waitForSelector(selector, { timeout: testObject.wait, state: 'visible' });
        console.log(`Selector ${selector} found successfully`);
      } catch (e) {
        console.error(`Failed to load selector: ${selector}`, e);
        overallStatus = 'failed';
      }
    }

    // Handle steps
    for (const step of testObject.steps) {
      const stepStatus = await handleStep(page, step);
      if (stepStatus === 'failed') {
        overallStatus = 'failed';
      }
    }

  } catch (error) {
    console.error(`Test ${testObject.testName} encountered a critical error:`, error);
    overallStatus = 'failed';
  } finally {
    await browser.close();
  }

  return { testName: testObject.testName, status: overallStatus };
};

const handleStep = async (page: Page, step: Step): Promise<'passed' | 'failed'> => {
  try {
    console.log(`Step: ${step.name} - Action: ${step.action}`);

    if (step.action === 'click' && step.object) {
      console.log(`Clicking on object: ${step.object}`);
      await page.click(step.object);
      for (const { selector, expectedContent, wait } of step.PageLoadObjects) {
        try {
          console.log(`Waiting for selector: ${selector}`);
          await page.waitForSelector(selector, { timeout: wait || step.wait, state: 'visible' });
          if (expectedContent) {
            const element = page.locator(selector);
            const textContent = await element.textContent();
            if (textContent === null) {
              console.error(`Element ${selector} not found or has no text content.`);
              return 'failed';
            }
            if (!validateContent(textContent, expectedContent)) {
              console.error(`Content in element ${selector} does not match expected.`);
              return 'failed';
            }
          }
        } catch (e) {
          console.error(`Failed to find selector: ${selector}`, e);
          return 'failed';
        }
      }
    }

    if (step.action === 'fetch' && step.url) {
      console.log(`Navigating to URL: ${step.url}`);
      await page.goto(step.url, { waitUntil: 'networkidle' });
      for (const { selector, expectedContent, wait } of step.PageLoadObjects) {
        try {
          console.log(`Waiting for selector: ${selector}`);
          await page.waitForSelector(selector, { timeout: wait || step.wait, state: 'visible' });
          if (expectedContent) {
            const element = page.locator(selector);
            const textContent = await element.textContent();
            if (textContent === null) {
              console.error(`Element ${selector} not found or has no text content.`);
              return 'failed';
            }
            if (!validateContent(textContent, expectedContent)) {
              console.error(`Content in element ${selector} does not match expected.`);
              return 'failed';
            }
          }
        } catch (e) {
          console.error(`Failed to find selector: ${selector}`, e);
          return 'failed';
        }
      }
    }

    if (step.action === 'input' && step.object && step.input) {
      console.log(`Filling input for object: ${step.object} with value: ${step.input}`);
      await page.fill(step.object, step.input);
    }

    return 'passed';
  } catch (e) {
    console.error(`Error in step ${step.name}:`, e);
    return 'failed';
  }
};

const runTests = async () => {
  const args = process.argv.slice(2);
  const headless = args.includes('--headless');
  const testResults: TestResult[] = [];

  for (const jsonFile of args.filter(file => file !== '--headless')) {
    const testObject = loadJsonArray(jsonFile);
    console.log(`Running test from ${jsonFile}:`);
    const result = await executeTest(testObject, headless);
    testResults.push(result);
  }

  // Write results to a simple JSON file
  fs.writeFileSync('test-results.json', JSON.stringify(testResults, null, 2), 'utf8');
  console.log('Test results saved to test-results.json');
};

runTests();