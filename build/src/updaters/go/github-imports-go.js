"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GithubImportsGo = void 0;
const default_1 = require("../default");
class GithubImportsGo extends default_1.DefaultUpdater {
    constructor(options) {
        super(options);
        this.repository = options.repository;
    }
    updateContent(content) {
        if (this.version.major < 2) {
            return content;
        }
        return content.replace(new RegExp(`"(https://pkg.go.dev/)?github.com/${this.repository.owner}/${this.repository.repo}(/v([1-9]\\d*))?([^"\\r\\n]+)?"`, 'g'), (_, prefix, __, ___, path) => `"${prefix !== null && prefix !== void 0 ? prefix : ''}github.com/${this.repository.owner}/${this.repository.repo}${this.version.major < 2 ? '' : '/v' + this.version.major.toString()}${path !== null && path !== void 0 ? path : ''}"`);
    }
}
exports.GithubImportsGo = GithubImportsGo;
//# sourceMappingURL=github-imports-go.js.map