"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const playwright_1 = require("playwright");
const path_1 = __importDefault(require("path"));
// Validation Functions
const isInteger = (value) => {
    const parsed = parseInt(value, 10);
    return !isNaN(parsed) && Number.isInteger(parsed);
};
const isNumeric = (value) => {
    return !isNaN(parseFloat(value)) && isFinite(parseFloat(value));
};
const validateContent = (content, validation, pattern) => {
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
            }
            else if (typeof pattern === 'string') {
                const regex = new RegExp(pattern);
                return regex.test(content);
            }
            else if (typeof pattern === 'function') {
                return pattern(content);
            }
            return false;
        default:
            return false;
    }
};
// Handle selector with optional index
const handleSelector = async (page, selectorObj) => {
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
const loadJsonArray = (filePath) => {
    try {
        const data = fs_1.default.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    }
    catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        throw error;
    }
};
// Function to run a single test
const executeTest = async (testObject) => {
    let overallStatus = 'passed';
    const stepResults = [];
    console.log(`Starting test: ${testObject.testName}`);
    const browser = await playwright_1.chromium.launch({ headless: true }); // Always run headless
    const page = await browser.newPage();
    try {
        console.log(`Navigating to start URL: ${testObject.startUrl}`);
        await page.goto(testObject.startUrl, { waitUntil: 'networkidle' });
        // Handle start page load objects
        for (const selectorObj of testObject.startPageLoadObjects) {
            try {
                console.log(`Waiting for start page selector: ${selectorObj.selector}`);
                await handleSelector(page, selectorObj);
                console.log(`Selector ${selectorObj.selector} found successfully`);
            }
            catch (e) {
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
        fs_1.default.writeFileSync(resultFileName, JSON.stringify({ testName: testObject.testName, status: overallStatus, steps: stepResults }, null, 2), 'utf8');
        console.log(`Test results saved to ${resultFileName}`);
    }
    catch (error) {
        console.error(`Test ${testObject.testName} encountered a critical error:`, error);
        overallStatus = 'failed';
    }
    finally {
        await browser.close();
    }
    return { testName: testObject.testName, status: overallStatus, steps: stepResults };
};
// Handle individual step
const handleStep = async (page, step, stepResults) => {
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
                }
                catch (e) {
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
                }
                catch (e) {
                    console.error(`Failed to validate selector: ${selectorObj.selector}`, e);
                    stepResults.push({ name: step.name, status: 'failed', error: e.message });
                    return 'failed';
                }
            }
        }
        return 'passed';
    }
    catch (e) {
        console.error(`Error in step ${step.name}:`, e);
        stepResults.push({ name: step.name, status: 'failed', error: e.message });
        return 'failed';
    }
};
// Iterate through all test files in the tests folder
const runTests = async () => {
    const testFiles = fs_1.default.readdirSync(path_1.default.join(__dirname, 'tests')).filter(file => file.endsWith('.json'));
    const testResults = [];
    for (const file of testFiles) {
        const filePath = path_1.default.join(__dirname, 'tests', file);
        const testObject = loadJsonArray(filePath);
        console.log(`Running test from ${filePath}:`);
        const result = await executeTest(testObject);
        testResults.push(result);
    }
};
runTests();
