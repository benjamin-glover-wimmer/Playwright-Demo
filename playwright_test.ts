import fs from 'fs';
import { chromium, Browser, Page } from 'playwright';
import path from 'path';

// Interfaces
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
    validation?: 'string' | 'integer' | 'numeric' | 'regex';
    wait?: number;
  }>;
  wait: number;
  input?: string;
}

interface TestResult {
  testName: string;
  status: 'passed' | 'failed';
  steps: StepResult[];
}

interface StepResult {
  name: string;
  status: 'passed' | 'failed';
  error?: string;
}

// Validation Functions
const isInteger = (value: string): boolean => {
  const parsed = parseInt(value, 10);
  return !isNaN(parsed) && Number.isInteger(parsed);
};

const isNumeric = (value: string): boolean => {
  return !isNaN(parseFloat(value)) && isFinite(parseFloat(value));
};

const validateContent = (
  content: string,
  validation: 'string' | 'integer' | 'numeric' | 'regex',
  pattern?: string | RegExp | ((content: string) => boolean)
): boolean => {
  switch (validation) {
    case 'string':
      return typeof content === 'string';
    case 'integer':
      return isInteger(content);
    case 'numeric':
      return isNumeric(content);
    case 'regex':
      if (pattern instanceof RegExp) {
        return pattern.test(content);
      } else if (typeof pattern === 'string') {
        const regex = new RegExp(pattern);
          return regex.test(content);
        } else if (typeof pattern === 'function') {
          return pattern(content);
      }
      return false;
    default:
      return false;
  }
};

// Load JSON test files dynamically
const loadJsonArray = (filePath: string): TestObject => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data) as TestObject;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    throw error;
  }
};

// Function to run a single test
const executeTest = async (testObject: TestObject): Promise<TestResult> => {
  let overallStatus: 'passed' | 'failed' = 'passed';
  const stepResults: StepResult[] = [];
  
  console.log(`Starting test: ${testObject.testName}`);

  const browser: Browser = await chromium.launch({ headless: true });  // Always run headless
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
      } catch (e: any) {
        console.error(`Failed to load selector: ${selector}`, e);
        overallStatus = 'failed';
        stepResults.push({ name: `Load ${selector}`, status: 'failed', error: e.message });
      }
    }

    // Handle steps
    for (const step of testObject.steps) {
      const stepStatus = await handleStep(page, step, stepResults);
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

  return { testName: testObject.testName, status: overallStatus, steps: stepResults };
};

// Handle individual step
const handleStep = async (page: Page, step: Step, stepResults: StepResult[]): Promise<'passed' | 'failed'> => {
  try {
    console.log(`Step: ${step.name} - Action: ${step.action}`);

    if (step.action === 'click' && step.object) {
      console.log(`Clicking on object: ${step.object}`);
      await page.click(step.object);
      for (const { selector, expectedContent, validation, wait } of step.PageLoadObjects) {
        try {
          if (typeof selector !== 'string') {
            throw new Error(`Expected a string selector, but got: ${typeof selector}`);
          }
          console.log(`Waiting for selector: ${selector}`);
          await page.waitForSelector(selector, { timeout: wait || step.wait, state: 'visible' });
          const element = page.locator(selector);
          const stepContent = await element.textContent();
          if (stepContent === null) {
            throw new Error(`Element ${selector} not found or has no text content.`);
          }
          if (validation && !validateContent(stepContent, validation, expectedContent)) {
            throw new Error(`Content in element ${selector} does not match expected validation.`);
          }
        } catch (e: any) {
          console.error(`Failed to validate selector: ${selector}`, e);
          stepResults.push({ name: step.name, status: 'failed', error: e.message });
          return 'failed';
        }
      }
    }

    if (step.action === 'fetch' && step.url) {
      console.log(`Navigating to URL: ${step.url}`);
      await page.goto(step.url, { waitUntil: 'networkidle' });
      for (const { selector, expectedContent, validation, wait } of step.PageLoadObjects) {
        try {
          if (typeof selector !== 'string') {
            throw new Error(`Expected a string selector, but got: ${typeof selector}`);
          }
          console.log(`Waiting for selector: ${selector}`);
          await page.waitForSelector(selector, { timeout: wait || step.wait, state: 'visible' });
          const element = page.locator(selector);
          const stepContent = await element.textContent();
          if (stepContent === null) {
            throw new Error(`Element ${selector} not found or has no text content.`);
          }
          if (validation && !validateContent(stepContent, validation, expectedContent)) {
            throw new Error(`Content in element ${selector} does not match expected validation.`);
          }
        } catch (e: any) {
          console.error(`Failed to validate selector: ${selector}`, e);
          stepResults.push({ name: step.name, status: 'failed', error: e.message });
          return 'failed';
        }
      }
    }

    return 'passed';
  } catch (e: any) {
    console.error(`Error in step ${step.name}:`, e);
    stepResults.push({ name: step.name, status: 'failed', error: e.message });
    return 'failed';
  }
};

// Iterate through all test files in the tests folder
const runTests = async () => {
  const testFiles = fs.readdirSync(path.join(__dirname, 'tests')).filter(file => file.endsWith('.json'));
  const testResults: TestResult[] = [];

  for (const file of testFiles) {
    const filePath = path.join(__dirname, 'tests', file);
    const testObject = loadJsonArray(filePath);
    console.log(`Running test from ${filePath}:`);
    const result = await executeTest(testObject);
    testResults.push(result);

    const resultFileName = `${file.replace('.json', '')}-results.json`;
    fs.writeFileSync(resultFileName, JSON.stringify(result, null, 2), 'utf8');
    console.log(`Test results saved to ${resultFileName}`);
  }
};

runTests();