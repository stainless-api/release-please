"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const mocha_1 = require("mocha");
const chai_1 = require("chai");
const version_1 = require("../../src/version");
const github_imports_go_1 = require("../../src/updaters/go/github-imports-go");
const fixturesPath = './test/updaters/fixtures/go';
(0, mocha_1.describe)('GithubImportsGo', () => {
    (0, mocha_1.describe)('.go files', () => {
        const v1File = (0, fs_1.readFileSync)((0, path_1.resolve)(fixturesPath, 'file-with-imports-v1.go'), 'utf8');
        const v2File = (0, fs_1.readFileSync)((0, path_1.resolve)(fixturesPath, 'file-with-imports-v2.go'), 'utf8');
        const v3File = (0, fs_1.readFileSync)((0, path_1.resolve)(fixturesPath, 'file-with-imports-v3.go'), 'utf8');
        (0, mocha_1.it)('makes no changes if the old version has a major version of 1 and the new version also has a major version of 1', async () => {
            const importsUpdater = new github_imports_go_1.GithubImportsGo({
                repository: {
                    owner: 'cloudflare',
                    repo: 'cloudflare-go',
                },
                version: version_1.Version.parse('1.0.0'),
            });
            (0, chai_1.expect)(importsUpdater.updateContent(v1File)).to.equal(v1File);
        });
        (0, mocha_1.it)('updates the version in the imports if the old version has a major version of 1 and the new version has a major version of 2', async () => {
            const importsUpdater = new github_imports_go_1.GithubImportsGo({
                repository: {
                    owner: 'cloudflare',
                    repo: 'cloudflare-go',
                },
                version: version_1.Version.parse('2.0.0'),
            });
            (0, chai_1.expect)(importsUpdater.updateContent(v1File)).to.equal(v2File);
        });
        (0, mocha_1.it)('makes no changes if the old version has a major version of 2 and the new version also has a major version of 2', async () => {
            const importsUpdater = new github_imports_go_1.GithubImportsGo({
                repository: {
                    owner: 'cloudflare',
                    repo: 'cloudflare-go',
                },
                version: version_1.Version.parse('2.0.0'),
            });
            (0, chai_1.expect)(importsUpdater.updateContent(v2File)).to.equal(v2File);
        });
        (0, mocha_1.it)('updates the version in the imports if the old version has a major version of 2 and the new version has a major version of 3', async () => {
            const importsUpdater = new github_imports_go_1.GithubImportsGo({
                repository: {
                    owner: 'cloudflare',
                    repo: 'cloudflare-go',
                },
                version: version_1.Version.parse('3.0.0'),
            });
            (0, chai_1.expect)(importsUpdater.updateContent(v2File)).to.equal(v3File);
        });
    });
    (0, mocha_1.describe)('.md files', () => {
        const v1MdFile = (0, fs_1.readFileSync)((0, path_1.resolve)(fixturesPath, 'file-with-go-snippet-v1.md'), 'utf8');
        const v2MdFile = (0, fs_1.readFileSync)((0, path_1.resolve)(fixturesPath, 'file-with-go-snippet-v2.md'), 'utf8');
        const v3MdFile = (0, fs_1.readFileSync)((0, path_1.resolve)(fixturesPath, 'file-with-go-snippet-v3.md'), 'utf8');
        (0, mocha_1.it)('makes no changes if the old version has a major version of 1 and the new version also has a major version of 1', async () => {
            const importsUpdater = new github_imports_go_1.GithubImportsGo({
                repository: {
                    owner: 'cloudflare',
                    repo: 'cloudflare-go',
                },
                version: version_1.Version.parse('1.0.0'),
            });
            (0, chai_1.expect)(importsUpdater.updateContent(v1MdFile)).to.equal(v1MdFile);
        });
        (0, mocha_1.it)('updates the version in the imports if the old version has a major version of 1 and the new version has a major version of 2', async () => {
            const importsUpdater = new github_imports_go_1.GithubImportsGo({
                repository: {
                    owner: 'cloudflare',
                    repo: 'cloudflare-go',
                },
                version: version_1.Version.parse('2.0.0'),
            });
            (0, chai_1.expect)(importsUpdater.updateContent(v1MdFile)).to.equal(v2MdFile);
        });
        (0, mocha_1.it)('makes no changes if the old version has a major version of 2 and the new version also has a major version of 2', async () => {
            const importsUpdater = new github_imports_go_1.GithubImportsGo({
                repository: {
                    owner: 'cloudflare',
                    repo: 'cloudflare-go',
                },
                version: version_1.Version.parse('2.0.0'),
            });
            (0, chai_1.expect)(importsUpdater.updateContent(v2MdFile)).to.equal(v2MdFile);
        });
        (0, mocha_1.it)('updates the version in the imports if the old version has a major version of 2 and the new version has a major version of 3', async () => {
            const importsUpdater = new github_imports_go_1.GithubImportsGo({
                repository: {
                    owner: 'cloudflare',
                    repo: 'cloudflare-go',
                },
                version: version_1.Version.parse('3.0.0'),
            });
            (0, chai_1.expect)(importsUpdater.updateContent(v2MdFile)).to.equal(v3MdFile);
        });
    });
});
//# sourceMappingURL=go-imports.js.map