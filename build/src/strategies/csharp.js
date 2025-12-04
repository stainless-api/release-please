"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSharp = void 0;
const base_1 = require("./base");
const changelog_1 = require("../updaters/changelog");
const csproj_1 = require("../updaters/dotnet/csproj");
const errors_1 = require("../errors");
class CSharp extends base_1.BaseStrategy {
    async buildUpdates(options) {
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
        const csprojName = await this.getCsprojName();
        updates.push({
            path: this.addPath(csprojName),
            createIfMissing: false,
            cachedFileContents: this.csprojContents,
            updater: new csproj_1.CsProj({
                version,
            }),
        });
        return updates;
    }
    async getDefaultPackageName() {
        const csprojContents = await this.getCsprojContents();
        const pkg = this.parseCsprojPackageName(csprojContents.parsedContent);
        return pkg;
    }
    normalizeComponent(component) {
        if (!component) {
            return '';
        }
        // Handle namespace-style components (e.g., "Acme.Utilities" -> "Utilities")
        return component.includes('.') ? component.split('.').pop() : component;
    }
    async getCsprojName() {
        // First, try to find .csproj files in the path
        const files = await this.github.findFilesByGlobAndRef('**/*.csproj', this.changesBranch, this.path === '.' ? undefined : this.path);
        if (files.length > 0) {
            // Return just the filename, not the full path
            const fullPath = files[0];
            return fullPath.split('/').pop();
        }
        throw new errors_1.MissingRequiredFileError(this.addPath('*.csproj'), 'csharp', `${this.repository.owner}/${this.repository.repo}#${this.changesBranch}`);
    }
    async getCsprojContents() {
        if (!this.csprojContents) {
            const csprojName = await this.getCsprojName();
            const csprojPath = this.addPath(csprojName);
            const errMissingFile = new errors_1.MissingRequiredFileError(csprojPath, 'csharp', `${this.repository.owner}/${this.repository.repo}#${this.changesBranch}`);
            try {
                this.csprojContents = await this.github.getFileContentsOnBranch(csprojPath, this.changesBranch);
            }
            catch (e) {
                if (e instanceof errors_1.FileNotFoundError) {
                    throw errMissingFile;
                }
                throw e;
            }
            if (!this.csprojContents) {
                throw errMissingFile;
            }
        }
        return this.csprojContents;
    }
    parseCsprojPackageName(content) {
        // Try PackageId first (preferred for NuGet packages)
        const packageIdMatch = content.match(/<PackageId>([^<]+)<\/PackageId>/);
        if (packageIdMatch) {
            return packageIdMatch[1];
        }
        // Fall back to AssemblyName
        const assemblyNameMatch = content.match(/<AssemblyName>([^<]+)<\/AssemblyName>/);
        if (assemblyNameMatch) {
            return assemblyNameMatch[1];
        }
        // If neither is specified, try to get from the project file name
        // (The csproj name without extension is typically the package name)
        return undefined;
    }
}
exports.CSharp = CSharp;
//# sourceMappingURL=csharp.js.map