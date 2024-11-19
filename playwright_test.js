"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var playwright_1 = require("playwright");
var fs_1 = require("fs");
var loadJsonArray = function (filePath) {
    var data = fs_1.default.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
};
var executeTest = function (testObject, headless) { return __awaiter(void 0, void 0, void 0, function () {
    var failedStep, stepStatus, browser, page, startLoads, _i, _a, step, stepLoads, _b, _c, item, pageContent, _d, _e, _f, item, pageContent, _g;
    return __generator(this, function (_h) {
        switch (_h.label) {
            case 0:
                failedStep = null;
                stepStatus = [];
                console.log("Starting test: ".concat(testObject.testName));
                return [4 /*yield*/, playwright_1.chromium.launch({ headless: headless })];
            case 1:
                browser = _h.sent();
                return [4 /*yield*/, browser.newPage()];
            case 2:
                page = _h.sent();
                console.log("Navigating to start URL: ".concat(testObject.startUrl));
                return [4 /*yield*/, page.goto(testObject.startUrl)];
            case 3:
                _h.sent();
                return [4 /*yield*/, Promise.all(testObject.startPageLoadObjects.map(function (item) { return __awaiter(void 0, void 0, void 0, function () {
                        var pageContent, e_1;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    _a.trys.push([0, 4, , 5]);
                                    console.log("Waiting for selector: ".concat(item.selector));
                                    return [4 /*yield*/, page.waitForSelector(item.selector, { timeout: testObject.wait })];
                                case 1:
                                    _a.sent();
                                    if (!item.expectedContent) return [3 /*break*/, 3];
                                    return [4 /*yield*/, page.innerHTML(item.selector)];
                                case 2:
                                    pageContent = _a.sent();
                                    if (!pageContent.includes(item.expectedContent)) {
                                        console.log("Expected content NOT found for ".concat(item.selector));
                                        stepStatus.push(false);
                                    }
                                    else {
                                        console.log("Expected content found for ".concat(item.selector));
                                        stepStatus.push(true);
                                    }
                                    _a.label = 3;
                                case 3: return [2 /*return*/, true];
                                case 4:
                                    e_1 = _a.sent();
                                    console.log("Failed to load selector: ".concat(item.selector));
                                    return [2 /*return*/, false];
                                case 5: return [2 /*return*/];
                            }
                        });
                    }); }))];
            case 4:
                startLoads = _h.sent();
                if (startLoads.includes(false)) {
                    console.log('Start page load failed');
                }
                _i = 0, _a = testObject.steps;
                _h.label = 5;
            case 5:
                if (!(_i < _a.length)) return [3 /*break*/, 27];
                step = _a[_i];
                stepLoads = [];
                console.log("Step: ".concat(step.name, " - Action: ").concat(step.action));
                if (!(step.action === 'click' && step.object)) return [3 /*break*/, 14];
                console.log("Clicking on object: ".concat(step.object));
                return [4 /*yield*/, page.click(step.object)];
            case 6:
                _h.sent();
                _b = 0, _c = step.PageLoadObjects;
                _h.label = 7;
            case 7:
                if (!(_b < _c.length)) return [3 /*break*/, 14];
                item = _c[_b];
                _h.label = 8;
            case 8:
                _h.trys.push([8, 12, , 13]);
                console.log("Waiting for selector: ".concat(item.selector));
                return [4 /*yield*/, page.waitForSelector(item.selector, { timeout: step.wait })];
            case 9:
                _h.sent();
                stepLoads.push(true);
                if (!item.expectedContent) return [3 /*break*/, 11];
                return [4 /*yield*/, page.innerHTML(item.selector)];
            case 10:
                pageContent = _h.sent();
                if (!pageContent.includes(item.expectedContent)) {
                    console.log("Expected content NOT found for ".concat(item.selector));
                    stepLoads.push(false);
                }
                else {
                    console.log("Expected content found for ".concat(item.selector));
                }
                _h.label = 11;
            case 11: return [3 /*break*/, 13];
            case 12:
                _d = _h.sent();
                console.log("Failed to find selector: ".concat(item.selector));
                stepLoads.push(false);
                failedStep = step.name;
                return [3 /*break*/, 13];
            case 13:
                _b++;
                return [3 /*break*/, 7];
            case 14:
                if (!(step.action === 'fetch' && step.url)) return [3 /*break*/, 23];
                console.log("Navigating to URL: ".concat(step.url));
                return [4 /*yield*/, page.goto(step.url)];
            case 15:
                _h.sent();
                _e = 0, _f = step.PageLoadObjects;
                _h.label = 16;
            case 16:
                if (!(_e < _f.length)) return [3 /*break*/, 23];
                item = _f[_e];
                _h.label = 17;
            case 17:
                _h.trys.push([17, 21, , 22]);
                console.log("Waiting for selector: ".concat(item.selector));
                return [4 /*yield*/, page.waitForSelector(item.selector, { timeout: step.wait })];
            case 18:
                _h.sent();
                stepLoads.push(true);
                if (!item.expectedContent) return [3 /*break*/, 20];
                return [4 /*yield*/, page.innerHTML(item.selector)];
            case 19:
                pageContent = _h.sent();
                if (!pageContent.includes(item.expectedContent)) {
                    console.log("Expected content NOT found for ".concat(item.selector));
                    stepLoads.push(false);
                }
                else {
                    console.log("Expected content found for ".concat(item.selector));
                }
                _h.label = 20;
            case 20: return [3 /*break*/, 22];
            case 21:
                _g = _h.sent();
                console.log("Failed to find selector: ".concat(item.selector));
                stepLoads.push(false);
                failedStep = step.name;
                return [3 /*break*/, 22];
            case 22:
                _e++;
                return [3 /*break*/, 16];
            case 23:
                if (!(step.action === 'input' && step.object && step.input)) return [3 /*break*/, 25];
                console.log("Filling input for object: ".concat(step.object, " with value: ").concat(step.input));
                return [4 /*yield*/, page.fill(step.object, step.input)];
            case 24:
                _h.sent();
                stepLoads.push(true);
                _h.label = 25;
            case 25:
                if (stepLoads.includes(false)) {
                    console.log("Step ".concat(step.name, " failed"));
                    stepStatus.push(false);
                }
                else {
                    console.log("Step ".concat(step.name, " passed"));
                    stepStatus.push(true);
                }
                _h.label = 26;
            case 26:
                _i++;
                return [3 /*break*/, 5];
            case 27:
                if (!stepStatus.includes(false)) {
                    console.log("Test ".concat(testObject.testName, " Passed"));
                }
                else {
                    console.log("Test ".concat(testObject.testName, " Failed"));
                }
                return [4 /*yield*/, browser.close()];
            case 28:
                _h.sent();
                return [2 /*return*/];
        }
    });
}); };
var runTests = function () { return __awaiter(void 0, void 0, void 0, function () {
    var args, headless, _i, _a, jsonFile, testObject;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                args = process.argv.slice(2);
                headless = args.includes('--headless');
                _i = 0, _a = args.filter(function (file) { return file !== '--headless'; });
                _b.label = 1;
            case 1:
                if (!(_i < _a.length)) return [3 /*break*/, 4];
                jsonFile = _a[_i];
                testObject = loadJsonArray(jsonFile);
                console.log("Running test from ".concat(jsonFile, ":"));
                return [4 /*yield*/, executeTest(testObject, headless)];
            case 2:
                _b.sent();
                _b.label = 3;
            case 3:
                _i++;
                return [3 /*break*/, 1];
            case 4: return [2 /*return*/];
        }
    });
}); };
runTests();
