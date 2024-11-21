import fs from 'fs';
import { chromium, Browser, Page, Locator } from 'playwright';
import path from 'path';

const loadJsonArray = (filePath: string): TestObject => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data) as TestObject;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
    throw error;
  }
};

// Interfaces
interface SelectorObject {
  selector: string;
  index?: number;
}

interface PageLoadObject extends SelectorObject {
  expectedContent?: string;
  validation?: 'string' | 'integer' | 'numeric' | 'regex';
  validationPattern?: string | RegExp;
  wait?: number;
}

interface Step {
  name: string;
  action: 'click' | 'fetch' | 'input';
  object?: string | SelectorObject;
  url?: string;
  PageLoadObjects: PageLoadObject[];
  wait: number;
  input?: string;
}

interface TestObject {
  id: number;
  testName: string;
  functionalUnit: string;
  startUrl: string;
  startPageLoadObjects: (string | SelectorObject)[];
  wait: number;
  steps: Step[];
}

interface StepResult {
  name: string;
  status: 'passed' | 'failed';
  error?: string;
  validationErrors?: string[];
}

interface TestResult {
  testName: string;
  status: 'passed' | 'failed';
  steps: StepResult[];
}

// Helper function to get selector string from object or string
function getSelectorString(selectorObj: string | SelectorObject): string {
  if (typeof selectorObj === 'string') {
    return selectorObj;
  }
  return selectorObj.selector;
}

// Helper function to handle indexed element selection
async function getElementByIndex(page: Page, selectorObj: string | SelectorObject): Promise<Locator> {
  const selector = getSelectorString(selectorObj);
  const index = typeof selectorObj === 'object' ? selectorObj.index || 0 : 0;
  
  const elements = page.locator(selector);
  const count = await elements.count();
  
  if (count === 0) {
    throw new Error(`No elements found for selector: ${selector}`);
  }
  
  if (index >= count) {
    throw new Error(`Index ${index} is out of bounds. Only ${count} elements found for selector: ${selector}`);
  }
  
  return elements.nth(index);
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
      return typeof content === 'string' && content.length > 0;
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

// Function to validate page content
async function validatePageContent(
  element: Locator,
  obj: PageLoadObject
): Promise<{ isValid: boolean; error?: string }> {
  const content = await element.textContent() || '';
  
  if (obj.expectedContent && !content.includes(obj.expectedContent.toString())) {
    return {
      isValid: false,
      error: `Expected content "${obj.expectedContent}" not found in "${content}"`
    };
  }

  if (obj.validation) {
    const isValid = validateContent(content, obj.validation, obj.validationPattern);
    if (!isValid) {
      return {
        isValid: false,
        error: `Content validation failed for ${obj.selector}. Expected ${obj.validation} but got "${content}"`
      };
    }
  }

  return { isValid: true };
}

// Execute single test
const executeTest = async (testObject: TestObject): Promise<TestResult> => {
  let browser: Browser | null = null;
  let page: Page | null = null;
  const stepResults: StepResult[] = [];
  let overallStatus: 'passed' | 'failed' = 'passed';

  try {
    browser = await chromium.launch({ 
      headless: true,
      args: ['--disable-dev-shm-usage']
    });
    
    page = await browser.newPage();
    page.setDefaultTimeout(testObject.wait);
    
    console.log(`Starting test: ${testObject.testName}`);
    console.log(`Navigating to start URL: ${testObject.startUrl}`);
    
    await page.goto(testObject.startUrl, { 
      waitUntil: 'networkidle',
      timeout: testObject.wait 
    });

    // Handle start page load objects
    for (const selectorObj of testObject.startPageLoadObjects) {
      try {
        const selector = getSelectorString(selectorObj);
        console.log(`Waiting for start page selector: ${selector}`);
        const element = await getElementByIndex(page, selectorObj);
        await element.waitFor({ state: 'visible', timeout: testObject.wait });
        console.log(`Found selector: ${selector}`);
      } catch (e: any) {
        const selector = getSelectorString(selectorObj);
        const error = `Failed to find start page selector: ${selector} - ${e.message}`;
        console.error(error);
        if (page) await takeScreenshot(page, `error-${testObject.testName}-start`);
        overallStatus = 'failed';
        stepResults.push({ 
          name: `Initial Load - ${selector}`, 
          status: 'failed', 
          error 
        });
        return { testName: testObject.testName, status: overallStatus, steps: stepResults };
      }
    }

    // Execute each step
    for (const step of testObject.steps) {
      try {
        console.log(`Step: ${step.name} - Action: ${step.action}`);
        const validationErrors: string[] = [];
        
        if (step.action === 'click' && step.object) {
          const selector = getSelectorString(step.object);
          console.log(`Clicking on selector: ${selector}`);
          const element = await getElementByIndex(page, step.object);
          await element.waitFor({ state: 'visible', timeout: step.wait });
          await element.click();
        }
        
        if (step.action === 'fetch' && step.url) {
          console.log(`Navigating to URL: ${step.url}`);
          await page.goto(step.url, { 
            waitUntil: 'networkidle',
            timeout: step.wait 
          });
        }

        // Verify page load objects
        for (const obj of step.PageLoadObjects) {
          try {
            const selector = getSelectorString(obj);
            console.log(`Waiting for selector: ${selector}`);
            const element = await getElementByIndex(page, obj);
            await element.waitFor({ 
              state: 'visible',
              timeout: obj.wait || step.wait 
            });

            // Perform content validation
            const validation = await validatePageContent(element, obj);
            if (!validation.isValid && validation.error) {
              validationErrors.push(validation.error);
            }
          } catch (e: any) {
            throw new Error(`Failed to verify ${obj.selector}: ${e.message}`);
          }
        }

        if (validationErrors.length > 0) {
          throw new Error(`Validation errors occurred:\n${validationErrors.join('\n')}`);
        }

        stepResults.push({ 
          name: step.name, 
          status: 'passed'
        });
      } catch (e: any) {
        const error = `Step ${step.name} failed: ${e.message}`;
        console.error(error);
        if (page) await takeScreenshot(page, `error-${testObject.testName}-${step.name}`);
        stepResults.push({ 
          name: step.name, 
          status: 'failed', 
          error,
          validationErrors: e.message.includes('Validation errors occurred') ? e.message.split('\n').slice(1) : undefined
        });
        overallStatus = 'failed';
        break;
      }
    }
  } catch (e: any) {
    console.error(`Test ${testObject.testName} encountered a critical error:`, e);
    overallStatus = 'failed';
  } finally {
    if (page) await page.close();
    if (browser) await browser.close();
  }

  return { 
    testName: testObject.testName, 
    status: overallStatus, 
    steps: stepResults 
  };
};

// Function to take screenshots
async function takeScreenshot(page: Page, name: string) {
  const screenshotPath = path.join(process.cwd(), 'screenshots');
  if (!fs.existsSync(screenshotPath)) {
    fs.mkdirSync(screenshotPath);
  }
  await page.screenshot({ 
    path: path.join(screenshotPath, `${name}.png`),
    fullPage: true 
  });
}

// Run all tests
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
    
    if (result.status === 'failed') {
      console.log(`Test ${result.testName} Failed`);
      const failedStep = result.steps.find(step => step.status === 'failed');
      if (failedStep) {
        console.log(`Failed step: ${failedStep.name}`);
        if (failedStep.validationErrors) {
          console.log('Validation errors:', failedStep.validationErrors);
        }
      }
    }
  }
};

// Start test execution
runTests().catch(console.error);