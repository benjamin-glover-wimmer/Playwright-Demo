from playwright.sync_api import sync_playwright
import json
from msal import ConfidentialClientApplication
import os
import datetime as dt
import pandas as pd

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

with sync_playwright() as playwright:
    testObject = load_json_array('tests/test1.json')
    print(testObject)
    execute_test(playwright, testObject)