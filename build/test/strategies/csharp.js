"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mocha_1 = require("mocha");
const csharp_1 = require("../../src/strategies/csharp");
const helpers_1 = require("../helpers");
const nock = require("nock");
const sinon = require("sinon");
const github_1 = require("../../src/github");
const version_1 = require("../../src/version");
const tag_name_1 = require("../../src/util/tag-name");
const chai_1 = require("chai");
const changelog_1 = require("../../src/updaters/changelog");
const csproj_1 = require("../../src/updaters/dotnet/csproj");
const assert = require("assert");
const errors_1 = require("../../src/errors");
nock.disableNetConnect();
const sandbox = sinon.createSandbox();
const fixturesPath = './test/fixtures/strategies/csharp';
(0, mocha_1.describe)('CSharp', () => {
    let github;
    const commits = [
        ...(0, helpers_1.buildMockConventionalCommit)('fix(deps): update dependency Newtonsoft.Json to v13.0.1'),
    ];
    (0, mocha_1.beforeEach)(async () => {
        github = await github_1.GitHub.create({
            owner: 'googleapis',
            repo: 'csharp-test-repo',
            defaultBranch: 'main',
        });
    });
    (0, mocha_1.afterEach)(() => {
        sandbox.restore();
    });
    (0, mocha_1.describe)('buildReleasePullRequest', () => {
        (0, mocha_1.it)('returns release PR changes with defaultInitialVersion', async () => {
            var _a;
            const expectedVersion = '0.0.1';
            const strategy = new csharp_1.CSharp({
                targetBranch: 'main',
                github,
                component: 'Acme.TestProject',
                packageName: 'Acme.TestProject',
            });
            sandbox
                .stub(github, 'findFilesByGlobAndRef')
                .resolves(['TestProject.csproj']);
            const latestRelease = undefined;
            const release = await strategy.buildReleasePullRequest({
                commits,
                latestRelease,
            });
            (0, chai_1.expect)((_a = release.version) === null || _a === void 0 ? void 0 : _a.toString()).to.eql(expectedVersion);
        });
        (0, mocha_1.it)('builds a release pull request', async () => {
            var _a;
            const expectedVersion = '0.123.5';
            const strategy = new csharp_1.CSharp({
                targetBranch: 'main',
                github,
                component: 'Acme.TestProject',
                packageName: 'Acme.TestProject',
            });
            sandbox
                .stub(github, 'findFilesByGlobAndRef')
                .resolves(['TestProject.csproj']);
            const latestRelease = {
                tag: new tag_name_1.TagName(version_1.Version.parse('0.123.4'), 'Acme.TestProject'),
                sha: 'abc123',
                notes: 'some notes',
            };
            const pullRequest = await strategy.buildReleasePullRequest({
                commits,
                latestRelease,
            });
            (0, chai_1.expect)((_a = pullRequest.version) === null || _a === void 0 ? void 0 : _a.toString()).to.eql(expectedVersion);
        });
        (0, mocha_1.it)('detects a default component', async () => {
            var _a;
            const expectedVersion = '0.123.5';
            const strategy = new csharp_1.CSharp({
                targetBranch: 'main',
                github,
            });
            const commits = [
                ...(0, helpers_1.buildMockConventionalCommit)('fix(deps): update dependency Newtonsoft.Json to v13.0.1'),
            ];
            const latestRelease = {
                tag: new tag_name_1.TagName(version_1.Version.parse('0.123.4'), 'TestProject'),
                sha: 'abc123',
                notes: 'some notes',
            };
            sandbox
                .stub(github, 'findFilesByGlobAndRef')
                .resolves(['TestProject.csproj']);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('TestProject.csproj', 'main')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'TestProject.csproj'));
            const pullRequest = await strategy.buildReleasePullRequest({
                commits,
                latestRelease,
            });
            (0, chai_1.expect)((_a = pullRequest.version) === null || _a === void 0 ? void 0 : _a.toString()).to.eql(expectedVersion);
        });
        (0, mocha_1.it)('detects a default packageName', async () => {
            var _a;
            const expectedVersion = '0.123.5';
            const strategy = new csharp_1.CSharp({
                targetBranch: 'main',
                github,
                component: 'TestProject',
            });
            const commits = [
                ...(0, helpers_1.buildMockConventionalCommit)('fix(deps): update dependency Newtonsoft.Json to v13.0.1'),
            ];
            const latestRelease = {
                tag: new tag_name_1.TagName(version_1.Version.parse('0.123.4'), 'TestProject'),
                sha: 'abc123',
                notes: 'some notes',
            };
            sandbox
                .stub(github, 'findFilesByGlobAndRef')
                .resolves(['TestProject.csproj']);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('TestProject.csproj', 'main')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'TestProject.csproj'));
            const pullRequest = await strategy.buildReleasePullRequest({
                commits,
                latestRelease,
            });
            (0, chai_1.expect)((_a = pullRequest.version) === null || _a === void 0 ? void 0 : _a.toString()).to.eql(expectedVersion);
        });
        (0, mocha_1.it)('handles missing csproj file', async () => {
            sandbox.stub(github, 'findFilesByGlobAndRef').resolves([]);
            const strategy = new csharp_1.CSharp({
                targetBranch: 'main',
                github,
            });
            const latestRelease = {
                tag: new tag_name_1.TagName(version_1.Version.parse('0.123.4'), 'TestProject'),
                sha: 'abc123',
                notes: 'some notes',
            };
            assert.rejects(async () => {
                await strategy.buildReleasePullRequest({ commits, latestRelease });
            }, errors_1.MissingRequiredFileError);
        });
    });
    (0, mocha_1.describe)('buildUpdates', () => {
        (0, mocha_1.it)('builds common files', async () => {
            const strategy = new csharp_1.CSharp({
                targetBranch: 'main',
                github,
                component: 'Acme.TestProject',
                packageName: 'Acme.TestProject',
            });
            sandbox
                .stub(github, 'findFilesByGlobAndRef')
                .resolves(['TestProject.csproj']);
            const latestRelease = undefined;
            const release = await strategy.buildReleasePullRequest({
                commits,
                latestRelease,
            });
            const updates = release.updates;
            (0, helpers_1.assertHasUpdate)(updates, 'CHANGELOG.md', changelog_1.Changelog);
            (0, helpers_1.assertHasUpdate)(updates, 'TestProject.csproj', csproj_1.CsProj);
        });
    });
    (0, mocha_1.describe)('getDefaultPackageName', () => {
        (0, mocha_1.it)('reads package name from PackageId', async () => {
            const strategy = new csharp_1.CSharp({
                targetBranch: 'main',
                github,
            });
            sandbox
                .stub(github, 'findFilesByGlobAndRef')
                .resolves(['TestProject.csproj']);
            sandbox
                .stub(github, 'getFileContentsOnBranch')
                .withArgs('TestProject.csproj', 'main')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'TestProject.csproj'));
            const packageName = await strategy.getDefaultPackageName();
            (0, chai_1.expect)(packageName).to.eql('Acme.TestProject');
        });
    });
    (0, mocha_1.describe)('normalizeComponent', () => {
        (0, mocha_1.it)('strips namespace prefix when deriving component from packageName', async () => {
            const strategy = new csharp_1.CSharp({
                targetBranch: 'main',
                github,
                packageName: 'Acme.Utilities.Core',
            });
            sandbox
                .stub(github, 'findFilesByGlobAndRef')
                .resolves(['TestProject.csproj']);
            const component = await strategy.getBranchComponent();
            (0, chai_1.expect)(component).to.eql('Core');
        });
        (0, mocha_1.it)('handles packageName without namespace', async () => {
            const strategy = new csharp_1.CSharp({
                targetBranch: 'main',
                github,
                packageName: 'TestProject',
            });
            sandbox
                .stub(github, 'findFilesByGlobAndRef')
                .resolves(['TestProject.csproj']);
            const component = await strategy.getBranchComponent();
            (0, chai_1.expect)(component).to.eql('TestProject');
        });
    });
});
//# sourceMappingURL=csharp.js.map