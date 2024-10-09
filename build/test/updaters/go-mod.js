"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const mocha_1 = require("mocha");
const chai_1 = require("chai");
const version_1 = require("../../src/version");
const go_mod_1 = require("../../src/updaters/go/go-mod");
const fixturesPath = './test/updaters/fixtures/go';
(0, mocha_1.describe)('GoModUpdater', () => {
    (0, mocha_1.describe)('go.mod files', () => {
        const v1File = (0, fs_1.readFileSync)((0, path_1.resolve)(fixturesPath, 'go-v1.mod'), 'utf8');
        const v2File = (0, fs_1.readFileSync)((0, path_1.resolve)(fixturesPath, 'go-v2.mod'), 'utf8');
        const v3File = (0, fs_1.readFileSync)((0, path_1.resolve)(fixturesPath, 'go-v3.mod'), 'utf8');
        (0, mocha_1.it)('makes no changes if the old version has a major version of 1 and the new version also has a major version of 1', async () => {
            const importsUpdater = new go_mod_1.GoModUpdater({
                version: version_1.Version.parse('1.0.0'),
            });
            (0, chai_1.expect)(importsUpdater.updateContent(v1File)).to.equal(v1File);
        });
        (0, mocha_1.it)('updates the version in the imports if the old version has a major version of 1 and the new version has a major version of 2', async () => {
            const importsUpdater = new go_mod_1.GoModUpdater({
                version: version_1.Version.parse('2.0.0'),
            });
            (0, chai_1.expect)(importsUpdater.updateContent(v1File)).to.equal(v2File);
        });
        (0, mocha_1.it)('makes no changes if the old version has a major version of 2 and the new version also has a major version of 2', async () => {
            const importsUpdater = new go_mod_1.GoModUpdater({
                version: version_1.Version.parse('2.0.0'),
            });
            (0, chai_1.expect)(importsUpdater.updateContent(v2File)).to.equal(v2File);
        });
        (0, mocha_1.it)('updates the version in the imports if the old version has a major version of 2 and the new version has a major version of 3', async () => {
            const importsUpdater = new go_mod_1.GoModUpdater({
                version: version_1.Version.parse('3.0.0'),
            });
            (0, chai_1.expect)(importsUpdater.updateContent(v2File)).to.equal(v3File);
        });
    });
});
//# sourceMappingURL=go-mod.js.map