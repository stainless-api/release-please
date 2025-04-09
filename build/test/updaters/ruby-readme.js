"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const mocha_1 = require("mocha");
const path_1 = require("path");
const readme_1 = require("../../src/updaters/ruby/readme");
const version_1 = require("../../src/version");
const snapshot = require("snap-shot-it");
const fixturesPath = './test/updaters/fixtures';
(0, mocha_1.describe)('Ruby README.md', () => {
    (0, mocha_1.describe)('updateContent', () => {
        const versions = ['2.1.0', '0.6.0-alpha.1', '0.6.0-beta.2'];
        for (const ver of versions) {
            (0, mocha_1.it)(`updates ruby version in README.md - ${ver}`, async () => {
                const oldContent = (0, fs_1.readFileSync)((0, path_1.resolve)(fixturesPath, './README-ruby-version.md'), 'utf8').replace(/\r\n/g, '\n');
                const version = new readme_1.RubyReadMeUpdater({
                    version: version_1.Version.parse(ver),
                });
                const newContent = version.updateContent(oldContent);
                snapshot(newContent);
            });
        }
    });
});
//# sourceMappingURL=ruby-readme.js.map