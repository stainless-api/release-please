"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GoModUpdater = void 0;
const default_1 = require("../default");
class GoModUpdater extends default_1.DefaultUpdater {
    updateContent(content) {
        if (this.version.major < 2) {
            return content;
        }
        return content.replace(/module github\.com\/([^/"\r?\n]+)\/([^/"\r?\n]+)(\/v([1-9]\d*))?/g, (_, user, repo) => `module github.com/${user}/${repo}${this.version.major < 2 ? '' : '/v' + this.version.major.toString()}`);
    }
}
exports.GoModUpdater = GoModUpdater;
//# sourceMappingURL=go-mod.js.map