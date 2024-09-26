"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GithubImportsGo = void 0;
const default_1 = require("../default");
class GithubImportsGo extends default_1.DefaultUpdater {
    updateContent(content) {
        return content.replace(/"github\.com\/([^/]+)\/([^/]+)\/v([1-9]\d*)\/(.+)"/g, (_, user, repo, __, path) => `"github.com/${user}/${repo}/v${this.version.major.toString()}/${path}"`);
    }
}
exports.GithubImportsGo = GithubImportsGo;
//# sourceMappingURL=github-imports-go.js.map