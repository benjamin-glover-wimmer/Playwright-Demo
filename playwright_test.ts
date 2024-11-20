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

interface TestResult {
  testName: string;
  status: 'passed' | 'failed';
  failedStep?: string;
  steps: StepResult[];
}

interface StepResult {
  name: string;
  status: 'passed' | 'failed';
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

const executeTest = async (testObject: TestObject, headless: boolean): Promise<TestResult> => {
  let failedStep: string | null = null;
  const stepResults: StepResult[] = [];
  let overallStatus: 'passed' | 'failed' = 'passed';
  
  console.log(`Starting test: ${testObject.testName}`);
  
  // Launch the browser in headless or non-headless mode based on the argument
  const browser: Browser = await chromium.launch({ headless });
  const page: Page = await browser.newPage();
  const result: TestResult = {
    testName: testObject.testName,
    status: 'passed',
    steps: []
  };

  try {
    console.log(`Navigating to start URL: ${testObject.startUrl}`);
    await page.goto(testObject.startUrl, { waitUntil: 'networkidle' });

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
      overallStatus = 'failed';
    }

    // Handle steps
    for (const step of testObject.steps) {
      const stepStatus: 'passed' | 'failed' = await handleStep(page, step);
      stepResults.push({ name: step.name, status: stepStatus });

      if (stepStatus === 'failed') {
        overallStatus = 'failed';
        failedStep = step.name;
      }
    }

    result.status = overallStatus;
    result.failedStep = failedStep || undefined;
    result.steps = stepResults;

  } catch (error) {
    console.error(`Test ${testObject.testName} encountered a critical error:`, error);
    result.status = 'failed';
    result.failedStep = 'Critical Error';
  } finally {
    await browser.close();
  }

  return result;
};

const handleStep = async (page: Page, step: Step): Promise<'passed' | 'failed'> => {
  try {
    console.log(`Step: ${step.name} - Action: ${step.action}`);

    if (step.action === 'click' && step.object) {
      console.log(`Clicking on object: ${step.object}`);
      await page.click(step.object);
      for (const selector of step.PageLoadObjects) {
        try {
          console.log(`Waiting for selector: ${selector}`);
          await page.waitForSelector(selector, { timeout: step.wait, state: 'visible' });
        } catch (e) {
          console.error(`Failed to find selector: ${selector}`, e);
          return 'failed';
        }
      }
    }

    if (step.action === 'fetch' && step.url) {
      console.log(`Navigating to URL: ${step.url}`);
      await page.goto(step.url, { waitUntil: 'networkidle' });
      for (const selector of step.PageLoadObjects) {
        try {
          console.log(`Waiting for selector: ${selector}`);
          await page.waitForSelector(selector, { timeout: step.wait, state: 'visible' });
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

    // Write results to a JSON file based on testName
    const resultFileName = `${testObject.testName}-results.json`;
    fs.writeFileSync(resultFileName, JSON.stringify([result], null, 2), 'utf8');
    console.log(`Test results saved to ${resultFileName}`);
  }
};

runTests();