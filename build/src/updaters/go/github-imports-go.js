"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GithubImportsGo = void 0;
const default_1 = require("../default");
class GithubImportsGo extends default_1.DefaultUpdater {
    updateContent(content) {
        if (this.version.major < 2) {
            return content;
        }
        return content.replace(/"(https:\/\/pkg.go.dev\/)?github\.com\/([^/"\n]+)\/([^/"\n]+)(\/v([1-9]\d*))?(\/[^"\n]+)?"/g, (_, prefix, user, repo, ___, ____, path) => `"${prefix !== null && prefix !== void 0 ? prefix : ''}github.com/${user}/${repo}${this.version.major < 2 ? '' : '/v' + this.version.major.toString()}${path !== null && path !== void 0 ? path : ''}"`);
    }
}
exports.GithubImportsGo = GithubImportsGo;
//# sourceMappingURL=github-imports-go.js.map