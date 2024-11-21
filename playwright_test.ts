import fs from 'fs';
import { chromium, Browser, Page } from 'playwright';
import path from 'path';

// Interfaces
interface TestObject {
  id: number;
  testName: string;
  functionalUnit: string;
  startUrl: string;
  startPageLoadObjects: SelectorObject[];
  wait: number;
  steps: Step[];
}

interface Step {
  name: string;
  action: 'click' | 'fetch' | 'input';
  object?: SelectorObject;
  url?: string;
  PageLoadObjects: SelectorObject[];
  wait: number;
  input?: string;
}

interface StepResult {
  name: string;
  status: 'passed' | 'failed';
  content?: string; // Save the content of the element in the result
  error?: string;
}

interface TestResult {
  testName: string;
  status: 'passed' | 'failed';
  steps: StepResult[];
}

interface SelectorObject {
  selector: string;
  index?: number; // Optional index for selecting a specific element
  expectedContent?: string | RegExp | ((content: string) => boolean);
  validation?: 'string' | 'integer' | 'numeric' | 'regex';
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

// Handle selector with optional index
const handleSelector = async (page: Page, selectorObj: SelectorObject) => {
  const { selector, index = 0 } = selectorObj;

  // Locate the element by the selector
  const elements = page.locator(selector);
  const count = await elements.count();

  if (count === 0) {
    throw new Error(`No elements found for selector: ${selector}`);
  }

  if (index >= count) {
    throw new Error(`Index ${index} is out of bounds. Only ${count} elements found for selector: ${selector}`);
  }

  const element = elements.nth(index);

  // Wait for the element to be visible
  console.log(`Waiting for element: ${selector} (index ${index})`);
  await element.waitFor({ state: 'visible' });
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

  const browser: Browser = await chromium.launch({ headless: true }); // Always run headless
  const page: Page = await browser.newPage();

  try {
    console.log(`Navigating to start URL: ${testObject.startUrl}`);
    await page.goto(testObject.startUrl, { waitUntil: 'networkidle' });

    // Handle start page load objects
    for (const selectorObj of testObject.startPageLoadObjects) {
      try {
        console.log(`Waiting for start page selector: ${selectorObj.selector}`);
        await handleSelector(page, selectorObj);
        console.log(`Selector ${selectorObj.selector} found successfully`);
      } catch (e: any) {
        console.error(`Failed to load selector: ${selectorObj.selector}`, e);
        overallStatus = 'failed';
        stepResults.push({ name: `Load ${selectorObj.selector}`, status: 'failed', error: e.message });
      }
    }

    // Handle steps
    for (const step of testObject.steps) {
      const stepStatus = await handleStep(page, step, stepResults);
      if (stepStatus === 'failed') {
        overallStatus = 'failed';
      }
    }

    // Save the results for this test in a dedicated results file (testName-results.json)
    const resultFileName = `${testObject.testName.replace(/\s+/g, '-').toLowerCase()}-results.json`;
    fs.writeFileSync(resultFileName, JSON.stringify({ testName: testObject.testName, status: overallStatus, steps: stepResults }, null, 2), 'utf8');
    console.log(`Test results saved to ${resultFileName}`);

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
      console.log(`Clicking on object: ${step.object.selector}`);
      await page.click(step.object.selector);
      // Wait for the page to load completely after clicking
      await page.waitForLoadState('load'); // Wait until the load state is 'load' after the click
      for (const selectorObj of step.PageLoadObjects) {
        try {
          console.log(`Waiting for selector: ${selectorObj.selector}`);
          await handleSelector(page, selectorObj);
          const element = page.locator(selectorObj.selector);
          const stepContent = await element.textContent();
          if (stepContent === null) {
            throw new Error(`Element ${selectorObj.selector} not found or has no text content.`);
          }
          if (selectorObj.validation && !validateContent(stepContent, selectorObj.validation, selectorObj.expectedContent)) {
            throw new Error(`Content in element ${selectorObj.selector} does not match expected validation.`);
          }
          // Save content in the result
          stepResults.push({ name: step.name, status: 'passed', content: stepContent });
        } catch (e: any) {
          console.error(`Failed to validate selector: ${selectorObj.selector}`, e);
          stepResults.push({ name: step.name, status: 'failed', error: e.message });
          return 'failed';
        }
      }
    }

    if (step.action === 'fetch' && step.url) {
      console.log(`Navigating to URL: ${step.url}`);
      await page.goto(step.url, { waitUntil: 'networkidle' });
      for (const selectorObj of step.PageLoadObjects) {
        try {
          console.log(`Waiting for selector: ${selectorObj.selector}`);
          await handleSelector(page, selectorObj);
          const element = page.locator(selectorObj.selector);
          const stepContent = await element.textContent();
          if (stepContent === null) {
            throw new Error(`Element ${selectorObj.selector} not found or has no text content.`);
          }
          if (selectorObj.validation && !validateContent(stepContent, selectorObj.validation, selectorObj.expectedContent)) {
            throw new Error(`Content in element ${selectorObj.selector} does not match expected validation.`);
          }
          // Save content in the result
          stepResults.push({ name: step.name, status: 'passed', content: stepContent });
        } catch (e: any) {
          console.error(`Failed to validate selector: ${selectorObj.selector}`, e);
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
  }
};

runTests();