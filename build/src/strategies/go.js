"use strict";
// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Go = void 0;
// Generic
const changelog_1 = require("../updaters/changelog");
const base_1 = require("./base");
const github_imports_go_1 = require("../updaters/go/github-imports-go");
const go_mod_1 = require("../updaters/go/go-mod");
class Go extends base_1.BaseStrategy {
    async buildUpdates(options) {
        var _a;
        const updates = [];
        const version = options.newVersion;
        updates.push({
            path: this.addPath(this.changelogPath),
            createIfMissing: true,
            updater: new changelog_1.Changelog({
                version,
                changelogEntry: options.changelogEntry,
            }),
        });
        if (version.major >= 2 && ((_a = options.latestVersion) === null || _a === void 0 ? void 0 : _a.major) !== version.major) {
            updates.push({
                path: this.addPath('go.mod'),
                createIfMissing: false,
                updater: new go_mod_1.GoModUpdater({
                    version,
                }),
            });
            const goFiles = await this.github.findFilesByGlobAndRef('**/*.go', this.changesBranch);
            // handle code snippets in markdown files as well
            const mdFiles = await this.github.findFilesByGlobAndRef('**/*.md', this.changesBranch);
            for (const file of [...goFiles, ...mdFiles]) {
                updates.push({
                    path: this.addPath(file),
                    createIfMissing: true,
                    updater: new github_imports_go_1.GithubImportsGo({
                        version,
                        repository: this.repository,
                    }),
                });
            }
        }
        return updates;
    }
}
exports.Go = Go;
//# sourceMappingURL=go.js.map