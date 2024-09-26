"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const mocha_1 = require("mocha");
const chai_1 = require("chai");
const version_1 = require("../../src/version");
const github_imports_go_1 = require("../../src/updaters/go/github-imports-go");
const fixturesPath = './test/updaters/fixtures';
(0, mocha_1.describe)('GithubImportsGo', () => {
    const v2File = (0, fs_1.readFileSync)((0, path_1.resolve)(fixturesPath, 'file-with-imports-v2.go'), 'utf8');
    const v3File = (0, fs_1.readFileSync)((0, path_1.resolve)(fixturesPath, 'file-with-imports-v3.go'), 'utf8');
    (0, mocha_1.it)('makes no changes if the new version has a major version of 2', async () => {
        const readmeUpdater = new github_imports_go_1.GithubImportsGo({
            version: version_1.Version.parse('2.0.0'),
        });
        (0, chai_1.expect)(readmeUpdater.updateContent(v2File)).to.equal(v2File);
    });
    (0, mocha_1.it)('updates the version in the imports if the new version has a major version of 3', async () => {
        const readmeUpdater = new github_imports_go_1.GithubImportsGo({
            version: version_1.Version.parse('3.0.0'),
        });
        (0, chai_1.expect)(readmeUpdater.updateContent(v2File)).to.equal(v3File);
    });
});
//# sourceMappingURL=go-imports.js.map