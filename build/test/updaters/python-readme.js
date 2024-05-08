"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const mocha_1 = require("mocha");
const chai_1 = require("chai");
const version_1 = require("../../src/version");
const python_readme_1 = require("../../src/updaters/python/python-readme");
const fixturesPath = './test/updaters/fixtures';
(0, mocha_1.describe)('PythonReadme', () => {
    const withPreFlag = (0, fs_1.readFileSync)((0, path_1.resolve)(fixturesPath, 'README-python-pre.md'), 'utf8');
    const withoutPreFlag = (0, fs_1.readFileSync)((0, path_1.resolve)(fixturesPath, 'README-python-no-pre.md'), 'utf8');
    (0, mocha_1.it)('makes no changes if there is a --pre on the install instructions in a README for a prerelease version', async () => {
        const readmeUpdater = new python_readme_1.PythonReadme({
            version: version_1.Version.parse('0.6.0-alpha.1'),
        });
        (0, chai_1.expect)(readmeUpdater.updateContent(withPreFlag)).to.equal(withPreFlag);
    });
    (0, mocha_1.it)('makes no changes if there is no --pre on the install instructions in a README for a non-prerelease version', async () => {
        const readmeUpdater = new python_readme_1.PythonReadme({
            version: version_1.Version.parse('0.6.0'),
        });
        (0, chai_1.expect)(readmeUpdater.updateContent(withoutPreFlag)).to.equal(withoutPreFlag);
    });
    (0, mocha_1.it)('adds --pre if there is no --pre on the install instructions in a README for a prerelease version', async () => {
        const readmeUpdater = new python_readme_1.PythonReadme({
            version: version_1.Version.parse('0.6.0-alpha.1'),
        });
        (0, chai_1.expect)(readmeUpdater.updateContent(withoutPreFlag)).to.equal(withPreFlag);
    });
    (0, mocha_1.it)('removes --pre if there is a --pre on the install instructions in a README for a non-prerelease version', async () => {
        const readmeUpdater = new python_readme_1.PythonReadme({
            version: version_1.Version.parse('0.6.0'),
        });
        (0, chai_1.expect)(readmeUpdater.updateContent(withPreFlag)).to.equal(withoutPreFlag);
    });
});
//# sourceMappingURL=python-readme.js.map