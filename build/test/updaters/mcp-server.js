"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const snapshot = require("snap-shot-it");
const mocha_1 = require("mocha");
const version_1 = require("../../src/version");
const mcp_server_1 = require("../../src/updaters/node/mcp-server");
const fixturesPath = './test/updaters/fixtures';
(0, mocha_1.describe)('McpServer', () => {
    (0, mocha_1.describe)('updateContent', () => {
        (0, mocha_1.it)('updates the version', async () => {
            const oldContent = (0, fs_1.readFileSync)(
            // it's a .txt file rather than .ts so that the linter doesn't complain
            (0, path_1.resolve)(fixturesPath, './mcp_server.txt'), 'utf8');
            const packageJson = new mcp_server_1.McpServer({
                version: version_1.Version.parse('2.36.1'),
            });
            const newContent = packageJson.updateContent(oldContent);
            snapshot(newContent.replace(/\r\n/g, '\n'));
        });
    });
});
//# sourceMappingURL=mcp-server.js.map