import argparse
import json
import os
import datetime as dt
import pandas as pd
from playwright.sync_api import sync_playwright

def load_json_array(file_path):
    with open(file_path, 'r') as file:
        data = json.load(file)
    return data

def execute_test(playwright, testObject):
    entry = {}

    stepStatus = []
    failedStep = None

    browser = playwright.chromium.launch(headless=False)
    page = browser.new_page()

    page.goto(testObject['startUrl'])

    startLoads = []
    for item in testObject['startPageLoadObjects']:
        try:
            page.wait_for_selector(item, timeout=testObject['wait'])
            startLoads.append(True)
            stepStatus.append(True)
        except:
            startLoads.append(False)
            stepStatus.append(False)
            failedStep = testObject['testName']

    if False not in startLoads:
        for step in testObject['steps']:
            stepLoads = []
            if step['action'] == 'click':
                page.click(step['object'])
                for item in step['PageLoadObjects']:
                    try:
                        page.wait_for_selector(item, timeout=step['wait'])
                        stepLoads.append(True)
                    except:
                        stepLoads.append(False)
                        failedStep = step['name']

                if False in stepLoads:
                    print(f"Step {step['name']} failed")
                    stepStatus.append(False)
                else:
                    print(f"Step {step['name']} passed")
                    stepStatus.append(True)
            
            if step['action'] == 'fetch':
                page.goto(step['url'])
                for item in step['PageLoadObjects']:
                    try:
                        page.wait_for_selector(item, timeout=step['wait'])
                        stepLoads.append(True)
                    except:
                        stepLoads.append(False)
                        failedStep = step['name']

                if False in stepLoads:
                    print(f"Step {step['name']} failed")
                    stepStatus.append(False)
                else:
                    print(f"Step {step['name']} passed")
                    stepStatus.append(True)

            if step['action'] == 'input':
                try:
                    page.fill(step['object'], step['input'])
                    stepLoads.append(True)
                except:
                    stepLoads.append(False)
                    failedStep = step['name']

                if False in stepLoads:
                    print(f"Step {step['name']} failed")
                    stepStatus.append(False)
                else:
                    print(f"Step {step['name']} passed")
                    stepStatus.append(True)

    else:
        print("Start page load failed")

    if False not in stepStatus:
        entry = {
            "testName": testObject['testName'],
            "testStatus": "Passed",
            "functionalUnit": testObject['functionalUnit'],
            "testTime": dt.datetime.now().isoformat(),
            "failedSteps": failedStep
        }
    else:
        entry = {
            "testName": testObject['testName'],
            "testStatus": "Failed",
            "functionalUnit": testObject['functionalUnit'],
            "testTime": dt.datetime.now().isoformat(),
            "failedSteps": failedStep
        }

    df = pd.DataFrame([entry])

    file_exists = os.path.isfile('results.csv')

    csv_file_path = 'results.csv'

    if file_exists:
        df.to_csv(csv_file_path, mode='a', header=False, index=False)
    else:
        df.to_csv(csv_file_path, mode='a', header=True, index=False)    

    return 

if __name__ == "__main__":
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description='Execute Playwright tests with JSON input.')
    parser.add_argument('json_file1', help='Path to the first JSON file')
    parser.add_argument('json_file2', help='Path to the second JSON file')

    args = parser.parse_args()

    with sync_playwright() as playwright:
        # Load JSON files passed as arguments
        testObject = load_json_array(args.json_file1)
        print(testObject)
        execute_test(playwright, testObject)