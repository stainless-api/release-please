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
const mocha_1 = require("mocha");
const manifest_1 = require("../src/manifest");
const github_1 = require("../src/github");
const sinon = require("sinon");
const helpers_1 = require("./helpers");
const chai_1 = require("chai");
const assert = require("assert");
const version_1 = require("../src/version");
const fs_1 = require("fs");
const path_1 = require("path");
const pluginFactory = require("../src/factories/plugin-factory");
const sentence_case_1 = require("../src/plugins/sentence-case");
const node_workspace_1 = require("../src/plugins/node-workspace");
const cargo_workspace_1 = require("../src/plugins/cargo-workspace");
const pull_request_title_1 = require("../src/util/pull-request-title");
const pull_request_body_1 = require("../src/util/pull-request-body");
const raw_content_1 = require("../src/updaters/raw-content");
const snapshot = require("snap-shot-it");
const errors_1 = require("../src/errors");
const request_error_1 = require("@octokit/request-error");
const nock = require("nock");
const linked_versions_1 = require("../src/plugins/linked-versions");
const maven_workspace_1 = require("../src/plugins/maven-workspace");
const graphql_1 = require("@octokit/graphql");
nock.disableNetConnect();
const sandbox = sinon.createSandbox();
const fixturesPath = './test/fixtures';
function mockPullRequests(github, openPullRequests, mergedPullRequests = [], closedPullRequests = []) {
    async function* fakeGenerator() {
        for (const pullRequest of openPullRequests) {
            yield pullRequest;
        }
    }
    async function* mergedGenerator() {
        for (const pullRequest of mergedPullRequests) {
            yield pullRequest;
        }
    }
    async function* closedGenerator() {
        for (const pullRequest of closedPullRequests) {
            yield pullRequest;
        }
    }
    return sandbox
        .stub(github, 'pullRequestIterator')
        .withArgs(sinon.match.string, 'OPEN')
        .returns(fakeGenerator())
        .withArgs(sinon.match.string, 'MERGED')
        .returns(mergedGenerator())
        .withArgs(sinon.match.string, 'CLOSED')
        .returns(closedGenerator());
}
function mockCreateRelease(github, releases) {
    const releaseStub = sandbox.stub(github, 'createRelease');
    for (const { id, sha, tagName, draft, duplicate } of releases) {
        const stub = releaseStub.withArgs(sinon.match.has('tag', sinon.match((tag) => tag.toString() === tagName)));
        if (duplicate) {
            stub.rejects(new errors_1.DuplicateReleaseError(new request_error_1.RequestError('dup', 400, {
                response: {
                    headers: {},
                    status: 400,
                    url: '',
                    data: '',
                },
                request: {
                    headers: {},
                    method: 'POST',
                    url: '',
                },
            }), tagName));
        }
        else {
            stub.resolves({
                id,
                tagName,
                sha,
                url: 'https://path/to/release',
                notes: 'some release notes',
                draft,
            });
        }
    }
    return releaseStub;
}
function pullRequestBody(path) {
    return (0, fs_1.readFileSync)((0, path_1.resolve)(fixturesPath, path), 'utf8').replace(/\r\n/g, '\n');
}
(0, mocha_1.describe)('Manifest', () => {
    let github;
    (0, mocha_1.beforeEach)(async () => {
        github = await github_1.GitHub.create({
            owner: 'fake-owner',
            repo: 'fake-repo',
            defaultBranch: 'main',
            token: 'fake-token',
        });
    });
    (0, mocha_1.afterEach)(() => {
        sandbox.restore();
    });
    (0, mocha_1.describe)('fromManifest', () => {
        (0, mocha_1.it)('should parse config and manifest from repository', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/config/config.json'))
                .withArgs('.release-please-manifest.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/versions/versions.json'));
            const manifest = await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch);
            (0, chai_1.expect)(Object.keys(manifest.repositoryConfig)).lengthOf(8);
            (0, chai_1.expect)(Object.keys(manifest.releasedVersions)).lengthOf(8);
        });
        (0, mocha_1.it)('should fetch config and manifest from changes-branch when specified', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/config/config.json'))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/versions/versions.json'));
            const manifest = await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch, undefined, undefined, { changesBranch: 'next' });
            (0, chai_1.expect)(Object.keys(manifest.repositoryConfig)).lengthOf(8);
            (0, chai_1.expect)(Object.keys(manifest.releasedVersions)).lengthOf(8);
        });
        (0, mocha_1.it)('should limit manifest loading to the given path', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/config/config.json'))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/versions/versions.json'));
            const manifest = await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch, undefined, undefined, { changesBranch: 'next' }, 'packages/gcf-utils');
            (0, chai_1.expect)(Object.keys(manifest.repositoryConfig)).lengthOf(1);
            (0, chai_1.expect)(manifest.repositoryConfig['packages/gcf-utils'].releaseType).to.eql('node');
            (0, chai_1.expect)(Object.keys(manifest.releasedVersions)).lengthOf(8);
        });
        (0, mocha_1.it)('should override release-as with the given argument', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/config/config.json'))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/versions/versions.json'));
            const manifest = await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch, undefined, undefined, { changesBranch: 'next' }, 'packages/gcf-utils', '12.34.56');
            (0, chai_1.expect)(Object.keys(manifest.repositoryConfig)).lengthOf(1);
            (0, chai_1.expect)(manifest.repositoryConfig['packages/gcf-utils'].releaseAs).to.eql('12.34.56');
            (0, chai_1.expect)(Object.keys(manifest.releasedVersions)).lengthOf(8);
        });
        (0, mocha_1.it)('should read the default release-type from manifest', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/config/root-release-type.json'))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/versions/versions.json'));
            const manifest = await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch, undefined, undefined, { changesBranch: 'next' });
            (0, chai_1.expect)(manifest.repositoryConfig['.'].releaseType).to.eql('java-yoshi');
            (0, chai_1.expect)(manifest.repositoryConfig['node-package'].releaseType).to.eql('node');
        });
        (0, mocha_1.it)('should read custom pull request title patterns from manifest', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/config/group-pr-title-pattern.json'))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/versions/versions.json'));
            const manifest = await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch, undefined, undefined, { changesBranch: 'next' });
            (0, chai_1.expect)(manifest['groupPullRequestTitlePattern']).to.eql('chore${scope}: release${component} v${version}');
            (0, chai_1.expect)(manifest.repositoryConfig['packages/cron-utils'].pullRequestTitlePattern).to.eql('chore${scope}: send it v${version}');
        });
        (0, mocha_1.it)('should read custom tag separator from manifest', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/config/tag-separator.json'))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/versions/versions.json'));
            const manifest = await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch, undefined, undefined, { changesBranch: 'next' });
            (0, chai_1.expect)(manifest.repositoryConfig['.'].tagSeparator).to.eql('-');
            (0, chai_1.expect)(manifest.repositoryConfig['packages/bot-config-utils'].tagSeparator).to.eql('/');
        });
        (0, mocha_1.it)('should read extra files from manifest', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/config/extra-files.json'))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/versions/versions.json'));
            const manifest = await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch, undefined, undefined, { changesBranch: 'next' });
            (0, chai_1.expect)(manifest.repositoryConfig['.'].extraFiles).to.eql([
                'default.txt',
                {
                    type: 'json',
                    path: 'path/default.json',
                    jsonpath: '$.version',
                },
            ]);
            (0, chai_1.expect)(manifest.repositoryConfig['packages/bot-config-utils'].extraFiles).to.eql([
                'foo.txt',
                {
                    type: 'json',
                    path: 'path/bar.json',
                    jsonpath: '$.version',
                },
            ]);
        });
        (0, mocha_1.it)('should read custom include component in tag from manifest', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/config/include-component-in-tag.json'))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/versions/versions.json'));
            const manifest = await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch, undefined, undefined, { changesBranch: 'next' });
            (0, chai_1.expect)(manifest.repositoryConfig['.'].includeComponentInTag).to.be.false;
            (0, chai_1.expect)(manifest.repositoryConfig['packages/bot-config-utils']
                .includeComponentInTag).to.be.true;
        });
        (0, mocha_1.it)('should read custom include v in tag from manifest', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/config/include-v-in-tag.json'))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/versions/versions.json'));
            const manifest = await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch, undefined, undefined, { changesBranch: 'next' });
            (0, chai_1.expect)(manifest.repositoryConfig['.'].includeVInTag).to.be.false;
            (0, chai_1.expect)(manifest.repositoryConfig['packages/bot-config-utils'].includeVInTag).to.be.true;
        });
        (0, mocha_1.it)('should read custom labels from manifest', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/config/labels.json'))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/versions/versions.json'));
            const manifest = await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch, undefined, undefined, { changesBranch: 'next' });
            (0, chai_1.expect)(manifest['labels']).to.deep.equal(['custom: pending']);
            (0, chai_1.expect)(manifest['releaseLabels']).to.deep.equal(['custom: tagged']);
            (0, chai_1.expect)(manifest['prereleaseLabels']).to.deep.equal([
                'custom: pre-release',
            ]);
        });
        (0, mocha_1.it)('should read reviewers from manifest', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/config/reviewers.json'))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/versions/versions.json'));
            const manifest = await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch, undefined, undefined, { changesBranch: 'next' });
            (0, chai_1.expect)(manifest['reviewers']).to.deep.equal(['sam', 'frodo']);
        });
        (0, mocha_1.it)('should read extra labels from manifest', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/config/extra-labels.json'))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/versions/versions.json'));
            const manifest = await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch, undefined, undefined, { changesBranch: 'next' });
            (0, chai_1.expect)(manifest.repositoryConfig['.'].extraLabels).to.deep.equal([
                'lang: java',
            ]);
            (0, chai_1.expect)(manifest.repositoryConfig['node-lib'].extraLabels).to.deep.equal([
                'lang: nodejs',
            ]);
        });
        (0, mocha_1.it)('should read exclude paths from manifest', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/config/exclude-paths.json'))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/versions/versions.json'));
            const manifest = await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch, undefined, undefined, { changesBranch: 'next' });
            (0, chai_1.expect)(manifest.repositoryConfig['.'].excludePaths).to.deep.equal([
                'path-root-ignore',
            ]);
            (0, chai_1.expect)(manifest.repositoryConfig['node-lib'].excludePaths).to.deep.equal([
                'path-ignore',
            ]);
        });
        (0, mocha_1.it)('should build simple plugins from manifest', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/config/plugins.json'))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/versions/versions.json'));
            const manifest = await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch, undefined, undefined, { changesBranch: 'next' });
            (0, chai_1.expect)(manifest.plugins).lengthOf(2);
            (0, chai_1.expect)(manifest.plugins[0]).instanceOf(node_workspace_1.NodeWorkspace);
            (0, chai_1.expect)(manifest.plugins[1]).instanceOf(cargo_workspace_1.CargoWorkspace);
        });
        (0, mocha_1.it)('should build complex plugins from manifest', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/config/complex-plugins.json'))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/versions/versions.json'));
            const manifest = await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch, undefined, undefined, { changesBranch: 'next' });
            (0, chai_1.expect)(manifest.plugins).lengthOf(1);
            (0, chai_1.expect)(manifest.plugins[0]).instanceOf(linked_versions_1.LinkedVersions);
            const plugin = manifest.plugins[0];
            (0, chai_1.expect)(plugin.groupName).to.eql('grouped components');
            (0, chai_1.expect)(plugin.components).to.eql(new Set(['pkg2', 'pkg3']));
        });
        (0, mocha_1.it)('should build maven-workspace from manifest', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/config/maven-workspace-plugins.json'))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/versions/versions.json'));
            const manifest = await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch, undefined, undefined, { changesBranch: 'next' });
            (0, chai_1.expect)(manifest.plugins).lengthOf(1);
            (0, chai_1.expect)(manifest.plugins[0]).instanceOf(maven_workspace_1.MavenWorkspace);
            const plugin = manifest.plugins[0];
            (0, chai_1.expect)(plugin.considerAllArtifacts).to.be.true;
        });
        (0, mocha_1.it)('should configure search depth from manifest', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/config/search-depth.json'))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/versions/versions.json'));
            const manifest = await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch, undefined, undefined, { changesBranch: 'next' });
            (0, chai_1.expect)(manifest.releaseSearchDepth).to.eql(10);
            (0, chai_1.expect)(manifest.commitSearchDepth).to.eql(50);
        });
        (0, mocha_1.it)('should read changelog host from manifest', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/config/changelog-host.json'))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/versions/versions.json'));
            const manifest = await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch, undefined, undefined, { changesBranch: 'next' });
            (0, chai_1.expect)(manifest.repositoryConfig['.'].changelogHost).to.eql('https://example.com');
            (0, chai_1.expect)(manifest.repositoryConfig['packages/bot-config-utils'].changelogHost).to.eql('https://override.example.com');
        });
        (0, mocha_1.it)('should read changelog type from manifest', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/config/changelog-type.json'))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/versions/versions.json'));
            const manifest = await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch, undefined, undefined, { changesBranch: 'next' });
            (0, chai_1.expect)(manifest.repositoryConfig['.'].changelogType).to.eql('github');
            (0, chai_1.expect)(manifest.repositoryConfig['packages/bot-config-utils'].changelogType).to.eql('default');
        });
        (0, mocha_1.it)('should read changelog path from manifest', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/config/changelog-path.json'))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/versions/versions.json'));
            const manifest = await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch, undefined, undefined, { changesBranch: 'next' });
            (0, chai_1.expect)(manifest.repositoryConfig['.'].changelogPath).to.eql('docs/foo.md');
            (0, chai_1.expect)(manifest.repositoryConfig['packages/bot-config-utils'].changelogPath).to.eql('docs/bar.md');
        });
        (0, mocha_1.it)('should read versioning type from manifest', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/config/versioning.json'))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/versions/versions.json'));
            const manifest = await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch, undefined, undefined, { changesBranch: 'next' });
            (0, chai_1.expect)(manifest.repositoryConfig['.'].versioning).to.eql('always-bump-patch');
            (0, chai_1.expect)(manifest.repositoryConfig['packages/bot-config-utils'].versioning).to.eql('default');
        });
        (0, mocha_1.it)('should throw a configuration error for a missing manifest config', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'next')
                .rejects(new errors_1.FileNotFoundError('.release-please-config.json'))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/versions/versions.json'));
            await assert.rejects(async () => {
                await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch, undefined, undefined, { changesBranch: 'next' });
            }, errors_1.ConfigurationError);
        });
        (0, mocha_1.it)('should throw a configuration error for a missing manifest versions file', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/config/config.json'))
                .withArgs('.release-please-manifest.json', 'next')
                .rejects(new errors_1.FileNotFoundError('.release-please-manifest.json'));
            await assert.rejects(async () => {
                await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch, undefined, undefined, { changesBranch: 'next' });
            }, errors_1.ConfigurationError);
        });
        (0, mocha_1.it)('should throw a configuration error for a malformed manifest config', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileRaw)('{"malformed json"'))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/versions/versions.json'));
            await assert.rejects(async () => {
                await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch, undefined, undefined, { changesBranch: 'next' });
            }, e => {
                console.log(e);
                return e instanceof errors_1.ConfigurationError && e.message.includes('parse');
            });
        });
        (0, mocha_1.it)('should throw a configuration error for a malformed manifest config', async () => {
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/config/config.json'))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileRaw)('{"malformed json"'));
            await assert.rejects(async () => {
                await manifest_1.Manifest.fromManifest(github, github.repository.defaultBranch, undefined, undefined, { changesBranch: 'next' });
            }, e => {
                console.log(e);
                return e instanceof errors_1.ConfigurationError && e.message.includes('parse');
            });
        });
    });
    (0, mocha_1.describe)('fromConfig', () => {
        (0, mocha_1.it)('should pass strategy options to the strategy', async () => {
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'abc123',
                    message: 'some commit message',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release 1.2.3',
                        body: '',
                        labels: [],
                        files: [],
                    },
                },
            ]);
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 123456,
                    tagName: 'v1.2.3',
                    sha: 'abc123',
                    url: 'http://path/to/release',
                },
            ]);
            const manifest = await manifest_1.Manifest.fromConfig(github, 'target-branch', {
                releaseType: 'simple',
                bumpMinorPreMajor: true,
                bumpPatchForMinorPreMajor: true,
            });
            (0, chai_1.expect)(Object.keys(manifest.repositoryConfig)).lengthOf(1);
            (0, chai_1.expect)(Object.keys(manifest.releasedVersions)).lengthOf(1);
        });
        (0, mocha_1.it)('should find custom release pull request title', async () => {
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'abc123',
                    message: 'some commit message',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please--branches--main--components--foobar',
                        baseBranchName: 'main',
                        title: 'release: 1.2.3',
                        number: 123,
                        body: '',
                        labels: [],
                        files: [],
                    },
                },
            ]);
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 123456,
                    tagName: 'v1.2.3',
                    sha: 'abc123',
                    url: 'http://path/to/release',
                },
            ]);
            const manifest = await manifest_1.Manifest.fromConfig(github, 'target-branch', {
                releaseType: 'simple',
                bumpMinorPreMajor: true,
                bumpPatchForMinorPreMajor: true,
                pullRequestTitlePattern: 'release: ${version}',
                component: 'foobar',
                includeComponentInTag: false,
            });
            (0, chai_1.expect)(Object.keys(manifest.repositoryConfig)).lengthOf(1);
            (0, chai_1.expect)(Object.keys(manifest.releasedVersions)).lengthOf(1);
        });
        (0, mocha_1.it)('finds previous release without tag', async () => {
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'abc123',
                    message: 'some commit message',
                    files: [],
                    pullRequest: {
                        title: 'chore: release 1.2.3',
                        headBranchName: 'release-please--branches--main--components--foobar',
                        baseBranchName: 'main',
                        number: 123,
                        body: '',
                        labels: [],
                        files: [],
                    },
                },
            ]);
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 123456,
                    tagName: 'v1.2.3',
                    sha: 'abc123',
                    url: 'http://path/to/release',
                },
            ]);
            const manifest = await manifest_1.Manifest.fromConfig(github, 'target-branch', {
                releaseType: 'simple',
                bumpMinorPreMajor: true,
                bumpPatchForMinorPreMajor: true,
                component: 'foobar',
                includeComponentInTag: false,
            });
            (0, chai_1.expect)(Object.keys(manifest.repositoryConfig)).lengthOf(1);
            (0, chai_1.expect)(Object.keys(manifest.releasedVersions)).lengthOf(1);
        });
        (0, mocha_1.it)('finds previous release with tag', async () => {
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'abc123',
                    message: 'some commit message',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main/components/foobar',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release foobar 1.2.3',
                        body: '',
                        labels: [],
                        files: [],
                    },
                },
            ]);
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 123456,
                    tagName: 'foobar-v1.2.3',
                    sha: 'abc123',
                    url: 'http://path/to/release',
                },
            ]);
            const manifest = await manifest_1.Manifest.fromConfig(github, 'target-branch', {
                releaseType: 'simple',
                bumpMinorPreMajor: true,
                bumpPatchForMinorPreMajor: true,
                component: 'foobar',
                includeComponentInTag: true,
            });
            (0, chai_1.expect)(Object.keys(manifest.repositoryConfig)).lengthOf(1);
            (0, chai_1.expect)(Object.keys(manifest.releasedVersions)).lengthOf(1);
        });
        (0, mocha_1.it)('finds manually tagged release', async () => {
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'abc123',
                    message: 'some commit message',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main/components/foobar',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release foobar 1.2.3',
                        body: '',
                        labels: [],
                        files: [],
                    },
                },
            ]);
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 123456,
                    tagName: 'other-v3.3.3',
                    sha: 'abc123',
                    url: 'http://path/to/release',
                },
            ]);
            const manifest = await manifest_1.Manifest.fromConfig(github, 'target-branch', {
                releaseType: 'simple',
                bumpMinorPreMajor: true,
                bumpPatchForMinorPreMajor: true,
                component: 'other',
                includeComponentInTag: true,
            });
            (0, chai_1.expect)(Object.keys(manifest.repositoryConfig)).lengthOf(1);
            (0, chai_1.expect)(Object.keys(manifest.releasedVersions), 'found release versions').lengthOf(1);
            (0, chai_1.expect)(Object.values(manifest.releasedVersions)[0].toString()).to.eql('3.3.3');
        });
        (0, mocha_1.it)('finds legacy tags', async () => {
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'abc123',
                    message: 'some commit message',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main/components/foobar',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release foobar 1.2.3',
                        body: '',
                        labels: [],
                        files: [],
                    },
                },
            ]);
            (0, helpers_1.mockReleases)(sandbox, github, []);
            (0, helpers_1.mockTags)(sandbox, github, [
                {
                    name: 'other-v3.3.3',
                    sha: 'abc123',
                },
            ]);
            const manifest = await manifest_1.Manifest.fromConfig(github, 'target-branch', {
                releaseType: 'simple',
                bumpMinorPreMajor: true,
                bumpPatchForMinorPreMajor: true,
                component: 'other',
                includeComponentInTag: true,
            });
            (0, chai_1.expect)(Object.keys(manifest.repositoryConfig)).lengthOf(1);
            (0, chai_1.expect)(Object.keys(manifest.releasedVersions), 'found release versions').lengthOf(1);
            (0, chai_1.expect)(Object.values(manifest.releasedVersions)[0].toString()).to.eql('3.3.3');
        });
        (0, mocha_1.it)('ignores manually tagged release if commit not found', async () => {
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'abc123',
                    message: 'some commit message',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main/components/foobar',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release foobar 1.2.3',
                        body: '',
                        labels: [],
                        files: [],
                    },
                },
            ]);
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 123456,
                    tagName: 'other-v3.3.3',
                    sha: 'def234',
                    url: 'http://path/to/release',
                },
            ]);
            (0, helpers_1.mockTags)(sandbox, github, []);
            const manifest = await manifest_1.Manifest.fromConfig(github, 'target-branch', {
                releaseType: 'simple',
                bumpMinorPreMajor: true,
                bumpPatchForMinorPreMajor: true,
                component: 'other',
                includeComponentInTag: true,
            });
            (0, chai_1.expect)(Object.keys(manifest.repositoryConfig)).lengthOf(1);
            (0, chai_1.expect)(Object.keys(manifest.releasedVersions), 'found release versions')
                .to.be.empty;
        });
        (0, mocha_1.it)('finds largest manually tagged release', async () => {
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'abc123',
                    message: 'some commit message',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main/components/foobar',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release foobar 1.2.3',
                        body: '',
                        labels: [],
                        files: [],
                    },
                },
                {
                    sha: 'def234',
                    message: 'some commit message',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main/components/foobar',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release foobar 1.2.3',
                        body: '',
                        labels: [],
                        files: [],
                    },
                },
            ]);
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 123456,
                    tagName: 'other-v3.3.3',
                    sha: 'abc123',
                    url: 'http://path/to/release',
                },
                {
                    id: 654321,
                    tagName: 'other-v3.3.2',
                    sha: 'def234',
                    url: 'http://path/to/release',
                },
            ]);
            const manifest = await manifest_1.Manifest.fromConfig(github, 'target-branch', {
                releaseType: 'simple',
                bumpMinorPreMajor: true,
                bumpPatchForMinorPreMajor: true,
                component: 'other',
                includeComponentInTag: true,
            });
            (0, chai_1.expect)(Object.keys(manifest.repositoryConfig)).lengthOf(1);
            (0, chai_1.expect)(Object.keys(manifest.releasedVersions), 'found release versions').lengthOf(1);
            (0, chai_1.expect)(Object.values(manifest.releasedVersions)[0].toString()).to.eql('3.3.3');
        });
        (0, mocha_1.it)('finds largest found tagged', async () => {
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'abc123',
                    message: 'some commit message',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main/components/foobar',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release foobar 1.2.3',
                        body: '',
                        labels: [],
                        files: [],
                    },
                },
                {
                    sha: 'def234',
                    message: 'some commit message',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main/components/foobar',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release foobar 1.2.3',
                        body: '',
                        labels: [],
                        files: [],
                    },
                },
            ]);
            (0, helpers_1.mockReleases)(sandbox, github, []);
            (0, helpers_1.mockTags)(sandbox, github, [
                {
                    name: 'other-v3.3.3',
                    sha: 'abc123',
                },
                {
                    name: 'other-v3.3.2',
                    sha: 'def234',
                },
            ]);
            const manifest = await manifest_1.Manifest.fromConfig(github, 'target-branch', {
                releaseType: 'simple',
                bumpMinorPreMajor: true,
                bumpPatchForMinorPreMajor: true,
                component: 'other',
                includeComponentInTag: true,
            });
            (0, chai_1.expect)(Object.keys(manifest.repositoryConfig)).lengthOf(1);
            (0, chai_1.expect)(Object.keys(manifest.releasedVersions), 'found release versions').lengthOf(1);
            (0, chai_1.expect)(Object.values(manifest.releasedVersions)[0].toString()).to.eql('3.3.3');
        });
        (0, mocha_1.it)('finds manually tagged release commit over earlier automated commit', async () => {
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'abc123',
                    message: 'some commit message',
                    files: [],
                },
                {
                    sha: 'def234',
                    message: 'this commit should be found',
                    files: [],
                },
                {
                    sha: 'ghi345',
                    message: 'some commit message',
                    files: [],
                    pullRequest: {
                        title: 'chore: release 3.3.1',
                        headBranchName: 'release-please/branches/main',
                        baseBranchName: 'main',
                        number: 123,
                        body: '',
                        labels: [],
                        files: [],
                    },
                },
            ]);
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 123456,
                    tagName: 'v3.3.2',
                    sha: 'def234',
                    url: 'http://path/to/release',
                },
                {
                    id: 654321,
                    tagName: 'v3.3.1',
                    sha: 'ghi345',
                    url: 'http://path/to/release',
                },
            ]);
            (0, helpers_1.mockTags)(sandbox, github, []);
            const manifest = await manifest_1.Manifest.fromConfig(github, 'target-branch', {
                releaseType: 'simple',
                bumpMinorPreMajor: true,
                bumpPatchForMinorPreMajor: true,
            });
            (0, chai_1.expect)(Object.keys(manifest.repositoryConfig)).lengthOf(1);
            (0, chai_1.expect)(Object.keys(manifest.releasedVersions), 'found release versions').lengthOf(1);
            (0, chai_1.expect)(Object.values(manifest.releasedVersions)[0].toString()).to.eql('3.3.2');
        });
        (0, mocha_1.it)('allows configuring includeVInTag', async () => {
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'abc123',
                    message: 'some commit message',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release 1.2.3',
                        body: '',
                        labels: [],
                        files: [],
                    },
                },
            ]);
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 123456,
                    tagName: 'v1.2.3',
                    sha: 'abc123',
                    url: 'http://path/to/release',
                },
            ]);
            const manifest = await manifest_1.Manifest.fromConfig(github, 'target-branch', {
                releaseType: 'simple',
                includeVInTag: false,
            });
            (0, chai_1.expect)(Object.keys(manifest.repositoryConfig)).lengthOf(1);
            (0, chai_1.expect)(Object.keys(manifest.releasedVersions)).lengthOf(1);
            (0, chai_1.expect)(manifest.repositoryConfig['.'].includeVInTag).to.be.false;
        });
        (0, mocha_1.it)('finds latest published release', async () => {
            (0, helpers_1.mockReleases)(sandbox, github, []);
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'abc123',
                    message: 'some commit message',
                    files: [],
                    pullRequest: {
                        title: 'chore: release 1.2.4-SNAPSHOT',
                        headBranchName: 'release-please/branches/main',
                        baseBranchName: 'main',
                        number: 123,
                        body: '',
                        labels: [],
                        files: [],
                    },
                },
                {
                    sha: 'abc123',
                    message: 'some commit message',
                    files: [],
                    pullRequest: {
                        title: 'chore: release 1.2.3',
                        headBranchName: 'release-please/branches/main',
                        baseBranchName: 'main',
                        number: 123,
                        body: '',
                        labels: [],
                        files: [],
                    },
                },
            ]);
            const manifest = await manifest_1.Manifest.fromConfig(github, 'target-branch', {
                releaseType: 'java',
                includeComponentInTag: false,
            });
            (0, chai_1.expect)(Object.keys(manifest.releasedVersions)).lengthOf(1);
            (0, chai_1.expect)(manifest.releasedVersions['.'].toString()).to.be.equal('1.2.3');
        });
        (0, mocha_1.it)('falls back to release without component in tag', async () => {
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'abc123',
                    message: 'some commit message',
                    files: [],
                },
                {
                    sha: 'def234',
                    message: 'this commit should be found',
                    files: [],
                },
                {
                    sha: 'ghi345',
                    message: 'some commit message',
                    files: [],
                    pullRequest: {
                        title: 'chore: release 3.3.1',
                        // fails to match legacy branch name without component
                        headBranchName: 'release-please/branches/main',
                        baseBranchName: 'main',
                        number: 123,
                        body: '',
                        labels: [],
                        files: [],
                    },
                },
            ]);
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 123456,
                    tagName: 'v3.3.1',
                    sha: 'ghi345',
                    url: 'http://path/to/release',
                },
            ]);
            (0, helpers_1.mockTags)(sandbox, github, []);
            const manifest = await manifest_1.Manifest.fromConfig(github, 'target-branch', {
                releaseType: 'simple',
                bumpMinorPreMajor: true,
                bumpPatchForMinorPreMajor: true,
                component: 'foobar',
                includeComponentInTag: false,
            });
            (0, chai_1.expect)(Object.keys(manifest.repositoryConfig)).lengthOf(1);
            (0, chai_1.expect)(Object.keys(manifest.releasedVersions), 'found release versions').lengthOf(1);
            (0, chai_1.expect)(Object.values(manifest.releasedVersions)[0].toString()).to.eql('3.3.1');
        });
        (0, mocha_1.it)('should fail if graphQL commits API is too slow', async () => {
            // In this scenario, graphQL fails with a 502 when pulling the list of
            // recent commits. We are unable to determine the latest release and thus
            // we should abort with the underlying API error.
            const scope = nock('https://api.github.com/')
                .post('/graphql')
                .times(6) // original + 5 retries
                .reply(502);
            const sleepStub = sandbox.stub(github, 'sleepInMs').resolves(); // eslint-disable-line @typescript-eslint/no-explicit-any
            await assert.rejects(async () => {
                await manifest_1.Manifest.fromConfig(github, 'target-branch', {
                    releaseType: 'simple',
                    bumpMinorPreMajor: true,
                    bumpPatchForMinorPreMajor: true,
                    component: 'foobar',
                    includeComponentInTag: false,
                });
            }, (error) => {
                return (error instanceof errors_1.GitHubAPIError &&
                    error.status === 502);
            });
            scope.done();
            sinon.assert.callCount(sleepStub, 5);
        });
    });
    (0, mocha_1.describe)('buildPullRequests', () => {
        (0, mocha_1.describe)('with basic config', () => {
            (0, mocha_1.beforeEach)(() => {
                (0, helpers_1.mockReleases)(sandbox, github, [
                    {
                        id: 123456,
                        sha: 'abc123',
                        tagName: 'v1.0.0',
                        url: 'https://github.com/fake-owner/fake-repo/releases/tag/v1.0.0',
                    },
                ]);
                (0, helpers_1.mockTags)(sandbox, github, [
                    {
                        sha: 'abc123',
                        name: 'v1.0.0',
                    },
                ]);
                (0, helpers_1.mockCommits)(sandbox, github, [
                    {
                        sha: 'def456',
                        message: 'fix: some bugfix',
                        files: [],
                    },
                    {
                        sha: 'abc123',
                        message: 'chore: release 1.0.0',
                        files: [],
                        pullRequest: {
                            headBranchName: 'release-please/branches/main',
                            baseBranchName: 'main',
                            number: 123,
                            title: 'chore: release 1.0.0',
                            body: '',
                            labels: [],
                            files: [],
                            sha: 'abc123',
                        },
                    },
                ]);
            });
            (0, mocha_1.it)('should handle single package repository', async () => {
                var _a, _b;
                const manifest = new manifest_1.Manifest(github, 'main', {
                    '.': {
                        releaseType: 'simple',
                    },
                }, {
                    '.': version_1.Version.parse('1.0.0'),
                });
                const pullRequests = await manifest.buildPullRequests([], []);
                (0, chai_1.expect)(pullRequests).lengthOf(1);
                const pullRequest = pullRequests[0];
                (0, chai_1.expect)((_a = pullRequest.version) === null || _a === void 0 ? void 0 : _a.toString()).to.eql('1.0.1');
                (0, chai_1.expect)((_b = pullRequest.previousVersion) === null || _b === void 0 ? void 0 : _b.toString()).to.eql('1.0.0');
                (0, chai_1.expect)(pullRequest.version.compareBump(pullRequest.previousVersion)).to.eql('patch');
                // simple release type updates the changelog and version.txt
                (0, helpers_1.assertHasUpdate)(pullRequest.updates, 'CHANGELOG.md');
                (0, helpers_1.assertHasUpdate)(pullRequest.updates, 'version.txt');
                (0, helpers_1.assertHasUpdate)(pullRequest.updates, '.release-please-manifest.json');
                (0, chai_1.expect)(pullRequest.headRefName).to.eql('release-please--branches--main');
            });
            (0, mocha_1.it)('should identify prerelease bumps as such', async () => {
                var _a, _b;
                const manifest = new manifest_1.Manifest(github, 'main', {
                    '.': {
                        releaseType: 'simple',
                        versioning: 'prerelease',
                    },
                }, {
                    '.': version_1.Version.parse('0.1.0-alpha.28'),
                });
                const pullRequests = await manifest.buildPullRequests([], []);
                (0, chai_1.expect)(pullRequests).lengthOf(1);
                const pullRequest = pullRequests[0];
                (0, chai_1.expect)((_a = pullRequest.version) === null || _a === void 0 ? void 0 : _a.toString()).to.eql('0.1.0-alpha.29');
                (0, chai_1.expect)((_b = pullRequest.previousVersion) === null || _b === void 0 ? void 0 : _b.toString()).to.eql('0.1.0-alpha.28');
                (0, chai_1.expect)(pullRequest.version.compareBump(pullRequest.previousVersion)).to.eql('preRelease');
                // simple release type updates the changelog and version.txt
                (0, helpers_1.assertHasUpdate)(pullRequest.updates, 'CHANGELOG.md');
                (0, helpers_1.assertHasUpdate)(pullRequest.updates, 'version.txt');
                (0, helpers_1.assertHasUpdate)(pullRequest.updates, '.release-please-manifest.json');
                (0, chai_1.expect)(pullRequest.headRefName).to.eql('release-please--branches--main');
            });
            (0, mocha_1.it)('should honour the manifestFile argument in Manifest.fromManifest', async () => {
                const getFileContentsStub = sandbox
                    .stub(github, 'getFileContentsOnBranch')
                    .withArgs('release-please-config.json', 'next')
                    .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/config/simple.json'))
                    .withArgs('non/default/path/manifest.json', 'next')
                    .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/versions/simple.json'));
                const manifest = await manifest_1.Manifest.fromManifest(github, 'main', undefined, 'non/default/path/manifest.json', { changesBranch: 'next' });
                const pullRequests = await manifest.buildPullRequests([], []);
                (0, chai_1.expect)(pullRequests).lengthOf(1);
                const pullRequest = pullRequests[0];
                (0, helpers_1.assertHasUpdate)(pullRequest.updates, 'non/default/path/manifest.json');
                sinon.assert.calledOnceWithExactly(getFileContentsStub, 'non/default/path/manifest.json', 'next');
            });
            (0, mocha_1.it)('should create a draft pull request', async () => {
                const manifest = new manifest_1.Manifest(github, 'main', {
                    '.': {
                        releaseType: 'simple',
                        draftPullRequest: true,
                    },
                }, {
                    '.': version_1.Version.parse('1.0.0'),
                });
                const pullRequests = await manifest.buildPullRequests([], []);
                (0, chai_1.expect)(pullRequests).lengthOf(1);
                const pullRequest = pullRequests[0];
                (0, chai_1.expect)(pullRequest.draft).to.be.true;
            });
            (0, mocha_1.it)('should create a draft pull request manifest wide', async () => {
                const manifest = new manifest_1.Manifest(github, 'main', {
                    '.': {
                        releaseType: 'simple',
                    },
                }, {
                    '.': version_1.Version.parse('1.0.0'),
                }, {
                    draftPullRequest: true,
                });
                const pullRequests = await manifest.buildPullRequests([], []);
                (0, chai_1.expect)(pullRequests).lengthOf(1);
                const pullRequest = pullRequests[0];
                (0, chai_1.expect)(pullRequest.draft).to.be.true;
            });
            (0, mocha_1.it)('allows customizing pull request labels', async () => {
                const manifest = new manifest_1.Manifest(github, 'main', {
                    '.': {
                        releaseType: 'simple',
                    },
                }, {
                    '.': version_1.Version.parse('1.0.0'),
                }, {
                    labels: ['some-special-label'],
                });
                const pullRequests = await manifest.buildPullRequests([], []);
                (0, chai_1.expect)(pullRequests).lengthOf(1);
                const pullRequest = pullRequests[0];
                (0, chai_1.expect)(pullRequest.labels).to.eql(['some-special-label']);
            });
            (0, mocha_1.it)('allows customizing pull request title', async () => {
                const manifest = new manifest_1.Manifest(github, 'main', {
                    '.': {
                        releaseType: 'simple',
                        pullRequestTitlePattern: 'release: ${version}',
                    },
                }, {
                    '.': version_1.Version.parse('1.0.0'),
                });
                const pullRequests = await manifest.buildPullRequests([], []);
                (0, chai_1.expect)(pullRequests).lengthOf(1);
                const pullRequest = pullRequests[0];
                (0, chai_1.expect)(pullRequest.title.toString()).to.eql('release: 1.0.1');
            });
            (0, mocha_1.it)('allows customizing pull request header', async () => {
                const manifest = new manifest_1.Manifest(github, 'main', {
                    '.': {
                        releaseType: 'simple',
                        pullRequestHeader: 'No beep boop for you',
                    },
                }, {
                    '.': version_1.Version.parse('1.0.0'),
                });
                const pullRequests = await manifest.buildPullRequests([], []);
                (0, chai_1.expect)(pullRequests).lengthOf(1);
                const pullRequest = pullRequests[0];
                (0, chai_1.expect)(pullRequest.body.header.toString()).to.eql('No beep boop for you');
            });
        });
        (0, mocha_1.it)('should find the component from config', async () => {
            var _a, _b;
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 123456,
                    sha: 'abc123',
                    tagName: 'pkg1-v1.0.0',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg1-v1.0.0',
                },
            ]);
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'def456',
                    message: 'fix: some bugfix',
                    files: [],
                },
                {
                    sha: 'abc123',
                    message: 'chore: release 1.0.0',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main/components/pkg1',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release 1.0.0',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'abc123',
                    },
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/repo/node/pkg1/package.json'));
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'node',
                },
            }, {
                '.': version_1.Version.parse('1.0.0'),
            });
            const pullRequests = await manifest.buildPullRequests([], []);
            (0, chai_1.expect)(pullRequests).lengthOf(1);
            const pullRequest = pullRequests[0];
            (0, chai_1.expect)((_a = pullRequest.version) === null || _a === void 0 ? void 0 : _a.toString()).to.eql('1.0.1');
            (0, chai_1.expect)((_b = pullRequest.previousVersion) === null || _b === void 0 ? void 0 : _b.toString()).to.eql('1.0.0');
            (0, chai_1.expect)(pullRequest.version.compareBump(pullRequest.previousVersion)).to.eql('patch');
            (0, chai_1.expect)(pullRequest.headRefName).to.eql('release-please--branches--main--components--pkg1');
        });
        (0, mocha_1.it)('should handle multiple package repository', async () => {
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 123456,
                    sha: 'abc123',
                    tagName: 'pkg1-v1.0.0',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg1-v1.0.0',
                },
                {
                    id: 654321,
                    sha: 'def234',
                    tagName: 'pkg2-v0.2.3',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg2-v0.2.3',
                },
            ]);
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'aaaaaa',
                    message: 'fix: some bugfix',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'abc123',
                    message: 'chore: release main',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release main',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'abc123',
                    },
                },
                {
                    sha: 'bbbbbb',
                    message: 'fix: some bugfix',
                    files: ['path/b/foo'],
                },
                {
                    sha: 'cccccc',
                    message: 'fix: some bugfix',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'def234',
                    message: 'chore: release main',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release main',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'def234',
                    },
                },
            ]);
            const manifest = new manifest_1.Manifest(github, 'main', {
                'path/a': {
                    releaseType: 'simple',
                    component: 'pkg1',
                },
                'path/b': {
                    releaseType: 'simple',
                    component: 'pkg2',
                },
            }, {
                'path/a': version_1.Version.parse('1.0.0'),
                'path/b': version_1.Version.parse('0.2.3'),
            });
            const pullRequests = await manifest.buildPullRequests([], []);
            (0, chai_1.expect)(pullRequests).lengthOf(1);
            (0, chai_1.expect)(pullRequests[0].labels).to.eql(['autorelease: pending']);
            snapshot((0, helpers_1.dateSafe)(pullRequests[0].body.toString()));
        });
        (0, mocha_1.it)('should ignore multiple package release commits', async () => {
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 123456,
                    sha: 'abc123',
                    tagName: 'pkg1-v1.0.0',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg1-v1.0.0',
                },
                {
                    id: 654321,
                    sha: 'def234',
                    tagName: 'pkg2-v0.2.3',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg2-v0.2.3',
                },
            ]);
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'def234',
                    message: 'chore: release main',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release main',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'def234',
                    },
                },
            ]);
            const manifest = new manifest_1.Manifest(github, 'main', {
                'path/a': {
                    releaseType: 'simple',
                    component: 'pkg1',
                },
                'path/b': {
                    releaseType: 'simple',
                    component: 'pkg2',
                },
            }, {
                'path/a': version_1.Version.parse('1.0.0'),
                'path/b': version_1.Version.parse('0.2.3'),
            });
            const pullRequests = await manifest.buildPullRequests([], []);
            (0, chai_1.expect)(pullRequests).lengthOf(0);
        });
        (0, mocha_1.it)('should allow creating multiple pull requests', async () => {
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 123456,
                    sha: 'abc123',
                    tagName: 'pkg1-v1.0.0',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg1-v1.0.0',
                },
                {
                    id: 654321,
                    sha: 'def234',
                    tagName: 'pkg2-v0.2.3',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg2-v1.0.0',
                },
            ]);
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'aaaaaa',
                    message: 'fix: some bugfix',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'abc123',
                    message: 'chore: release 1.0.0',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main/components/pkg1',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release 1.0.0',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'abc123',
                    },
                },
                {
                    sha: 'bbbbbb',
                    message: 'fix: some bugfix',
                    files: ['path/b/foo'],
                },
                {
                    sha: 'cccccc',
                    message: 'fix: some bugfix',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'def234',
                    message: 'chore: release 0.2.3',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main/components/pkg2',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release 0.2.3',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'def234',
                    },
                },
            ]);
            const manifest = new manifest_1.Manifest(github, 'main', {
                'path/a': {
                    releaseType: 'simple',
                    component: 'pkg1',
                },
                'path/b': {
                    releaseType: 'simple',
                    component: 'pkg2',
                },
            }, {
                'path/a': version_1.Version.parse('1.0.0'),
                'path/b': version_1.Version.parse('0.2.3'),
            }, {
                separatePullRequests: true,
            });
            const pullRequests = await manifest.buildPullRequests([], []);
            (0, chai_1.expect)(pullRequests).lengthOf(2);
            snapshot((0, helpers_1.dateSafe)(pullRequests[0].body.toString()));
            snapshot((0, helpers_1.dateSafe)(pullRequests[1].body.toString()));
        });
        (0, mocha_1.it)('should allow forcing release-as on a single component', async () => {
            var _a, _b;
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 123456,
                    sha: 'abc123',
                    tagName: 'pkg1-v1.0.0',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg1-v1.0.0',
                },
                {
                    id: 654321,
                    sha: 'def234',
                    tagName: 'pkg2-v0.2.3',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg2-v1.0.0',
                },
            ]);
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'aaaaaa',
                    message: 'fix: some bugfix',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'abc123',
                    message: 'chore: release 1.0.0',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main/components/pkg1',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release 1.0.0',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'abc123',
                    },
                },
                {
                    sha: 'bbbbbb',
                    message: 'fix: some bugfix',
                    files: ['path/b/foo'],
                },
                {
                    sha: 'cccccc',
                    message: 'fix: some bugfix',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'def234',
                    message: 'chore: release 0.2.3',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main/components/pkg2',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release 0.2.3',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'def234',
                    },
                },
            ]);
            const config = {
                'separate-pull-requests': true,
                packages: {
                    'path/a': {
                        'release-type': 'simple',
                        component: 'pkg1',
                    },
                    'path/b': {
                        'release-type': 'simple',
                        component: 'pkg2',
                        'release-as': '3.3.3',
                    },
                },
            };
            const versions = {
                'path/a': '1.0.0',
                'path/b': '0.2.3',
            };
            sandbox
                .stub(github, 'getFileContentsOnBranch')
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify(config)))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify(versions)));
            const manifest = await manifest_1.Manifest.fromManifest(github, 'main', undefined, undefined, { changesBranch: 'next' });
            const pullRequests = await manifest.buildPullRequests([], []);
            (0, chai_1.expect)(pullRequests).lengthOf(2);
            (0, chai_1.expect)((_a = pullRequests[0].version) === null || _a === void 0 ? void 0 : _a.toString()).to.eql('1.0.1');
            (0, chai_1.expect)((_b = pullRequests[1].version) === null || _b === void 0 ? void 0 : _b.toString()).to.eql('3.3.3');
        });
        (0, mocha_1.it)('should allow forcing release-as on entire manifest', async () => {
            var _a, _b;
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 123456,
                    sha: 'abc123',
                    tagName: 'pkg1-v1.0.0',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg1-v1.0.0',
                },
                {
                    id: 654321,
                    sha: 'def234',
                    tagName: 'pkg2-v0.2.3',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg2-v1.0.0',
                },
            ]);
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'aaaaaa',
                    message: 'fix: some bugfix',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'abc123',
                    message: 'chore: release 1.0.0',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main/components/pkg1',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release 1.0.0',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'abc123',
                    },
                },
                {
                    sha: 'bbbbbb',
                    message: 'fix: some bugfix',
                    files: ['path/b/foo'],
                },
                {
                    sha: 'cccccc',
                    message: 'fix: some bugfix',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'def234',
                    message: 'chore: release 0.2.3',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main/components/pkg2',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release 0.2.3',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'def234',
                    },
                },
            ]);
            const config = {
                'release-as': '3.3.3',
                'separate-pull-requests': true,
                packages: {
                    'path/a': {
                        'release-type': 'simple',
                        component: 'pkg1',
                    },
                    'path/b': {
                        'release-type': 'simple',
                        component: 'pkg2',
                    },
                },
            };
            const versions = {
                'path/a': '1.0.0',
                'path/b': '0.2.3',
            };
            sandbox
                .stub(github, 'getFileContentsOnBranch')
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify(config)))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify(versions)));
            const manifest = await manifest_1.Manifest.fromManifest(github, 'main', undefined, undefined, { changesBranch: 'next' });
            const pullRequests = await manifest.buildPullRequests([], []);
            (0, chai_1.expect)(pullRequests).lengthOf(2);
            (0, chai_1.expect)((_a = pullRequests[0].version) === null || _a === void 0 ? void 0 : _a.toString()).to.eql('3.3.3');
            (0, chai_1.expect)((_b = pullRequests[1].version) === null || _b === void 0 ? void 0 : _b.toString()).to.eql('3.3.3');
        });
        (0, mocha_1.it)('should use version from existing PR title if differs from release branch manifest', async () => {
            var _a, _b, _c, _d;
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 11111,
                    sha: 'commit1',
                    tagName: 'pkg1-v1.0.0',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg1-v1.0.0',
                },
                {
                    id: 22222,
                    sha: 'commit2',
                    tagName: 'pkg2-v2.0.0',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg2-v2.0.0',
                },
                {
                    id: 33333,
                    sha: 'commit3',
                    tagName: 'pkg3-v3.0.0',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg3-v3.0.0',
                },
                {
                    id: 44444,
                    sha: 'commit4',
                    tagName: 'pkg4-v4.0.0',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg4-v4.0.0',
                },
            ]);
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'commit11',
                    message: 'fix: some bugfix',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'commit22',
                    message: 'fix: some bugfix',
                    files: ['path/b/foo'],
                },
                {
                    sha: 'commit33',
                    message: 'fix: some bugfix',
                    files: ['path/c/foo'],
                },
                {
                    sha: 'commit44',
                    message: 'fix: some bugfix',
                    files: ['path/d/foo'],
                },
                {
                    sha: 'commit1',
                    message: 'chore: release 1.0.0',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please--branches--main--changes--next--components--pkg1',
                        baseBranchName: 'main',
                        number: 111,
                        title: 'chore: release 1.0.0',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'commit1',
                    },
                },
                {
                    sha: 'commit2',
                    message: 'chore: release 2.0.0',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please--branches--main--changes--next--components--pkg2',
                        baseBranchName: 'main',
                        number: 222,
                        title: 'chore: release 2.0.0',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'commit2',
                    },
                },
                {
                    sha: 'commit3',
                    message: 'chore: release 3.0.0',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please--branches--main--changes--next--components--pkg3',
                        baseBranchName: 'main',
                        number: 333,
                        title: 'chore: release 3.0.0',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'commit3',
                    },
                },
                {
                    sha: 'commit4',
                    message: 'chore: release 4.0.0',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please--branches--main--changes--next--components--pkg4',
                        baseBranchName: 'main',
                        number: 444,
                        title: 'chore: release 4.0.0',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'commit4',
                    },
                },
            ]);
            const config = {
                'separate-pull-requests': true,
                'release-type': 'simple',
                packages: {
                    'path/a': {
                        'release-type': 'simple',
                        component: 'pkg1',
                    },
                    'path/b': {
                        'release-type': 'node',
                        component: 'pkg2',
                    },
                    'path/c': {
                        'release-type': 'python',
                        component: 'pkg3',
                    },
                    'path/d': {
                        'release-type': 'go',
                        component: 'pkg4',
                    },
                },
            };
            const getFileContentsOnBranchStub = sandbox
                .stub(github, 'getFileContentsOnBranch')
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify(config)))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({
                'path/a': '1.0.0',
                'path/b': '2.0.0',
                'path/c': '3.0.0',
                'path/d': '4.0.0',
            })))
                .withArgs('.release-please-manifest.json', 'release-please--branches--main--changes--next--components--pkg1')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({
                'path/a': '1.0.1',
            })))
                .withArgs('.release-please-manifest.json', 'release-please--branches--main--changes--next--components--pkg2')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({
                'path/b': '2.0.1',
            })))
                .withArgs('path/b/package.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({
                name: 'pkg2',
            })))
                .withArgs('.release-please-manifest.json', 'release-please--branches--main--changes--next--components--pkg3')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({
                'path/c': '3.0.1',
            })))
                .withArgs('path/c/setup.py', 'next')
                .resolves((0, helpers_1.buildGitHubFileRaw)(`
name = "pkg3"
description = "Something"
version = "3.0.0"
`))
                .withArgs('.release-please-manifest.json', 'release-please--branches--main--changes--next--components--pkg4')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({
                'path/d': '4.0.1',
            })));
            const findFilesByFilenameAndRefStub = sandbox
                .stub(github, 'findFilesByFilenameAndRef')
                .withArgs('version.py', 'next', 'path/c')
                .resolves([]);
            // need to avoid making a request for go versioning
            sandbox.stub(github, 'findFilesByGlobAndRef').resolves([]);
            const addIssueLabelsStub = sandbox
                .stub(github, 'addIssueLabels')
                .withArgs([manifest_1.DEFAULT_CUSTOM_VERSION_LABEL], 111)
                .resolves();
            let commentCount = 0;
            sandbox.replace(github, 'commentOnIssue', (comment, number) => {
                snapshot(comment);
                (0, chai_1.expect)(number).to.be.oneOf([111, 222, 333, 444]);
                commentCount += 1;
                return Promise.resolve('https://foo/bar');
            });
            const manifest = await manifest_1.Manifest.fromManifest(github, 'main', undefined, undefined, { changesBranch: 'next' });
            const pullRequests = await manifest.buildPullRequests([
                {
                    title: 'chore(main): release v6.7.9-alpha.1', // version from title differs from PR manifest
                    body: 'some content',
                    headBranchName: 'release-please--branches--main--changes--next--components--pkg1',
                    baseBranchName: 'main',
                    number: 111,
                    labels: [],
                    files: [],
                },
                {
                    title: 'chore(main): release v7.8.9', // version from title differs from PR manifest
                    body: 'some content',
                    headBranchName: 'release-please--branches--main--changes--next--components--pkg2',
                    baseBranchName: 'main',
                    number: 222,
                    labels: [],
                    files: [],
                },
                {
                    title: 'chore(main): release 8.9.0', // version from title differs from PR manifest
                    body: 'some content',
                    headBranchName: 'release-please--branches--main--changes--next--components--pkg3',
                    baseBranchName: 'main',
                    number: 333,
                    labels: [],
                    files: [],
                },
                {
                    title: 'chore(main): release v9.0.1', // version from title differs from PR manifest
                    body: 'some content',
                    headBranchName: 'release-please--branches--main--changes--next--components--pkg4',
                    baseBranchName: 'main',
                    number: 444,
                    labels: [],
                    files: [],
                },
            ], []);
            (0, chai_1.expect)(pullRequests).lengthOf(4);
            (0, chai_1.expect)((_a = pullRequests[0].version) === null || _a === void 0 ? void 0 : _a.toString()).to.eql('6.7.9-alpha.1');
            (0, chai_1.expect)((_b = pullRequests[1].version) === null || _b === void 0 ? void 0 : _b.toString()).to.eql('7.8.9');
            (0, chai_1.expect)((_c = pullRequests[2].version) === null || _c === void 0 ? void 0 : _c.toString()).to.eql('8.9.0');
            (0, chai_1.expect)((_d = pullRequests[3].version) === null || _d === void 0 ? void 0 : _d.toString()).to.eql('9.0.1');
            sinon.assert.called(getFileContentsOnBranchStub);
            sinon.assert.called(addIssueLabelsStub);
            sinon.assert.called(findFilesByFilenameAndRefStub);
            (0, chai_1.expect)(commentCount).to.eql(4);
        });
        (0, mocha_1.it)('should always use PR title version when labelled as custom version', async () => {
            var _a, _b;
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 123456,
                    sha: 'abc123',
                    tagName: 'pkg1-v1.0.0',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg1-v1.0.0',
                },
                {
                    id: 654321,
                    sha: 'def234',
                    tagName: 'pkg2-v0.2.3',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg2-v1.0.0',
                },
            ]);
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'aaaaaa',
                    message: 'fix: some bugfix',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'abc123',
                    message: 'chore: release 1.0.0',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please--branches--main--changes--next--components--pkg1',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release 1.0.0',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'abc123',
                    },
                },
                {
                    sha: 'bbbbbb',
                    message: 'fix: some bugfix',
                    files: ['path/b/foo'],
                },
                {
                    sha: 'cccccc',
                    message: 'fix: some bugfix',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'def234',
                    message: 'chore: release 0.2.3',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please--branches--main--changes--next--components--pkg2',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release 0.2.3',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'def234',
                    },
                },
            ]);
            const config = {
                'separate-pull-requests': true,
                packages: {
                    'path/a': {
                        'release-type': 'simple',
                        component: 'pkg1',
                    },
                    'path/b': {
                        'release-type': 'simple',
                        component: 'pkg2',
                    },
                },
            };
            const getFileContentsOnBranchStub = sandbox
                .stub(github, 'getFileContentsOnBranch')
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify(config)))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({
                'path/a': '1.0.0',
                'path/b': '0.2.3',
            })));
            const manifest = await manifest_1.Manifest.fromManifest(github, 'main', undefined, undefined, { changesBranch: 'next' });
            const pullRequests = await manifest.buildPullRequests([
                {
                    title: 'chore(main): release v4.5.6-beta.1',
                    body: 'some content',
                    headBranchName: 'release-please--branches--main--changes--next--components--pkg2',
                    baseBranchName: 'main',
                    number: 123,
                    labels: [manifest_1.DEFAULT_CUSTOM_VERSION_LABEL], // labeled as custom version, no need to fetch manifest from release branch
                    files: [],
                },
            ], []);
            (0, chai_1.expect)(pullRequests).lengthOf(2);
            (0, chai_1.expect)((_a = pullRequests[0].version) === null || _a === void 0 ? void 0 : _a.toString()).to.eql('1.0.1');
            (0, chai_1.expect)((_b = pullRequests[1].version) === null || _b === void 0 ? void 0 : _b.toString()).to.eql('4.5.6-beta.1');
            sinon.assert.called(getFileContentsOnBranchStub);
        });
        (0, mocha_1.it)('should report issue via PR comment if labeled as custom version but version not found in title', async () => {
            var _a, _b;
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 123456,
                    sha: 'abc123',
                    tagName: 'pkg1-v1.0.0',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg1-v1.0.0',
                },
                {
                    id: 654321,
                    sha: 'def234',
                    tagName: 'pkg2-v0.2.3',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg2-v1.0.0',
                },
            ]);
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'aaaaaa',
                    message: 'fix: some bugfix',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'abc123',
                    message: 'chore: release 1.0.0',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please--branches--main--changes--next--components--pkg1',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release 1.0.0',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'abc123',
                    },
                },
                {
                    sha: 'bbbbbb',
                    message: 'fix: some bugfix',
                    files: ['path/b/foo'],
                },
                {
                    sha: 'cccccc',
                    message: 'fix: some bugfix',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'def234',
                    message: 'chore: release 0.2.3',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please--branches--main--changes--next--components--pkg2',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release 0.2.3',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'def234',
                    },
                },
            ]);
            const config = {
                'separate-pull-requests': true,
                packages: {
                    'path/a': {
                        'release-type': 'simple',
                        component: 'pkg1',
                    },
                    'path/b': {
                        'release-type': 'simple',
                        component: 'pkg2',
                    },
                },
            };
            const getFileContentsOnBranchStub = sandbox
                .stub(github, 'getFileContentsOnBranch')
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify(config)))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({
                'path/a': '1.0.0',
                'path/b': '0.2.3',
            })));
            let commented = false;
            sandbox.replace(github, 'commentOnIssue', (comment, number) => {
                snapshot(comment);
                (0, chai_1.expect)(number).to.eql(123);
                commented = true;
                return Promise.resolve('https://foo/bar');
            });
            const manifest = await manifest_1.Manifest.fromManifest(github, 'main', undefined, undefined, { changesBranch: 'next' });
            const pullRequests = await manifest.buildPullRequests([
                {
                    // title edited by end user, version not valid anymore
                    title: 'chore(main): release vCHANGED_TO_SOMETHING_WITHOUT_VERSION',
                    body: 'some content',
                    headBranchName: 'release-please--branches--main--changes--next--components--pkg2',
                    baseBranchName: 'main',
                    number: 123,
                    labels: [manifest_1.DEFAULT_CUSTOM_VERSION_LABEL],
                    files: [],
                },
            ], []);
            (0, chai_1.expect)(pullRequests).lengthOf(2);
            (0, chai_1.expect)((_a = pullRequests[0].version) === null || _a === void 0 ? void 0 : _a.toString()).to.eql('1.0.1');
            (0, chai_1.expect)((_b = pullRequests[1].version) === null || _b === void 0 ? void 0 : _b.toString()).to.eql('0.2.4'); // should not use version from title
            (0, chai_1.expect)(commented).to.be.true;
            sinon.assert.called(getFileContentsOnBranchStub);
        });
        (0, mocha_1.it)('should warn end user via PR comment if version not found in title and not labeled as custom version', async () => {
            var _a, _b;
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 123456,
                    sha: 'abc123',
                    tagName: 'pkg1-v1.0.0',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg1-v1.0.0',
                },
                {
                    id: 654321,
                    sha: 'def234',
                    tagName: 'pkg2-v0.2.3',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg2-v1.0.0',
                },
            ]);
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'aaaaaa',
                    message: 'fix: some bugfix',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'abc123',
                    message: 'chore: release 1.0.0',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please--branches--main--changes--next--components--pkg1',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release 1.0.0',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'abc123',
                    },
                },
                {
                    sha: 'bbbbbb',
                    message: 'fix: some bugfix',
                    files: ['path/b/foo'],
                },
                {
                    sha: 'cccccc',
                    message: 'fix: some bugfix',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'def234',
                    message: 'chore: release 0.2.3',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please--branches--main--changes--next--components--pkg2',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release 0.2.3',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'def234',
                    },
                },
            ]);
            const config = {
                'separate-pull-requests': true,
                packages: {
                    'path/a': {
                        'release-type': 'simple',
                        component: 'pkg1',
                    },
                    'path/b': {
                        'release-type': 'simple',
                        component: 'pkg2',
                    },
                },
            };
            const getFileContentsOnBranchStub = sandbox
                .stub(github, 'getFileContentsOnBranch')
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify(config)))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({
                'path/a': '1.0.0',
                'path/b': '0.2.3',
            })));
            let commented = false;
            sandbox.replace(github, 'commentOnIssue', (comment, number) => {
                snapshot(comment);
                (0, chai_1.expect)(number).to.eql(123);
                commented = true;
                return Promise.resolve('https://foo/bar');
            });
            const manifest = await manifest_1.Manifest.fromManifest(github, 'main', undefined, undefined, { changesBranch: 'next' });
            const pullRequests = await manifest.buildPullRequests([
                {
                    // title edited by end user, version not valid anymore
                    title: 'chore(main): release vCHANGED_TO_SOMETHING_WITHOUT_VERSION',
                    body: 'some content',
                    headBranchName: 'release-please--branches--main--changes--next--components--pkg2',
                    baseBranchName: 'main',
                    number: 123,
                    labels: [], // no custom version label
                    files: [],
                },
            ], []);
            (0, chai_1.expect)(pullRequests).lengthOf(2);
            (0, chai_1.expect)((_a = pullRequests[0].version) === null || _a === void 0 ? void 0 : _a.toString()).to.eql('1.0.1');
            (0, chai_1.expect)((_b = pullRequests[1].version) === null || _b === void 0 ? void 0 : _b.toString()).to.eql('0.2.4'); // should not use version from title
            (0, chai_1.expect)(commented).to.be.true;
            sinon.assert.called(getFileContentsOnBranchStub);
        });
        (0, mocha_1.it)('should allow specifying a bootstrap sha', async () => {
            var _a;
            (0, helpers_1.mockReleases)(sandbox, github, []);
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'aaaaaa',
                    message: 'fix: some bugfix 1',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'bbbbbb',
                    message: 'fix: some bugfix 2',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'cccccc',
                    message: 'fix: some bugfix',
                    files: ['path/b/foo'],
                },
                {
                    sha: 'dddddd',
                    message: 'fix: some bugfix',
                    files: ['path/b/foo'],
                },
            ]);
            (0, helpers_1.mockTags)(sandbox, github, []);
            const config = {
                'bootstrap-sha': 'cccccc',
                'separate-pull-requests': true,
                packages: {
                    'path/a': {
                        'release-type': 'simple',
                        component: 'pkg1',
                    },
                    'path/b': {
                        'release-type': 'simple',
                        component: 'pkg2',
                    },
                },
            };
            const versions = {
                'path/a': '0.0.0',
                'path/b': '0.0.0',
            };
            sandbox
                .stub(github, 'getFileContentsOnBranch')
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify(config)))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify(versions)));
            const manifest = await manifest_1.Manifest.fromManifest(github, 'main', undefined, undefined, { changesBranch: 'next' });
            const pullRequests = await manifest.buildPullRequests([], []);
            (0, chai_1.expect)(pullRequests).lengthOf(1);
            (0, chai_1.expect)((_a = pullRequests[0].version) === null || _a === void 0 ? void 0 : _a.toString()).to.eql('0.0.1');
        });
        (0, mocha_1.it)('should allow specifying a last release sha', async () => {
            var _a;
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 123456,
                    sha: 'abc123',
                    tagName: 'pkg1-v1.0.0',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg1-v1.0.0',
                },
                {
                    id: 654321,
                    sha: 'def234',
                    tagName: 'pkg2-v0.2.3',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg2-v1.0.0',
                },
            ]);
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'aaaaaa',
                    message: 'fix: some bugfix',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'abc123',
                    message: 'chore: release 1.0.0',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main/components/pkg1',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release 1.0.0',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'abc123',
                    },
                },
                {
                    sha: 'bbbbbb',
                    message: 'fix: some bugfix',
                    files: ['path/b/foo'],
                },
                {
                    sha: 'cccccc',
                    message: 'fix: some bugfix',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'def234',
                    message: 'chore: release 0.2.3',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main/components/pkg2',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release 0.2.3',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'def234',
                    },
                },
            ]);
            (0, helpers_1.mockTags)(sandbox, github, []);
            const config = {
                'last-release-sha': 'bbbbbb',
                'separate-pull-requests': true,
                packages: {
                    'path/a': {
                        'release-type': 'simple',
                        component: 'pkg1',
                    },
                    'path/b': {
                        'release-type': 'simple',
                        component: 'pkg2',
                    },
                },
            };
            const versions = {
                'path/a': '0.0.0',
                'path/b': '0.0.0',
            };
            sandbox
                .stub(github, 'getFileContentsOnBranch')
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify(config)))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify(versions)));
            const manifest = await manifest_1.Manifest.fromManifest(github, 'main', undefined, undefined, { changesBranch: 'next' });
            const pullRequests = await manifest.buildPullRequests([], []);
            (0, chai_1.expect)(pullRequests).lengthOf(1);
            (0, chai_1.expect)((_a = pullRequests[0].version) === null || _a === void 0 ? void 0 : _a.toString()).to.eql('0.0.1');
        });
        (0, mocha_1.it)('should allow customizing pull request title with root package', async () => {
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 1,
                    sha: 'abc123',
                    tagName: 'pkg1-v1.0.0',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg1-v1.0.0',
                },
                {
                    id: 2,
                    sha: 'abc123',
                    tagName: 'root-v1.2.0',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/root-v1.2.0',
                },
                {
                    id: 3,
                    sha: 'def234',
                    tagName: 'pkg1-v1.0.1',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg1-v1.0.1',
                },
                {
                    id: 4,
                    sha: 'def234',
                    tagName: 'pkg2-v0.2.3',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg2-v0.2.3',
                },
                {
                    id: 5,
                    sha: 'def234',
                    tagName: 'root-v1.2.1',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/root-v1.2.1',
                },
            ]);
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'aaaaaa',
                    message: 'fix: some bugfix',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'abc123',
                    message: 'chore: release main',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release v1.2.0',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'abc123',
                    },
                },
                {
                    sha: 'bbbbbb',
                    message: 'fix: some bugfix',
                    files: ['path/b/foo'],
                },
                {
                    sha: 'cccccc',
                    message: 'fix: some bugfix',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'def234',
                    message: 'chore: release v1.2.1',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release v1.2.1',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'def234',
                    },
                },
            ]);
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'simple',
                    component: 'root',
                },
                'path/a': {
                    releaseType: 'simple',
                    component: 'pkg1',
                },
                'path/b': {
                    releaseType: 'simple',
                    component: 'pkg2',
                },
            }, {
                '.': version_1.Version.parse('1.2.1'),
                'path/a': version_1.Version.parse('1.0.1'),
                'path/b': version_1.Version.parse('0.2.3'),
            }, {
                groupPullRequestTitlePattern: 'chore${scope}: release${component} v${version}',
            });
            const pullRequests = await manifest.buildPullRequests([], []);
            (0, chai_1.expect)(pullRequests).lengthOf(1);
            const pullRequest = pullRequests[0];
            (0, chai_1.expect)(pullRequest.title.toString()).to.eql('chore(main): release root v1.2.2');
            snapshot((0, helpers_1.dateSafe)(pullRequest.body.toString()));
        });
        (0, mocha_1.it)('should allow customizing pull request title without root package', async () => {
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 1,
                    sha: 'abc123',
                    tagName: 'pkg1-v1.0.0',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg1-v1.0.0',
                },
                {
                    id: 2,
                    sha: 'def234',
                    tagName: 'pkg1-v1.0.1',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg1-v1.0.1',
                },
                {
                    id: 3,
                    sha: 'def234',
                    tagName: 'pkg2-v0.2.3',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg2-v0.2.3',
                },
            ]);
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'aaaaaa',
                    message: 'fix: some bugfix',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'abc123',
                    message: 'chore: release main',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release v1.2.0',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'abc123',
                    },
                },
                {
                    sha: 'bbbbbb',
                    message: 'fix: some bugfix',
                    files: ['path/b/foo'],
                },
                {
                    sha: 'cccccc',
                    message: 'fix: some bugfix',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'def234',
                    message: 'chore: release v1.2.1',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release v1.2.1',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'def234',
                    },
                },
            ]);
            const manifest = new manifest_1.Manifest(github, 'main', {
                'path/a': {
                    releaseType: 'simple',
                    component: 'pkg1',
                },
                'path/b': {
                    releaseType: 'simple',
                    component: 'pkg2',
                },
            }, {
                'path/a': version_1.Version.parse('1.0.1'),
                'path/b': version_1.Version.parse('0.2.3'),
            }, {
                groupPullRequestTitlePattern: 'chore${scope}: release${component} v${version}',
            });
            const pullRequests = await manifest.buildPullRequests([], []);
            (0, chai_1.expect)(pullRequests).lengthOf(1);
            (0, chai_1.expect)(pullRequests[0].title.toString()).to.eql('chore(main): release v');
        });
        (0, mocha_1.it)('should read latest version from manifest if no release tag found', async () => {
            var _a, _b;
            (0, helpers_1.mockReleases)(sandbox, github, []);
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'aaaaaa',
                    message: 'fix: some bugfix',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'bbb',
                    message: 'fix: some bugfix',
                    files: ['path/b/foo'],
                },
                {
                    sha: 'commit1',
                    message: 'release: 1.2.3',
                    files: ['path/a/foo'],
                    pullRequest: {
                        headBranchName: 'release-please--branches--main--changes--next--components--pkg1',
                        baseBranchName: 'main',
                        number: 111,
                        title: 'release: 1.2.3',
                        body: '',
                        labels: ['tagged'],
                        files: ['path/a/foo'],
                        sha: 'commit1',
                    },
                },
                // should be included in pkg1 new release, commits created after v1.2.3
                ...Array.from({ length: 100 }, (_, i) => ({
                    sha: `ccc${i}`,
                    message: `fix: some fix ${i}`,
                    files: ['path/a/foo'],
                })),
                {
                    sha: 'commit2',
                    message: 'release: 2.3.4',
                    files: ['path/b/package.json'],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main/changes/next/components/pkg2',
                        baseBranchName: 'main',
                        number: 222,
                        title: 'release: 2.3.4',
                        body: '',
                        labels: ['tagged'],
                        files: ['path/b/foo'],
                        sha: 'commit2',
                    },
                    // should not be included in pgk2 new release, commits created before v2.3.4
                    ...Array.from({ length: 100 }, (_, i) => ({
                        sha: `ddd${i}`,
                        message: `fix: some fix ${i}`,
                        files: ['path/b/foo'],
                    })),
                },
            ]);
            (0, helpers_1.mockTags)(sandbox, github, []);
            const config = {
                packages: {
                    'path/a': {
                        'release-type': 'simple',
                        component: 'pkg1',
                    },
                    'path/b': {
                        'release-type': 'node',
                        component: 'pkg2',
                    },
                },
            };
            const versions = {
                'path/a': '1.2.3',
                'path/b': '2.3.4',
            };
            sandbox
                .stub(github, 'getFileContentsOnBranch')
                .withArgs('release-please-config.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify(config)))
                .withArgs('.release-please-manifest.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify(versions)))
                .withArgs('path/b/package.json', 'next')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: 'b', version: '2.3.4' })));
            const manifest = await manifest_1.Manifest.fromManifest(github, 'main', undefined, undefined, { changesBranch: 'next', separatePullRequests: true });
            const pullRequests = await manifest.buildPullRequests([], []);
            (0, chai_1.expect)(pullRequests).lengthOf(2);
            (0, chai_1.expect)(pullRequests[0].body.releaseData).lengthOf(1);
            (0, chai_1.expect)(pullRequests[0].conventionalCommits).lengthOf(102);
            (0, chai_1.expect)(pullRequests[0].body.releaseData[0].component).to.eql('pkg1');
            (0, chai_1.expect)((_a = pullRequests[0].body.releaseData[0].version) === null || _a === void 0 ? void 0 : _a.toString()).to.eql('1.2.4');
            (0, chai_1.expect)(pullRequests[1].body.releaseData).lengthOf(1);
            (0, chai_1.expect)(pullRequests[1].conventionalCommits).lengthOf(2);
            (0, chai_1.expect)(pullRequests[1].body.releaseData[0].component).to.eql('pkg2');
            (0, chai_1.expect)((_b = pullRequests[1].body.releaseData[0].version) === null || _b === void 0 ? void 0 : _b.toString()).to.eql('2.3.5');
        });
        (0, mocha_1.it)('should use latest version from tag if github releases not found but tag found', async () => {
            var _a, _b;
            (0, helpers_1.mockReleases)(sandbox, github, []);
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'aaaaaa',
                    message: 'fix: some bugfix',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'bbb',
                    message: 'fix: some bugfix',
                    files: ['path/b/foo'],
                },
                {
                    sha: 'commit1',
                    message: 'release: 1.2.3',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'commit2',
                    message: 'release: 2.3.4',
                    files: ['path/b/package.json'],
                },
                {
                    sha: 'ccc',
                    message: 'chore: some chore',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'ddd',
                    message: 'chore: some chore',
                    files: ['path/b/foo'],
                },
            ]);
            (0, helpers_1.mockTags)(sandbox, github, [
                { name: 'pkg1-v1.2.3', sha: 'commit1' },
                { name: 'pkg2-v2.3.4', sha: 'commit2' },
            ]);
            const config = {
                packages: {
                    'path/a': {
                        'release-type': 'simple',
                        component: 'pkg1',
                    },
                    'path/b': {
                        'release-type': 'node',
                        component: 'pkg2',
                    },
                },
            };
            const versions = {
                'path/a': '1.2.3',
                'path/b': '2.3.4',
            };
            const getFileContentsOnBranchStub = sandbox
                .stub(github, 'getFileContentsOnBranch')
                .withArgs('release-please-config.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify(config)))
                .withArgs('.release-please-manifest.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify(versions)))
                .withArgs('path/b/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: 'b', version: '2.3.4' })));
            const manifest = await manifest_1.Manifest.fromManifest(github, 'main');
            const pullRequests = await manifest.buildPullRequests([], []);
            (0, chai_1.expect)(pullRequests).lengthOf(1);
            (0, chai_1.expect)(pullRequests[0].body.releaseData).lengthOf(2);
            (0, chai_1.expect)(pullRequests[0].body.releaseData[0].component).to.eql('pkg1');
            (0, chai_1.expect)((_a = pullRequests[0].body.releaseData[0].version) === null || _a === void 0 ? void 0 : _a.toString()).to.eql('1.2.4');
            (0, chai_1.expect)(pullRequests[0].body.releaseData[1].component).to.eql('pkg2');
            (0, chai_1.expect)((_b = pullRequests[0].body.releaseData[1].version) === null || _b === void 0 ? void 0 : _b.toString()).to.eql('2.3.5');
            sinon.assert.calledOnce(getFileContentsOnBranchStub);
        });
        (0, mocha_1.it)('should not update manifest if unpublished version is created', async () => {
            var _a, _b;
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 123456,
                    tagName: 'v1.2.3',
                    sha: 'def234',
                    url: 'http://path/to/release',
                },
            ]);
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'abc123',
                    message: 'some commit message',
                    files: [],
                    pullRequest: {
                        title: 'chore: release 1.2.3',
                        headBranchName: 'release-please/branches/main',
                        baseBranchName: 'main',
                        number: 123,
                        body: '',
                        labels: [],
                        files: [],
                    },
                },
            ]);
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'java',
                },
            }, {
                '.': version_1.Version.parse('1.2.3'),
            });
            const pullRequests = await manifest.buildPullRequests([], []);
            (0, chai_1.expect)(pullRequests).lengthOf(1);
            const pullRequest = pullRequests[0];
            (0, chai_1.expect)((_a = pullRequest.version) === null || _a === void 0 ? void 0 : _a.toString()).to.eql('1.2.4-SNAPSHOT');
            (0, chai_1.expect)((_b = pullRequest.previousVersion) === null || _b === void 0 ? void 0 : _b.toString()).to.eql('1.2.3');
            (0, chai_1.expect)(pullRequest.version.compareBump(pullRequest.previousVersion)).to.eql('patch');
            // simple release type updates the changelog and version.txt
            (0, helpers_1.assertNoHasUpdate)(pullRequest.updates, 'CHANGELOG.md');
            (0, helpers_1.assertNoHasUpdate)(pullRequest.updates, '.release-please-manifest.json');
            (0, chai_1.expect)(pullRequest.headRefName).to.eql('release-please--branches--main');
        });
        (0, mocha_1.describe)('without commits', () => {
            (0, mocha_1.beforeEach)(() => {
                (0, helpers_1.mockReleases)(sandbox, github, [
                    {
                        id: 123456,
                        sha: 'abc123',
                        tagName: 'v1.0.0',
                        url: 'https://github.com/fake-owner/fake-repo/releases/tag/v1.0.0',
                    },
                ]);
                (0, helpers_1.mockCommits)(sandbox, github, []);
            });
            (0, mocha_1.it)('should ignore by default', async () => {
                const manifest = new manifest_1.Manifest(github, 'main', {
                    '.': {
                        releaseType: 'simple',
                    },
                }, {
                    '.': version_1.Version.parse('1.0.0'),
                });
                const pullRequests = await manifest.buildPullRequests([], []);
                (0, chai_1.expect)(pullRequests).lengthOf(0);
            });
            (0, mocha_1.it)('should delegate to strategies', async () => {
                var _a, _b;
                const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
                getFileContentsStub
                    .withArgs('versions.txt', 'main')
                    .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'strategies/java-yoshi/versions-released.txt'));
                sandbox.stub(github, 'findFilesByFilenameAndRef').resolves([]);
                const manifest = new manifest_1.Manifest(github, 'main', {
                    '.': {
                        releaseType: 'java-yoshi',
                    },
                }, {
                    '.': version_1.Version.parse('1.0.0'),
                });
                const pullRequests = await manifest.buildPullRequests([], []);
                (0, chai_1.expect)(pullRequests).lengthOf(1);
                const pullRequest = pullRequests[0];
                (0, chai_1.expect)((_a = pullRequest.version) === null || _a === void 0 ? void 0 : _a.toString()).to.eql('1.0.1-SNAPSHOT');
                (0, chai_1.expect)((_b = pullRequest.previousVersion) === null || _b === void 0 ? void 0 : _b.toString()).to.eql('1.0.0');
                (0, chai_1.expect)(pullRequest.version.compareBump(pullRequest.previousVersion)).to.eql('patch');
                (0, chai_1.expect)(pullRequest.headRefName).to.eql('release-please--branches--main');
            });
        });
        (0, mocha_1.it)('should handle extra files', async () => {
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 123456,
                    sha: 'commit1',
                    tagName: 'a-v1.1.0',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/a-v1.1.0',
                },
                {
                    id: 123456,
                    sha: 'commit2',
                    tagName: 'b-v1.0.0',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/b-v1.0.0',
                },
                {
                    id: 123456,
                    sha: 'commit3',
                    tagName: 'c-v1.0.1',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/c-v1.0.1',
                },
            ]);
            (0, helpers_1.mockTags)(sandbox, github, [
                {
                    name: 'a-v1.1.0',
                    sha: 'commit1',
                },
                {
                    name: 'b-v1.0.0',
                    sha: 'commit2',
                },
                {
                    name: 'c-v1.0.1',
                    sha: 'commit3',
                },
            ]);
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'aaaaaa',
                    message: 'fix: a bugfix',
                    files: ['foo', 'pkg.properties'],
                },
                {
                    sha: 'bbbbbb',
                    message: 'fix: b bugfix',
                    files: ['pkg/b/foo'],
                },
                {
                    sha: 'cccccc',
                    message: 'fix: c bugfix',
                    files: ['pkg/c/foo'],
                },
            ]);
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'simple',
                    component: 'a',
                    extraFiles: ['root.properties'],
                },
                'pkg/b': {
                    releaseType: 'simple',
                    component: 'b',
                    extraFiles: ['pkg.properties', 'src/version', '/bbb.properties'],
                    skipGithubRelease: true,
                },
                'pkg/c': {
                    releaseType: 'simple',
                    component: 'c',
                    extraFiles: ['/pkg/pkg-c.properties', 'ccc.properties'],
                    skipGithubRelease: true,
                },
            }, {
                '.': version_1.Version.parse('1.1.0'),
                'pkg/b': version_1.Version.parse('1.0.0'),
                'pkg/c': version_1.Version.parse('1.0.1'),
            });
            const pullRequests = await manifest.buildPullRequests([], []);
            (0, chai_1.expect)(pullRequests).lengthOf(1);
            (0, chai_1.expect)(pullRequests[0].updates).to.be.an('array');
            (0, chai_1.expect)(pullRequests[0].updates.map(update => update.path))
                .to.include.members([
                'root.properties',
                'bbb.properties',
                'pkg/pkg-c.properties',
                'pkg/b/pkg.properties',
                'pkg/b/src/version',
                'pkg/c/ccc.properties',
            ])
                .but.not.include.oneOf([
                'pkg/b/bbb.properties', // should be at root
                'pkg/c/pkg-c.properties', // should be up one level
            ]);
        });
        (0, mocha_1.it)('should allow overriding commit message', async () => {
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 123456,
                    sha: 'abc123',
                    tagName: 'v1.0.0',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/v1.0.0',
                },
            ]);
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'def456',
                    message: 'fix: some bugfix',
                    files: [],
                    pullRequest: {
                        headBranchName: 'fix-1',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'fix: some bugfix',
                        body: 'BEGIN_COMMIT_OVERRIDE\nfix: real fix message\nEND_COMMIT_OVERRIDE',
                        labels: [],
                        files: [],
                        sha: 'abc123',
                    },
                },
                {
                    sha: 'abc123',
                    message: 'chore: release 1.0.0',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release 1.0.0',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'abc123',
                    },
                },
            ]);
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'simple',
                },
            }, {
                '.': version_1.Version.parse('1.0.0'),
            }, {
                draftPullRequest: true,
            });
            const pullRequests = await manifest.buildPullRequests([], []);
            (0, chai_1.expect)(pullRequests).lengthOf(1);
            const pullRequest = pullRequests[0];
            (0, helpers_1.safeSnapshot)(pullRequest.body.toString());
        });
        (0, mocha_1.describe)('with plugins', () => {
            (0, mocha_1.beforeEach)(() => {
                (0, helpers_1.mockReleases)(sandbox, github, [
                    {
                        id: 123456,
                        sha: 'abc123',
                        tagName: 'pkg1-v1.0.0',
                        url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg1-v1.0.0',
                    },
                    {
                        id: 654321,
                        sha: 'def234',
                        tagName: 'pkg2-v0.2.3',
                        url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg2-v1.0.0',
                    },
                ]);
                (0, helpers_1.mockCommits)(sandbox, github, [
                    {
                        sha: 'aaaaaa',
                        message: 'fix: some bugfix\nfix:another fix',
                        files: ['path/a/foo'],
                    },
                    {
                        sha: 'abc123',
                        message: 'chore: release 1.0.0',
                        files: [],
                        pullRequest: {
                            headBranchName: 'release-please/branches/main/components/pkg1',
                            baseBranchName: 'main',
                            number: 123,
                            title: 'chore: release 1.0.0',
                            body: '',
                            labels: [],
                            files: [],
                            sha: 'abc123',
                        },
                    },
                    {
                        sha: 'bbbbbb',
                        message: 'fix: some bugfix',
                        files: ['path/b/foo'],
                    },
                    {
                        sha: 'cccccc',
                        message: 'fix: some bugfix',
                        files: ['path/a/foo'],
                    },
                    {
                        sha: 'def234',
                        message: 'chore: release 0.2.3',
                        files: [],
                        pullRequest: {
                            headBranchName: 'release-please/branches/main/components/pkg2',
                            baseBranchName: 'main',
                            number: 123,
                            title: 'chore: release 0.2.3',
                            body: '',
                            labels: [],
                            files: [],
                            sha: 'def234',
                        },
                    },
                ]);
            });
            (0, mocha_1.it)('should load and run a single plugins', async () => {
                const mockPlugin = sandbox.createStubInstance(node_workspace_1.NodeWorkspace);
                mockPlugin.run.returnsArg(0);
                mockPlugin.preconfigure.returnsArg(0);
                mockPlugin.processCommits.returnsArg(0);
                const pluginFactory = require('../src/factories/plugin-factory');
                const buildPluginStub = sandbox
                    .stub(pluginFactory, 'buildPlugin')
                    .withArgs(sinon.match.has('type', 'node-workspace'))
                    .returns(mockPlugin);
                const manifest = new manifest_1.Manifest(github, 'main', {
                    'path/a': {
                        releaseType: 'node',
                        component: 'pkg1',
                        packageName: 'pkg1',
                    },
                    'path/b': {
                        releaseType: 'node',
                        component: 'pkg2',
                        packageName: 'pkg2',
                    },
                }, {
                    'path/a': version_1.Version.parse('1.0.0'),
                    'path/b': version_1.Version.parse('0.2.3'),
                }, {
                    separatePullRequests: true,
                    plugins: ['node-workspace'],
                });
                const pullRequests = await manifest.buildPullRequests([], []);
                (0, chai_1.expect)(pullRequests).not.empty;
                sinon.assert.calledOnce(mockPlugin.run);
                sinon.assert.calledOnce(buildPluginStub);
            });
            (0, mocha_1.it)('should load and run multiple plugins', async () => {
                const mockPlugin = sandbox.createStubInstance(node_workspace_1.NodeWorkspace);
                mockPlugin.run.returnsArg(0);
                mockPlugin.preconfigure.returnsArg(0);
                mockPlugin.processCommits.returnsArg(0);
                const mockPlugin2 = sandbox.createStubInstance(cargo_workspace_1.CargoWorkspace);
                mockPlugin2.run.returnsArg(0);
                mockPlugin2.preconfigure.returnsArg(0);
                mockPlugin2.processCommits.returnsArg(0);
                sandbox
                    .stub(pluginFactory, 'buildPlugin')
                    .withArgs(sinon.match.has('type', 'node-workspace'))
                    .returns(mockPlugin)
                    .withArgs(sinon.match.has('type', 'cargo-workspace'))
                    .returns(mockPlugin2);
                const manifest = new manifest_1.Manifest(github, 'main', {
                    'path/a': {
                        releaseType: 'node',
                        component: 'pkg1',
                        packageName: '@foo/pkg1',
                    },
                    'path/b': {
                        releaseType: 'node',
                        component: 'pkg2',
                        packageName: '@foo/pkg2',
                    },
                }, {
                    'path/a': version_1.Version.parse('1.0.0'),
                    'path/b': version_1.Version.parse('0.2.3'),
                }, {
                    separatePullRequests: true,
                    plugins: ['node-workspace', 'cargo-workspace'],
                });
                const pullRequests = await manifest.buildPullRequests([], []);
                (0, chai_1.expect)(pullRequests).not.empty;
                sinon.assert.calledOnce(mockPlugin.run);
                sinon.assert.calledOnce(mockPlugin2.run);
            });
            (0, mocha_1.it)('should apply plugin hook "processCommits"', async () => {
                const spyPlugin = sinon.spy(new sentence_case_1.SentenceCase(github, 'main', manifest_1.DEFAULT_RELEASE_PLEASE_MANIFEST, {}));
                sandbox
                    .stub(pluginFactory, 'buildPlugin')
                    .withArgs(sinon.match.has('type', 'sentence-case'))
                    // TS compiler is having issues with sinon.spy.
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .returns(spyPlugin);
                const manifest = new manifest_1.Manifest(github, 'main', {
                    'path/a': {
                        releaseType: 'node',
                        component: 'pkg1',
                        packageName: 'pkg1',
                    },
                }, {
                    'path/a': version_1.Version.parse('1.0.0'),
                }, {
                    plugins: ['sentence-case'],
                });
                const pullRequests = await manifest.buildPullRequests([], []);
                (0, chai_1.expect)(pullRequests).not.empty;
                // This assertion verifies that conventional commit parsing
                // was applied before calling the processCommits plugin hook:
                sinon.assert.calledWith(spyPlugin.processCommits, [
                    {
                        sha: 'aaaaaa',
                        message: 'fix: Another fix',
                        files: ['path/a/foo'],
                        pullRequest: undefined,
                        type: 'fix',
                        scope: null,
                        bareMessage: 'Another fix',
                        notes: [],
                        references: [],
                        breaking: false,
                    },
                    {
                        sha: 'aaaaaa',
                        message: 'fix: Some bugfix',
                        files: ['path/a/foo'],
                        pullRequest: undefined,
                        type: 'fix',
                        scope: null,
                        bareMessage: 'Some bugfix',
                        notes: [],
                        references: [],
                        breaking: false,
                    },
                ]);
            });
        });
        (0, mocha_1.it)('should fallback to tagged version', async () => {
            var _a, _b;
            (0, helpers_1.mockReleases)(sandbox, github, []);
            (0, helpers_1.mockTags)(sandbox, github, [
                {
                    name: 'pkg1-v1.0.0',
                    sha: 'abc123',
                },
            ]);
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'def456',
                    message: 'fix: some bugfix',
                    files: [],
                },
                {
                    sha: 'abc123',
                    message: 'chore: release 1.0.0',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main/components/pkg1',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release 1.0.0',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'abc123',
                    },
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/repo/node/pkg1/package.json'));
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'node',
                },
            }, {
                '.': version_1.Version.parse('1.0.0'),
            });
            const pullRequests = await manifest.buildPullRequests([], []);
            (0, chai_1.expect)(pullRequests).lengthOf(1);
            const pullRequest = pullRequests[0];
            (0, chai_1.expect)((_a = pullRequest.version) === null || _a === void 0 ? void 0 : _a.toString()).to.eql('1.0.1');
            (0, chai_1.expect)((_b = pullRequest.previousVersion) === null || _b === void 0 ? void 0 : _b.toString()).to.eql('1.0.0');
            (0, chai_1.expect)(pullRequest.version.compareBump(pullRequest.previousVersion)).to.eql('patch');
            (0, chai_1.expect)(pullRequest.headRefName).to.eql('release-please--branches--main--components--pkg1');
        });
        (0, mocha_1.it)('should handle mixing componentless configs', async () => {
            (0, helpers_1.mockReleases)(sandbox, github, [
                {
                    id: 123456,
                    sha: 'abc123',
                    tagName: 'v1.0.0',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/v1.0.0',
                },
                {
                    id: 654321,
                    sha: 'def234',
                    tagName: 'pkg2-v0.2.3',
                    url: 'https://github.com/fake-owner/fake-repo/releases/tag/pkg2-v0.2.3',
                },
            ]);
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'aaaaaa',
                    message: 'fix: some bugfix',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'abc123',
                    message: 'chore: release main',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release main',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'abc123',
                    },
                },
                {
                    sha: 'bbbbbb',
                    message: 'fix: some bugfix',
                    files: ['path/b/foo'],
                },
                {
                    sha: 'cccccc',
                    message: 'fix: some bugfix',
                    files: ['path/a/foo'],
                },
                {
                    sha: 'def234',
                    message: 'chore: release main',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release main',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'def234',
                    },
                },
            ]);
            const manifest = new manifest_1.Manifest(github, 'main', {
                'path/a': {
                    releaseType: 'simple',
                    component: 'pkg1',
                    includeComponentInTag: false,
                },
                'path/b': {
                    releaseType: 'simple',
                    component: 'pkg2',
                },
            }, {
                'path/a': version_1.Version.parse('1.0.0'),
                'path/b': version_1.Version.parse('0.2.3'),
            });
            const pullRequests = await manifest.buildPullRequests([], []);
            (0, chai_1.expect)(pullRequests).lengthOf(1);
            (0, chai_1.expect)(pullRequests[0].labels).to.eql(['autorelease: pending']);
            snapshot((0, helpers_1.dateSafe)(pullRequests[0].body.toString()));
        });
        (0, mocha_1.it)('should allow customizing release-search-depth', async () => {
            var _a, _b;
            const releaseStub = (0, helpers_1.mockReleases)(sandbox, github, []);
            (0, helpers_1.mockTags)(sandbox, github, [
                {
                    name: 'pkg1-v1.0.0',
                    sha: 'abc123',
                },
            ]);
            (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'def456',
                    message: 'fix: some bugfix',
                    files: [],
                },
                {
                    sha: 'abc123',
                    message: 'chore: release 1.0.0',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main/components/pkg1',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release 1.0.0',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'abc123',
                    },
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/repo/node/pkg1/package.json'));
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'node',
                },
            }, {
                '.': version_1.Version.parse('1.0.0'),
            }, {
                releaseSearchDepth: 1,
            });
            (0, chai_1.expect)(manifest.releaseSearchDepth).to.eql(1);
            const pullRequests = await manifest.buildPullRequests([], []);
            (0, chai_1.expect)(pullRequests).lengthOf(1);
            const pullRequest = pullRequests[0];
            (0, chai_1.expect)((_a = pullRequest.version) === null || _a === void 0 ? void 0 : _a.toString()).to.eql('1.0.1');
            (0, chai_1.expect)((_b = pullRequest.previousVersion) === null || _b === void 0 ? void 0 : _b.toString()).to.eql('1.0.0');
            (0, chai_1.expect)(pullRequest.version.compareBump(pullRequest.previousVersion)).to.eql('patch');
            (0, chai_1.expect)(pullRequest.headRefName).to.eql('release-please--branches--main--components--pkg1');
            sinon.assert.calledOnceWithMatch(releaseStub, sinon.match.has('maxResults', 1));
        });
        (0, mocha_1.it)('should allow customizing commit-search-depth', async () => {
            var _a, _b;
            (0, helpers_1.mockReleases)(sandbox, github, []);
            (0, helpers_1.mockTags)(sandbox, github, [
                {
                    name: 'pkg1-v1.0.0',
                    sha: 'abc123',
                },
            ]);
            const commitsStub = (0, helpers_1.mockCommits)(sandbox, github, [
                {
                    sha: 'def456',
                    message: 'fix: some bugfix',
                    files: [],
                },
                {
                    sha: 'abc123',
                    message: 'chore: release 1.0.0',
                    files: [],
                    pullRequest: {
                        headBranchName: 'release-please/branches/main/components/pkg1',
                        baseBranchName: 'main',
                        number: 123,
                        title: 'chore: release 1.0.0',
                        body: '',
                        labels: [],
                        files: [],
                        sha: 'abc123',
                    },
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/repo/node/pkg1/package.json'));
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'node',
                },
            }, {
                '.': version_1.Version.parse('1.0.0'),
            }, {
                commitSearchDepth: 1,
            });
            (0, chai_1.expect)(manifest.commitSearchDepth).to.eql(1);
            const pullRequests = await manifest.buildPullRequests([], []);
            (0, chai_1.expect)(pullRequests).lengthOf(1);
            const pullRequest = pullRequests[0];
            (0, chai_1.expect)((_a = pullRequest.version) === null || _a === void 0 ? void 0 : _a.toString()).to.eql('1.0.1');
            (0, chai_1.expect)((_b = pullRequest.previousVersion) === null || _b === void 0 ? void 0 : _b.toString()).to.eql('1.0.0');
            (0, chai_1.expect)(pullRequest.version.compareBump(pullRequest.previousVersion)).to.eql('patch');
            (0, chai_1.expect)(pullRequest.headRefName).to.eql('release-please--branches--main--components--pkg1');
            sinon.assert.calledOnceWithMatch(commitsStub, 'main', sinon.match.has('maxResults', 1));
        });
        (0, mocha_1.describe)('with multiple components', () => {
            (0, mocha_1.beforeEach)(() => {
                (0, helpers_1.mockReleases)(sandbox, github, []);
                (0, helpers_1.mockTags)(sandbox, github, [
                    {
                        name: 'b-v1.0.0',
                        sha: 'abc123',
                    },
                    {
                        name: 'c-v2.0.0',
                        sha: 'abc123',
                    },
                    {
                        name: 'd-v3.0.0',
                        sha: 'abc123',
                    },
                    {
                        name: 'v3.0.0',
                        sha: 'abc123',
                    },
                ]);
                (0, helpers_1.mockCommits)(sandbox, github, [
                    {
                        sha: 'def456',
                        message: 'fix: some bugfix',
                        files: ['pkg/b/foo.txt', 'pkg/c/foo.txt', 'pkg/d/foo.txt'],
                    },
                    {
                        sha: 'abc123',
                        message: 'chore: release main',
                        files: [],
                        pullRequest: {
                            headBranchName: 'release-please/branches/main/components/pkg1',
                            baseBranchName: 'main',
                            number: 123,
                            title: 'chore: release main',
                            body: '',
                            labels: [],
                            files: [],
                            sha: 'abc123',
                        },
                    },
                ]);
                const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
                getFileContentsStub
                    .withArgs('package.json', 'main')
                    .resolves((0, helpers_1.buildGitHubFileContent)(fixturesPath, 'manifest/repo/node/pkg1/package.json'));
            });
            (0, mocha_1.it)('should allow configuring separate pull requests', async () => {
                const manifest = new manifest_1.Manifest(github, 'main', {
                    'pkg/b': {
                        releaseType: 'simple',
                        component: 'b',
                    },
                    'pkg/c': {
                        releaseType: 'simple',
                        component: 'c',
                    },
                    'pkg/d': {
                        releaseType: 'simple',
                        component: 'd',
                    },
                }, {
                    'pkg/b': version_1.Version.parse('1.0.0'),
                    'pkg/c': version_1.Version.parse('2.0.0'),
                    'pkg/d': version_1.Version.parse('3.0.0'),
                }, {
                    separatePullRequests: true,
                });
                const pullRequests = await manifest.buildPullRequests([], []);
                (0, chai_1.expect)(pullRequests).lengthOf(3);
                const pullRequestB = pullRequests[0];
                (0, chai_1.expect)(pullRequestB.headRefName).to.eql('release-please--branches--main--components--b');
                const pullRequestC = pullRequests[1];
                (0, chai_1.expect)(pullRequestC.headRefName).to.eql('release-please--branches--main--components--c');
                const pullRequestD = pullRequests[2];
                (0, chai_1.expect)(pullRequestD.headRefName).to.eql('release-please--branches--main--components--d');
            });
            (0, mocha_1.it)('should allow configuring individual separate pull requests', async () => {
                const manifest = new manifest_1.Manifest(github, 'main', {
                    'pkg/b': {
                        releaseType: 'simple',
                        component: 'b',
                    },
                    'pkg/c': {
                        releaseType: 'simple',
                        component: 'c',
                    },
                    'pkg/d': {
                        releaseType: 'simple',
                        component: 'd',
                        separatePullRequests: true,
                    },
                }, {
                    'pkg/b': version_1.Version.parse('1.0.0'),
                    'pkg/c': version_1.Version.parse('2.0.0'),
                    'pkg/d': version_1.Version.parse('3.0.0'),
                });
                const pullRequests = await manifest.buildPullRequests([], []);
                (0, chai_1.expect)(pullRequests).lengthOf(2);
                const pullRequest = pullRequests[0];
                (0, chai_1.expect)(pullRequest.headRefName).to.eql('release-please--branches--main');
                const mainPullRequest = pullRequests[1];
                (0, chai_1.expect)(mainPullRequest.headRefName).to.eql('release-please--branches--main--components--d');
            });
            (0, mocha_1.it)('should allow configuring individual separate pull requests with includeComponentInTag = false', async () => {
                const manifest = new manifest_1.Manifest(github, 'main', {
                    'pkg/b': {
                        releaseType: 'simple',
                        component: 'b',
                    },
                    'pkg/c': {
                        releaseType: 'simple',
                        component: 'c',
                    },
                    'pkg/d': {
                        releaseType: 'simple',
                        component: 'd',
                        separatePullRequests: true,
                        includeComponentInTag: false,
                    },
                }, {
                    'pkg/b': version_1.Version.parse('1.0.0'),
                    'pkg/c': version_1.Version.parse('2.0.0'),
                    'pkg/d': version_1.Version.parse('3.0.0'),
                });
                const pullRequests = await manifest.buildPullRequests([], []);
                (0, chai_1.expect)(pullRequests).lengthOf(2);
                const pullRequest = pullRequests[0];
                (0, chai_1.expect)(pullRequest.headRefName).to.eql('release-please--branches--main');
                const mainPullRequest = pullRequests[1];
                (0, chai_1.expect)(mainPullRequest.headRefName).to.eql('release-please--branches--main--components--d');
            });
        });
    });
    (0, mocha_1.describe)('createPullRequests', () => {
        (0, mocha_1.it)('handles no pull requests', async () => {
            const manifest = new manifest_1.Manifest(github, 'main', {
                'path/a': {
                    releaseType: 'node',
                    component: 'pkg1',
                },
                'path/b': {
                    releaseType: 'node',
                    component: 'pkg2',
                },
            }, {
                'path/a': version_1.Version.parse('1.0.0'),
                'path/b': version_1.Version.parse('0.2.3'),
            }, {
                separatePullRequests: true,
                plugins: ['node-workspace'],
            });
            mockPullRequests(github, []);
            sandbox.stub(manifest, 'buildPullRequests').resolves([]);
            const getLabelsStub = sandbox
                .stub(github, 'getLabels')
                .resolves(['label-a', 'label-b']);
            const createLabelsStub = sandbox.stub(github, 'createLabels').resolves();
            const pullRequests = await manifest.createPullRequests();
            (0, chai_1.expect)(pullRequests).to.be.empty;
            sinon.assert.calledOnce(getLabelsStub);
            sinon.assert.calledOnceWithExactly(createLabelsStub, [
                'autorelease: pending',
                'autorelease: tagged',
                'autorelease: pre-release',
            ]);
        });
        (0, mocha_1.it)('handles a single pull request', async () => {
            sandbox
                .stub(github, 'createPullRequest')
                .withArgs(sinon.match.has('headBranchName', 'release-please/branches/main'), 'main', 'main', sinon.match.string, sinon.match.array, sinon.match({ fork: false, draft: false }))
                .resolves({
                number: 22,
                title: 'pr title1',
                body: 'pr body1',
                headBranchName: 'release-please/branches/main',
                baseBranchName: 'main',
                labels: [],
                files: [],
            });
            sandbox
                .stub(github, 'getFileContentsOnBranch')
                .withArgs('README.md', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)('some-content'));
            mockPullRequests(github, []);
            sandbox.stub(github, 'getPullRequest').withArgs(22).resolves({
                number: 22,
                title: 'pr title1',
                body: 'pr body1',
                headBranchName: 'release-please/branches/main',
                baseBranchName: 'main',
                labels: [],
                files: [],
            });
            const manifest = new manifest_1.Manifest(github, 'main', {
                'path/a': {
                    releaseType: 'node',
                    component: 'pkg1',
                },
                'path/b': {
                    releaseType: 'node',
                    component: 'pkg2',
                },
            }, {
                'path/a': version_1.Version.parse('1.0.0'),
                'path/b': version_1.Version.parse('0.2.3'),
            }, {
                separatePullRequests: true,
                plugins: ['node-workspace'],
            });
            sandbox.stub(manifest, 'buildPullRequests').resolves([
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([
                        {
                            notes: 'Some release notes',
                        },
                    ]),
                    updates: [
                        {
                            path: 'README.md',
                            createIfMissing: false,
                            updater: new raw_content_1.RawContent('some raw content'),
                        },
                    ],
                    labels: [],
                    headRefName: 'release-please/branches/main',
                    draft: false,
                    conventionalCommits: [],
                },
            ]);
            const getLabelsStub = sandbox
                .stub(github, 'getLabels')
                .resolves(['label-a', 'label-b']);
            const createLabelsStub = sandbox.stub(github, 'createLabels').resolves();
            const pullRequests = await manifest.createPullRequests();
            (0, chai_1.expect)(pullRequests).lengthOf(1);
            sinon.assert.calledOnce(getLabelsStub);
            sinon.assert.calledOnceWithExactly(createLabelsStub, [
                'autorelease: pending',
                'autorelease: tagged',
                'autorelease: pre-release',
            ]);
        });
        (0, mocha_1.it)('handles a multiple pull requests', async () => {
            sandbox
                .stub(github, 'getFileContentsOnBranch')
                .withArgs('README.md', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)('some-content'))
                .withArgs('pkg2/README.md', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)('some-content-2'));
            mockPullRequests(github, []);
            sandbox
                .stub(github, 'getPullRequest')
                .withArgs(123)
                .resolves({
                number: 123,
                title: 'pr title1',
                body: 'pr body1',
                headBranchName: 'release-please/branches/main',
                baseBranchName: 'main',
                labels: [],
                files: [],
            })
                .withArgs(124)
                .resolves({
                number: 124,
                title: 'pr title2',
                body: 'pr body2',
                headBranchName: 'release-please/branches/main2',
                baseBranchName: 'main',
                labels: [],
                files: [],
            });
            sandbox
                .stub(github, 'createPullRequest')
                .withArgs(sinon.match.has('headBranchName', 'release-please/branches/main'), 'main', 'main', sinon.match.string, sinon.match.array, sinon.match({ fork: false, draft: false }))
                .resolves({
                number: 123,
                title: 'pr title1',
                body: 'pr body1',
                headBranchName: 'release-please/branches/main',
                baseBranchName: 'main',
                labels: [],
                files: [],
            })
                .withArgs(sinon.match.has('headBranchName', 'release-please/branches/main2'), 'main', 'main', sinon.match.string, sinon.match.array, sinon.match({ fork: false, draft: false }))
                .resolves({
                number: 124,
                title: 'pr title2',
                body: 'pr body2',
                headBranchName: 'release-please/branches/main2',
                baseBranchName: 'main',
                labels: [],
                files: [],
            });
            const manifest = new manifest_1.Manifest(github, 'main', {
                'path/a': {
                    releaseType: 'node',
                    component: 'pkg1',
                },
                'path/b': {
                    releaseType: 'node',
                    component: 'pkg2',
                },
            }, {
                'path/a': version_1.Version.parse('1.0.0'),
                'path/b': version_1.Version.parse('0.2.3'),
            }, {
                separatePullRequests: true,
                plugins: ['node-workspace'],
            });
            sandbox.stub(manifest, 'buildPullRequests').resolves([
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([
                        {
                            notes: 'Some release notes',
                        },
                    ]),
                    updates: [
                        {
                            path: 'README.md',
                            createIfMissing: false,
                            updater: new raw_content_1.RawContent('some raw content'),
                        },
                    ],
                    labels: [],
                    headRefName: 'release-please/branches/main',
                    draft: false,
                    conventionalCommits: [],
                },
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([
                        {
                            notes: 'Some release notes 2',
                        },
                    ]),
                    updates: [
                        {
                            path: 'pkg2/README.md',
                            createIfMissing: false,
                            updater: new raw_content_1.RawContent('some raw content 2'),
                        },
                    ],
                    labels: [],
                    headRefName: 'release-please/branches/main2',
                    draft: false,
                    conventionalCommits: [],
                },
            ]);
            const getLabelsStub = sandbox
                .stub(github, 'getLabels')
                .resolves(['label-a', 'label-b']);
            const createLabelsStub = sandbox.stub(github, 'createLabels').resolves();
            const pullRequests = await manifest.createPullRequests();
            (0, chai_1.expect)(pullRequests.map(pullRequest => pullRequest.number)).to.eql([
                123, 124,
            ]);
            sinon.assert.calledOnce(getLabelsStub);
            sinon.assert.calledOnceWithExactly(createLabelsStub, [
                'autorelease: pending',
                'autorelease: tagged',
                'autorelease: pre-release',
            ]);
        });
        (0, mocha_1.it)('handles signoff users', async () => {
            sandbox
                .stub(github, 'createPullRequest')
                .withArgs(sinon.match.has('headBranchName', 'release-please/branches/main'), 'main', 'main', sinon.match.string, sinon.match.array, sinon.match({ fork: false, draft: false }))
                .resolves({
                number: 22,
                title: 'pr title1',
                body: 'pr body1',
                headBranchName: 'release-please/branches/main',
                baseBranchName: 'main',
                labels: [],
                files: [],
            });
            sandbox
                .stub(github, 'getFileContentsOnBranch')
                .withArgs('README.md', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)('some-content'));
            mockPullRequests(github, []);
            sandbox.stub(github, 'getPullRequest').withArgs(22).resolves({
                number: 22,
                title: 'pr title1',
                body: 'pr body1',
                headBranchName: 'release-please/branches/main',
                baseBranchName: 'main',
                labels: [],
                files: [],
            });
            const manifest = new manifest_1.Manifest(github, 'main', {
                'path/a': {
                    releaseType: 'node',
                    component: 'pkg1',
                },
                'path/b': {
                    releaseType: 'node',
                    component: 'pkg2',
                },
            }, {
                'path/a': version_1.Version.parse('1.0.0'),
                'path/b': version_1.Version.parse('0.2.3'),
            }, {
                separatePullRequests: true,
                plugins: ['node-workspace'],
                signoff: 'Alice <alice@example.com>',
            });
            sandbox.stub(manifest, 'buildPullRequests').resolves([
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([
                        {
                            notes: 'Some release notes',
                        },
                    ]),
                    updates: [
                        {
                            path: 'README.md',
                            createIfMissing: false,
                            updater: new raw_content_1.RawContent('some raw content'),
                        },
                    ],
                    labels: [],
                    headRefName: 'release-please/branches/main',
                    draft: false,
                    conventionalCommits: [],
                },
            ]);
            const getLabelsStub = sandbox
                .stub(github, 'getLabels')
                .resolves(['label-a', 'label-b']);
            const createLabelsStub = sandbox.stub(github, 'createLabels').resolves();
            const pullRequestNumbers = await manifest.createPullRequests();
            (0, chai_1.expect)(pullRequestNumbers).lengthOf(1);
            sinon.assert.calledOnce(getLabelsStub);
            sinon.assert.calledOnceWithExactly(createLabelsStub, [
                'autorelease: pending',
                'autorelease: tagged',
                'autorelease: pre-release',
            ]);
        });
        (0, mocha_1.it)('handles fork = true', async () => {
            sandbox
                .stub(github, 'createPullRequest')
                .withArgs(sinon.match.has('headBranchName', 'release-please/branches/main'), 'main', 'main', sinon.match.string, sinon.match.array, sinon.match({ fork: true, draft: false }))
                .resolves({
                number: 22,
                title: 'pr title1',
                body: 'pr body1',
                headBranchName: 'release-please/branches/main',
                baseBranchName: 'main',
                labels: [],
                files: [],
            });
            sandbox
                .stub(github, 'getFileContentsOnBranch')
                .withArgs('README.md', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)('some-content'));
            mockPullRequests(github, []);
            sandbox.stub(github, 'getPullRequest').withArgs(22).resolves({
                number: 22,
                title: 'pr title1',
                body: 'pr body1',
                headBranchName: 'release-please/branches/main',
                baseBranchName: 'main',
                labels: [],
                files: [],
            });
            const manifest = new manifest_1.Manifest(github, 'main', {
                'path/a': {
                    releaseType: 'node',
                    component: 'pkg1',
                },
                'path/b': {
                    releaseType: 'node',
                    component: 'pkg2',
                },
            }, {
                'path/a': version_1.Version.parse('1.0.0'),
                'path/b': version_1.Version.parse('0.2.3'),
            }, {
                separatePullRequests: true,
                plugins: ['node-workspace'],
                fork: true,
            });
            sandbox.stub(manifest, 'buildPullRequests').resolves([
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([
                        {
                            notes: 'Some release notes',
                        },
                    ]),
                    updates: [
                        {
                            path: 'README.md',
                            createIfMissing: false,
                            updater: new raw_content_1.RawContent('some raw content'),
                        },
                    ],
                    labels: [],
                    headRefName: 'release-please/branches/main',
                    draft: false,
                    conventionalCommits: [],
                },
            ]);
            const getLabelsStub = sandbox
                .stub(github, 'getLabels')
                .resolves(['label-a', 'label-b']);
            const createLabelsStub = sandbox.stub(github, 'createLabels').resolves();
            const pullRequestNumbers = await manifest.createPullRequests();
            (0, chai_1.expect)(pullRequestNumbers).lengthOf(1);
            sinon.assert.calledOnce(getLabelsStub);
            sinon.assert.calledOnceWithExactly(createLabelsStub, [
                'autorelease: pending',
                'autorelease: tagged',
                'autorelease: pre-release',
            ]);
        });
        (0, mocha_1.it)('enables auto-merge when filters are provided (filters: version bump, commit type, commit scope, match-all)', async () => {
            const createPullRequestStub = sandbox
                .stub(github, 'createPullRequest')
                .resolves({
                number: 22,
                title: 'pr title',
                body: 'pr body',
                headBranchName: 'release-please/branches/main',
                baseBranchName: 'main',
                labels: [],
                files: [],
            });
            const enablePullRequestAutoMergeStub = sandbox
                .stub(github, 'enablePullRequestAutoMerge')
                .resolves('direct-merged');
            const addPullRequestReviewersStub = sandbox
                .stub(github, 'addPullRequestReviewers')
                .resolves();
            sandbox
                .stub(github, 'getFileContentsOnBranch')
                .withArgs('README.md', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)('some-content'));
            mockPullRequests(github, []);
            sandbox.stub(github, 'getPullRequest').withArgs(22).resolves({
                number: 22,
                title: 'pr title1',
                body: 'pr body1',
                headBranchName: 'release-please/branches/main',
                baseBranchName: 'main',
                labels: [],
                files: [],
            });
            const manifest = new manifest_1.Manifest(github, 'main', {
                'path/a': {
                    releaseType: 'node',
                    component: 'pkg1',
                },
                'path/b': {
                    releaseType: 'node',
                    component: 'pkg2',
                },
                'path/c': {
                    releaseType: 'node',
                    component: 'pkg3',
                },
                'path/d': {
                    releaseType: 'node',
                    component: 'pkg4',
                },
                'path/e': {
                    releaseType: 'node',
                    component: 'pkg5',
                },
            }, {
                'path/a': version_1.Version.parse('1.0.0'),
                'path/b': version_1.Version.parse('1.0.0'),
                'path/c': version_1.Version.parse('1.0.0'),
                'path/d': version_1.Version.parse('1.0.0'),
                'path/e': version_1.Version.parse('1.0.0'),
            }, {
                separatePullRequests: true,
                autoMerge: {
                    mergeMethod: 'rebase',
                    versionBumpFilter: ['minor'],
                    conventionalCommitFilter: {
                        commits: [{ type: 'fix', scope: 'api' }],
                        matchBehaviour: 'match-all',
                    },
                },
            });
            sandbox
                .stub(manifest, 'buildPullRequests')
                .withArgs(sinon.match.any, sinon.match.any)
                .resolves([
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([]),
                    updates: [],
                    labels: [],
                    headRefName: 'release-please/branches/main/components/a',
                    draft: false,
                    version: version_1.Version.parse('1.0.1'), // patch bump, does not match filter
                    previousVersion: version_1.Version.parse('1.0.0'),
                    conventionalCommits: [
                        {
                            type: 'fix', // type match filter
                            scope: 'api', // scope match filter
                            notes: [],
                            references: [],
                            sha: 'commit123',
                            message: 'fix(api): something',
                            bareMessage: 'something',
                            breaking: false,
                        },
                    ],
                },
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([]),
                    updates: [],
                    labels: [],
                    headRefName: 'release-please/branches/main/components/b',
                    draft: false,
                    version: version_1.Version.parse('1.1.0'), // minor bump, match filter
                    previousVersion: version_1.Version.parse('1.0.0'),
                    conventionalCommits: [
                        {
                            type: 'fix', // type match filter
                            scope: 'api', // scope match filter
                            notes: [],
                            references: [],
                            sha: 'commit123',
                            message: 'fix(api): something',
                            bareMessage: 'something',
                            breaking: false,
                        },
                    ],
                },
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([]),
                    updates: [],
                    labels: [],
                    headRefName: 'release-please/branches/main/components/b',
                    draft: false,
                    version: version_1.Version.parse('1.1.0'), // minor bump, match filter
                    previousVersion: version_1.Version.parse('1.0.0'),
                    conventionalCommits: [
                        {
                            type: 'fix', // type match filter
                            scope: 'api', // scope match filter
                            notes: [],
                            references: [],
                            sha: 'commit123',
                            message: 'fix(api): something',
                            bareMessage: 'something',
                            breaking: false,
                        },
                        {
                            type: 'feat(client)', // type does not match filter
                            scope: 'api', // scope match filter
                            notes: [],
                            references: [],
                            sha: 'commit123',
                            message: 'fix(api): something',
                            bareMessage: 'something',
                            breaking: false,
                        },
                    ],
                },
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([]),
                    updates: [],
                    labels: [],
                    headRefName: 'release-please/branches/main/components/c',
                    draft: false,
                    version: version_1.Version.parse('1.1.0'), // minor bump, match filter
                    previousVersion: version_1.Version.parse('1.0.0'),
                    conventionalCommits: [
                        {
                            type: 'feat', // type does not match filter
                            scope: 'api', // scope match filter
                            notes: [],
                            references: [],
                            sha: 'commit123',
                            message: 'feat(api): something',
                            bareMessage: 'something',
                            breaking: false,
                        },
                    ],
                },
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([]),
                    updates: [],
                    labels: [],
                    headRefName: 'release-please/branches/main/components/d',
                    draft: false,
                    version: version_1.Version.parse('1.1.0'), // minor bump, match filter
                    previousVersion: version_1.Version.parse('1.0.0'),
                    conventionalCommits: [
                        {
                            type: 'fix', // type does match filter
                            scope: null, // no scope, does not match filter
                            notes: [],
                            references: [],
                            sha: 'commit123',
                            message: 'fix: something',
                            bareMessage: 'something',
                            breaking: false,
                        },
                    ],
                },
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([]),
                    updates: [],
                    labels: [],
                    headRefName: 'release-please/branches/main/components/e',
                    draft: false,
                    version: version_1.Version.parse('1.1.0'), // minor bump, match filter
                    previousVersion: version_1.Version.parse('1.0.0'),
                    conventionalCommits: [
                        {
                            type: 'fix', // type does match filter
                            scope: 'other', // other scope, does not match filter
                            notes: [],
                            references: [],
                            sha: 'commit123',
                            message: 'fix(other): something',
                            bareMessage: 'something',
                            breaking: false,
                        },
                    ],
                },
            ]);
            const getLabelsStub = sandbox
                .stub(github, 'getLabels')
                .resolves(['label-a']);
            const createLabelsStub = sandbox.stub(github, 'createLabels').resolves();
            const pullRequestNumbers = await manifest.createPullRequests();
            (0, chai_1.expect)(pullRequestNumbers).lengthOf(6);
            sinon.assert.calledOnce(getLabelsStub);
            sinon.assert.calledOnce(createLabelsStub);
            (0, chai_1.expect)(createPullRequestStub.callCount).to.equal(6);
            sinon.assert.calledWith(createPullRequestStub, sinon.match.has('headBranchName', sinon.match.string), 'main', 'main', sinon.match.string, sinon.match.array, sinon.match.object);
            (0, chai_1.expect)(enablePullRequestAutoMergeStub.callCount).to.equal(1);
            // only called when not auto-merged
            (0, chai_1.expect)(addPullRequestReviewersStub.callCount).to.equal(5);
        });
        (0, mocha_1.it)('enables auto-merge when filters are provided (filters: only commit type, match-all)', async () => {
            const createPullRequestStub = sandbox
                .stub(github, 'createPullRequest')
                .resolves({
                number: 22,
                title: 'pr title1',
                body: 'pr body1',
                headBranchName: 'release-please/branches/main',
                baseBranchName: 'main',
                labels: [],
                files: [],
            });
            const enablePullRequestAutoMergeStub = sandbox
                .stub(github, 'enablePullRequestAutoMerge')
                .resolves('direct-merged');
            const addPullRequestReviewersStub = sandbox
                .stub(github, 'addPullRequestReviewers')
                .resolves();
            sandbox
                .stub(github, 'getFileContentsOnBranch')
                .withArgs('README.md', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)('some-content'));
            mockPullRequests(github, []);
            sandbox.stub(github, 'getPullRequest').withArgs(22).resolves({
                number: 22,
                title: 'pr title1',
                body: 'pr body1',
                headBranchName: 'release-please/branches/main',
                baseBranchName: 'main',
                labels: [],
                files: [],
            });
            const manifest = new manifest_1.Manifest(github, 'main', {
                'path/a': {
                    releaseType: 'node',
                    component: 'pkg1',
                },
                'path/b': {
                    releaseType: 'node',
                    component: 'pkg2',
                },
                'path/c': {
                    releaseType: 'node',
                    component: 'pkg3',
                },
                'path/d': {
                    releaseType: 'node',
                    component: 'pkg4',
                },
            }, {
                'path/a': version_1.Version.parse('1.0.0'),
                'path/b': version_1.Version.parse('1.0.0'),
                'path/c': version_1.Version.parse('1.0.0'),
                'path/d': version_1.Version.parse('1.0.0'),
            }, {
                separatePullRequests: true,
                autoMerge: {
                    mergeMethod: 'rebase',
                    conventionalCommitFilter: {
                        commits: [{ type: 'fix' }],
                        matchBehaviour: 'match-all',
                    }, // only filter on type
                },
            });
            sandbox
                .stub(manifest, 'buildPullRequests')
                .withArgs(sinon.match.any, sinon.match.any)
                .resolves([
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([]),
                    updates: [],
                    labels: [],
                    headRefName: 'release-please/branches/main/components/a',
                    draft: false,
                    version: version_1.Version.parse('1.1.0'),
                    previousVersion: version_1.Version.parse('1.0.0'),
                    conventionalCommits: [
                        {
                            type: 'fix', // type match filter
                            scope: 'api', // some scope
                            notes: [],
                            references: [],
                            sha: 'commit123',
                            message: 'fix(api): something',
                            bareMessage: 'something',
                            breaking: false,
                        },
                    ],
                },
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([]),
                    updates: [],
                    labels: [],
                    headRefName: 'release-please/branches/main/components/b',
                    draft: false,
                    version: version_1.Version.parse('1.1.0'),
                    previousVersion: version_1.Version.parse('1.0.0'),
                    conventionalCommits: [
                        {
                            type: 'fix', // type match filter
                            scope: 'other', // another scope
                            notes: [],
                            references: [],
                            sha: 'commit123',
                            message: 'fix(other): something',
                            bareMessage: 'something',
                            breaking: false,
                        },
                    ],
                },
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([]),
                    updates: [],
                    labels: [],
                    headRefName: 'release-please/branches/main/components/c',
                    draft: false,
                    version: version_1.Version.parse('1.1.0'),
                    previousVersion: version_1.Version.parse('1.0.0'),
                    conventionalCommits: [
                        {
                            type: 'fix', // type does match filter
                            scope: null, // no scope
                            notes: [],
                            references: [],
                            sha: 'commit123',
                            message: 'feat(api): something',
                            bareMessage: 'something',
                            breaking: false,
                        },
                    ],
                },
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([]),
                    updates: [],
                    labels: [],
                    headRefName: 'release-please/branches/main/components/d',
                    draft: false,
                    version: version_1.Version.parse('1.1.0'),
                    previousVersion: version_1.Version.parse('1.0.0'),
                    conventionalCommits: [
                        {
                            type: 'feat', // type does not match filter
                            scope: 'api',
                            notes: [],
                            references: [],
                            sha: 'commit123',
                            message: 'feat(api): something',
                            bareMessage: 'something',
                            breaking: false,
                        },
                    ],
                },
            ]);
            const getLabelsStub = sandbox
                .stub(github, 'getLabels')
                .resolves(['label-a']);
            const createLabelsStub = sandbox.stub(github, 'createLabels').resolves();
            const pullRequestNumbers = await manifest.createPullRequests();
            (0, chai_1.expect)(pullRequestNumbers).lengthOf(4);
            sinon.assert.calledOnce(getLabelsStub);
            sinon.assert.calledOnce(createLabelsStub);
            (0, chai_1.expect)(createPullRequestStub.callCount).to.equal(4);
            sinon.assert.calledWith(createPullRequestStub, sinon.match.has('headBranchName', sinon.match.string), 'main', 'main', sinon.match.string, sinon.match.array, sinon.match.object);
            (0, chai_1.expect)(enablePullRequestAutoMergeStub.callCount).to.equal(3);
            // only called when not auto-merged
            (0, chai_1.expect)(addPullRequestReviewersStub.callCount).to.equal(1);
        });
        (0, mocha_1.it)('enables auto-merge when filters are provided (filters: build-patch-minor version bump, commit filters, match-at-least-one)', async () => {
            const createPullRequestStub = sandbox
                .stub(github, 'createPullRequest')
                .resolves({
                number: 22,
                title: 'pr title1',
                body: 'pr body1',
                headBranchName: 'release-please/branches/main',
                baseBranchName: 'main',
                labels: [],
                files: [],
            });
            const enablePullRequestAutoMergeStub = sandbox
                .stub(github, 'enablePullRequestAutoMerge')
                .resolves('direct-merged');
            const addPullRequestReviewersStub = sandbox
                .stub(github, 'addPullRequestReviewers')
                .resolves();
            sandbox
                .stub(github, 'getFileContentsOnBranch')
                .withArgs('README.md', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)('some-content'));
            mockPullRequests(github, []);
            sandbox.stub(github, 'getPullRequest').withArgs(22).resolves({
                number: 22,
                title: 'pr title1',
                body: 'pr body1',
                headBranchName: 'release-please/branches/main',
                baseBranchName: 'main',
                labels: [],
                files: [],
            });
            const manifest = new manifest_1.Manifest(github, 'main', {
                'path/a': {
                    releaseType: 'node',
                    component: 'pkg1',
                },
                'path/b': {
                    releaseType: 'node',
                    component: 'pkg2',
                },
                'path/c': {
                    releaseType: 'node',
                    component: 'pkg3',
                },
                'path/d': {
                    releaseType: 'node',
                    component: 'pkg4',
                },
                'path/e': {
                    releaseType: 'node',
                    component: 'pkg5',
                },
                'path/f': {
                    releaseType: 'node',
                    component: 'pkg6',
                },
            }, {
                'path/a': version_1.Version.parse('1.0.0'),
                'path/b': version_1.Version.parse('1.0.0'),
                'path/c': version_1.Version.parse('1.0.0'),
                'path/d': version_1.Version.parse('1.0.0'),
                'path/e': version_1.Version.parse('1.0.0'),
                'path/f': version_1.Version.parse('1.0.0'),
            }, {
                separatePullRequests: true,
                autoMerge: {
                    mergeMethod: 'rebase',
                    versionBumpFilter: ['minor', 'build', 'patch'],
                    conventionalCommitFilter: {
                        matchBehaviour: 'match-at-least-one',
                        commits: [{ type: 'fix' }, { type: 'feat', scope: 'api' }],
                    },
                },
            });
            sandbox
                .stub(manifest, 'buildPullRequests')
                .withArgs(sinon.match.any, sinon.match.any)
                .resolves([
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([]),
                    updates: [],
                    labels: [],
                    headRefName: 'release-please/branches/main/components/a',
                    draft: false,
                    version: version_1.Version.parse('1.0.1'), // version bump match filter
                    previousVersion: version_1.Version.parse('1.0.0'),
                    conventionalCommits: [
                        {
                            type: 'fix', // type match filter
                            scope: 'something',
                            notes: [],
                            references: [],
                            sha: 'commit123',
                            message: 'fix(something): something',
                            bareMessage: 'something',
                            breaking: false,
                        },
                        {
                            type: 'ci', // type does not match filter
                            scope: 'something',
                            notes: [],
                            references: [],
                            sha: 'commit123',
                            message: 'ci(something): something',
                            bareMessage: 'something',
                            breaking: false,
                        },
                    ],
                },
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([]),
                    updates: [],
                    labels: [],
                    headRefName: 'release-please/branches/main/components/a',
                    draft: false,
                    version: version_1.Version.parse('1.0.1'), // version bump match filter
                    previousVersion: version_1.Version.parse('1.0.0'),
                    conventionalCommits: [
                        {
                            type: 'ci', // first type does not match filter
                            scope: 'something',
                            notes: [],
                            references: [],
                            sha: 'commit123',
                            message: 'ci(something): something',
                            bareMessage: 'something',
                            breaking: false,
                        },
                        {
                            type: 'fix', // type match filter
                            scope: 'something',
                            notes: [],
                            references: [],
                            sha: 'commit123',
                            message: 'fix(something): something',
                            bareMessage: 'something',
                            breaking: false,
                        },
                    ],
                },
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([]),
                    updates: [],
                    labels: [],
                    headRefName: 'release-please/branches/main/components/b',
                    draft: false,
                    version: version_1.Version.parse('1.1.0'), // version bump match filter
                    previousVersion: version_1.Version.parse('1.0.0'),
                    conventionalCommits: [
                        {
                            type: 'feat', // type match filter
                            scope: 'api', // scope match filter
                            notes: [],
                            references: [],
                            sha: 'commit123',
                            message: 'feat(api): something',
                            bareMessage: 'something',
                            breaking: false,
                        },
                        {
                            type: 'ci', // type does not match filter
                            scope: 'something',
                            notes: [],
                            references: [],
                            sha: 'commit123',
                            message: 'ci(something): something',
                            bareMessage: 'something',
                            breaking: false,
                        },
                    ],
                },
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([]),
                    updates: [],
                    labels: [],
                    headRefName: 'release-please/branches/main/components/c',
                    draft: false,
                    version: version_1.Version.parse('1.1.0'), // version bump match filter
                    previousVersion: version_1.Version.parse('1.0.0'),
                    conventionalCommits: [
                        {
                            type: 'feat', // type does match filter
                            scope: null, // no scope, does not match filter
                            notes: [],
                            references: [],
                            sha: 'commit123',
                            message: 'feat: something',
                            bareMessage: 'something',
                            breaking: false,
                        },
                        {
                            type: 'ci', // type does not match filter
                            scope: 'something',
                            notes: [],
                            references: [],
                            sha: 'commit123',
                            message: 'ci(something): something',
                            bareMessage: 'something',
                            breaking: false,
                        },
                    ],
                },
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([]),
                    updates: [],
                    labels: [],
                    headRefName: 'release-please/branches/main/components/d',
                    draft: false,
                    version: version_1.Version.parse('1.0.1'), // version bump match filter
                    previousVersion: version_1.Version.parse('1.0.0'),
                    conventionalCommits: [
                        {
                            type: 'fix', // type does match filter
                            scope: null, // no scope, does match filter
                            notes: [],
                            references: [],
                            sha: 'commit123',
                            message: 'fix: something',
                            bareMessage: 'something',
                            breaking: false,
                        },
                        {
                            type: 'ci', // type does not match filter
                            scope: 'something',
                            notes: [],
                            references: [],
                            sha: 'commit123',
                            message: 'ci(something): something',
                            bareMessage: 'something',
                            breaking: false,
                        },
                    ],
                },
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([]),
                    updates: [],
                    labels: [],
                    headRefName: 'release-please/branches/main/components/e',
                    draft: false,
                    version: version_1.Version.parse('2.0.0'), // version bump does not match filter
                    previousVersion: version_1.Version.parse('1.0.0'),
                    conventionalCommits: [
                        {
                            type: 'feat', // type match filter
                            scope: 'api',
                            notes: [],
                            references: [],
                            sha: 'commit123',
                            message: 'feat(api): something',
                            bareMessage: 'something',
                            breaking: false,
                        },
                        {
                            type: 'feat', // type does match filter
                            scope: 'something', // scope does not match filter
                            notes: [],
                            references: [],
                            sha: 'commit123',
                            message: 'feat(something): something',
                            bareMessage: 'something',
                            breaking: false,
                        },
                    ],
                },
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([]),
                    updates: [],
                    labels: [],
                    headRefName: 'release-please/branches/main/components/f',
                    draft: false,
                    version: version_1.Version.parse('1.1.0'), // version bump match filter
                    previousVersion: version_1.Version.parse('1.0.0'),
                    conventionalCommits: [
                        {
                            type: 'chore', // type does not match filter
                            scope: 'api',
                            notes: [],
                            references: [],
                            sha: 'commit123',
                            message: 'chore(api): something',
                            bareMessage: 'something',
                            breaking: false,
                        },
                        {
                            type: 'ci', // type does not match filter
                            scope: 'something',
                            notes: [],
                            references: [],
                            sha: 'commit123',
                            message: 'feat(something): something',
                            bareMessage: 'something',
                            breaking: false,
                        },
                    ],
                },
            ]);
            const getLabelsStub = sandbox
                .stub(github, 'getLabels')
                .resolves(['label-a']);
            const createLabelsStub = sandbox.stub(github, 'createLabels').resolves();
            const pullRequestNumbers = await manifest.createPullRequests();
            (0, chai_1.expect)(pullRequestNumbers).lengthOf(7);
            sinon.assert.calledOnce(getLabelsStub);
            sinon.assert.calledOnce(createLabelsStub);
            (0, chai_1.expect)(createPullRequestStub.callCount).to.equal(7);
            sinon.assert.calledWith(createPullRequestStub, sinon.match.has('headBranchName', sinon.match.string), 'main', 'main', sinon.match.string, sinon.match.array, sinon.match.object);
            (0, chai_1.expect)(enablePullRequestAutoMergeStub.callCount).to.equal(4);
            // only called when not auto-merged
            (0, chai_1.expect)(addPullRequestReviewersStub.callCount).to.equal(3);
        });
        (0, mocha_1.it)('updates an existing pull request', async () => {
            sandbox
                .stub(github, 'getFileContentsOnBranch')
                .withArgs('README.md', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)('some-content'));
            sandbox
                .stub(github, 'createPullRequest')
                .withArgs(sinon.match.has('headBranchName', 'release-please/branches/main'), 'main', 'main', sinon.match.string, sinon.match.array, sinon.match({ fork: false, draft: false }))
                .resolves({
                number: 22,
                title: 'pr title1',
                body: 'pr body1',
                headBranchName: 'release-please/branches/main',
                baseBranchName: 'main',
                labels: [],
                files: [],
            });
            mockPullRequests(github, [
                {
                    number: 22,
                    title: 'pr title1',
                    body: new pull_request_body_1.PullRequestBody([]).toString(),
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    labels: ['autorelease: pending'],
                    files: [],
                },
            ], []);
            sandbox
                .stub(github, 'updatePullRequest')
                .withArgs(22, sinon.match.any, sinon.match.any, sinon.match.any)
                .resolves({
                number: 22,
                title: 'pr title1',
                body: 'pr body1',
                headBranchName: 'release-please/branches/main',
                baseBranchName: 'main',
                labels: [],
                files: [],
            });
            const manifest = new manifest_1.Manifest(github, 'main', {
                'path/a': {
                    releaseType: 'node',
                    component: 'pkg1',
                },
                'path/b': {
                    releaseType: 'node',
                    component: 'pkg2',
                },
            }, {
                'path/a': version_1.Version.parse('1.0.0'),
                'path/b': version_1.Version.parse('0.2.3'),
            }, {
                separatePullRequests: true,
                plugins: ['node-workspace'],
            });
            sandbox.stub(manifest, 'buildPullRequests').resolves([
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([
                        {
                            notes: 'Some release notes',
                        },
                    ]),
                    updates: [
                        {
                            path: 'README.md',
                            createIfMissing: false,
                            updater: new raw_content_1.RawContent('some raw content'),
                        },
                    ],
                    labels: [],
                    headRefName: 'release-please/branches/main',
                    draft: false,
                    conventionalCommits: [],
                },
            ]);
            const getLabelsStub = sandbox
                .stub(github, 'getLabels')
                .resolves(['label-a', 'label-b']);
            const createLabelsStub = sandbox.stub(github, 'createLabels').resolves();
            const pullRequestNumbers = await manifest.createPullRequests();
            (0, chai_1.expect)(pullRequestNumbers).lengthOf(1);
            sinon.assert.calledOnce(getLabelsStub);
            sinon.assert.calledOnceWithExactly(createLabelsStub, [
                'autorelease: pending',
                'autorelease: tagged',
                'autorelease: pre-release',
            ]);
        });
        (0, mocha_1.describe)('with an overflowing body', () => {
            const body = new pull_request_body_1.PullRequestBody((0, helpers_1.mockReleaseData)(1000), {
                useComponents: true,
            });
            (0, mocha_1.it)('updates an existing pull request', async () => {
                mockPullRequests(github, [
                    {
                        number: 22,
                        title: 'pr title1',
                        body: pullRequestBody('release-notes/single.txt'),
                        headBranchName: 'release-please/branches/main',
                        baseBranchName: 'main',
                        labels: ['autorelease: pending'],
                        files: [],
                    },
                ], []);
                const updatePullRequestStub = sandbox
                    .stub(github, 'updatePullRequest')
                    .withArgs(22, sinon.match.any, 'main', 'main', sinon.match.has('pullRequestOverflowHandler', sinon.match.truthy))
                    .resolves({
                    number: 22,
                    title: 'pr title1',
                    body: 'pr body1',
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    labels: [],
                    files: [],
                });
                const manifest = new manifest_1.Manifest(github, 'main', {
                    'path/a': {
                        releaseType: 'node',
                        component: 'pkg1',
                    },
                    'path/b': {
                        releaseType: 'node',
                        component: 'pkg2',
                    },
                }, {
                    'path/a': version_1.Version.parse('1.0.0'),
                    'path/b': version_1.Version.parse('0.2.3'),
                }, {
                    separatePullRequests: true,
                    plugins: ['node-workspace'],
                });
                const buildPullRequestsStub = sandbox
                    .stub(manifest, 'buildPullRequests')
                    .resolves([
                    {
                        title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                        body,
                        updates: [
                            {
                                path: 'README.md',
                                createIfMissing: false,
                                updater: new raw_content_1.RawContent('some raw content'),
                            },
                        ],
                        labels: [],
                        headRefName: 'release-please/branches/main',
                        draft: false,
                        conventionalCommits: [],
                    },
                ]);
                const getLabelsStub = sandbox
                    .stub(github, 'getLabels')
                    .resolves(['label-a', 'label-b']);
                const createLabelsStub = sandbox
                    .stub(github, 'createLabels')
                    .resolves();
                const pullRequestNumbers = await manifest.createPullRequests();
                sinon.assert.calledOnce(updatePullRequestStub);
                sinon.assert.calledOnce(buildPullRequestsStub);
                sinon.assert.calledOnce(getLabelsStub);
                sinon.assert.calledOnceWithExactly(createLabelsStub, [
                    'autorelease: pending',
                    'autorelease: tagged',
                    'autorelease: pre-release',
                ]);
                (0, chai_1.expect)(pullRequestNumbers).lengthOf(1);
            });
            (0, mocha_1.it)('ignores an existing pull request if there are no changes', async () => {
                const getFileContentsOnBranchStub = sandbox
                    .stub(github, 'getFileContentsOnBranch')
                    .withArgs('README.md', 'main')
                    .resolves((0, helpers_1.buildGitHubFileRaw)('some-content'))
                    .withArgs('release-notes.md', 'my-head-branch--release-notes')
                    .resolves((0, helpers_1.buildGitHubFileRaw)(body.toString()));
                const createPullRequestStub = sandbox
                    .stub(github, 'createPullRequest')
                    // .withArgs(
                    //   sinon.match.has('headBranchName', 'release-please/branches/main'),
                    //   sinon.match.string,
                    //   sinon.match.string,
                    //   sinon.match.string,
                    //   sinon.match.array,
                    //   sinon.match({fork: false, draft: false})
                    // )
                    .resolves({
                    number: 22,
                    title: 'pr title1',
                    body: 'pr body1',
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    labels: [],
                    files: [],
                });
                mockPullRequests(github, [
                    {
                        number: 22,
                        title: 'pr title1',
                        body: pullRequestBody('release-notes/overflow.txt'),
                        headBranchName: 'release-please/branches/main',
                        baseBranchName: 'main',
                        labels: ['autorelease: pending'],
                        files: [],
                    },
                ], []);
                const updatePullRequestStub = sandbox
                    .stub(github, 'updatePullRequest')
                    // .withArgs(
                    //   22,
                    //   sinon.match.any,
                    //   sinon.match.string,
                    //   sinon.match.string,
                    //   sinon.match.has('pullRequestOverflowHandler', sinon.match.truthy)
                    // )
                    .resolves({
                    number: 22,
                    title: 'pr title1',
                    body: 'pr body1',
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    labels: [],
                    files: [],
                });
                const manifest = new manifest_1.Manifest(github, 'main', {
                    'path/a': {
                        releaseType: 'node',
                        component: 'pkg1',
                    },
                    'path/b': {
                        releaseType: 'node',
                        component: 'pkg2',
                    },
                }, {
                    'path/a': version_1.Version.parse('1.0.0'),
                    'path/b': version_1.Version.parse('0.2.3'),
                }, {
                    separatePullRequests: true,
                    plugins: ['node-workspace'],
                });
                const getLabelsStub = sandbox
                    .stub(github, 'getLabels')
                    .resolves(['label-a', 'label-b', 'autorelease: pending']);
                const createLabelsStub = sandbox
                    .stub(github, 'createLabels')
                    .resolves();
                sandbox.stub(manifest, 'buildPullRequests').resolves([
                    {
                        title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                        body,
                        updates: [
                            {
                                path: 'README.md',
                                createIfMissing: false,
                                updater: new raw_content_1.RawContent('some raw content'),
                            },
                        ],
                        labels: [],
                        headRefName: 'release-please/branches/main',
                        draft: false,
                        conventionalCommits: [],
                    },
                ]);
                const pullRequestNumbers = await manifest.createPullRequests();
                (0, chai_1.expect)(pullRequestNumbers).lengthOf(1);
                sinon.assert.calledOnce(getLabelsStub);
                sinon.assert.calledOnceWithExactly(createLabelsStub, [
                    'autorelease: tagged',
                    'autorelease: pre-release',
                ]);
                sinon.assert.calledOnce(getFileContentsOnBranchStub);
                sinon.assert.notCalled(createPullRequestStub);
                sinon.assert.calledOnce(updatePullRequestStub);
            });
        });
        (0, mocha_1.it)('updates an existing snapshot pull request', async () => {
            sandbox
                .stub(github, 'getFileContentsOnBranch')
                .withArgs('README.md', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)('some-content'));
            sandbox
                .stub(github, 'createPullRequest')
                .withArgs(sinon.match.has('headBranchName', 'release-please/branches/main'), 'main', 'main', sinon.match.string, sinon.match.array, sinon.match({ fork: false, draft: false }))
                .resolves({
                number: 22,
                title: 'pr title1',
                body: 'pr body1',
                headBranchName: 'release-please/branches/main',
                baseBranchName: 'main',
                labels: [],
                files: [],
            });
            mockPullRequests(github, [
                {
                    number: 22,
                    title: 'pr title1',
                    body: new pull_request_body_1.PullRequestBody([]).toString(),
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    labels: ['autorelease: snapshot'],
                    files: [],
                },
            ], []);
            sandbox
                .stub(github, 'updatePullRequest')
                .withArgs(22, sinon.match.any, sinon.match.any, sinon.match.any)
                .resolves({
                number: 22,
                title: 'pr title1',
                body: 'pr body1',
                headBranchName: 'release-please/branches/main',
                baseBranchName: 'main',
                labels: ['autorelease: snapshot'],
                files: [],
            });
            const manifest = new manifest_1.Manifest(github, 'main', {
                'path/a': {
                    releaseType: 'java',
                    component: 'pkg1',
                },
                'path/b': {
                    releaseType: 'java',
                    component: 'pkg2',
                },
            }, {
                'path/a': version_1.Version.parse('1.0.0'),
                'path/b': version_1.Version.parse('0.2.3'),
            }, {
                separatePullRequests: true,
            });
            const getLabelsStub = sandbox
                .stub(github, 'getLabels')
                .resolves(['label-a', 'label-b', 'autorelease: pending']);
            const createLabelsStub = sandbox.stub(github, 'createLabels').resolves();
            sandbox.stub(manifest, 'buildPullRequests').resolves([
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([
                        {
                            notes: 'SNAPSHOT bump',
                        },
                    ]),
                    updates: [
                        {
                            path: 'pom.xml',
                            createIfMissing: false,
                            updater: new raw_content_1.RawContent('some raw content'),
                        },
                    ],
                    labels: [],
                    headRefName: 'release-please/branches/main',
                    draft: false,
                    conventionalCommits: [],
                },
            ]);
            const pullRequestNumbers = await manifest.createPullRequests();
            (0, chai_1.expect)(pullRequestNumbers).lengthOf(1);
            sinon.assert.calledOnce(getLabelsStub);
            sinon.assert.calledOnceWithExactly(createLabelsStub, [
                'autorelease: tagged',
                'autorelease: pre-release',
            ]);
        });
        (0, mocha_1.it)('skips pull requests if there are pending, merged pull requests', async () => {
            sandbox
                .stub(github, 'getFileContentsOnBranch')
                .withArgs('README.md', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)('some-content'));
            mockPullRequests(github, [], [
                {
                    number: 22,
                    title: 'pr title1',
                    body: new pull_request_body_1.PullRequestBody([]).toString(),
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    labels: ['autorelease: pending'],
                    files: [],
                },
            ]);
            const manifest = new manifest_1.Manifest(github, 'main', {
                'path/a': {
                    releaseType: 'node',
                    component: 'pkg1',
                },
                'path/b': {
                    releaseType: 'node',
                    component: 'pkg2',
                },
            }, {
                'path/a': version_1.Version.parse('1.0.0'),
                'path/b': version_1.Version.parse('0.2.3'),
            }, {
                separatePullRequests: true,
                plugins: ['node-workspace'],
            });
            sandbox.stub(manifest, 'buildPullRequests').resolves([
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([
                        {
                            notes: 'Some release notes',
                        },
                    ]),
                    updates: [
                        {
                            path: 'README.md',
                            createIfMissing: false,
                            updater: new raw_content_1.RawContent('some raw content'),
                        },
                    ],
                    labels: [],
                    headRefName: 'release-please/branches/main',
                    draft: false,
                    conventionalCommits: [],
                },
            ]);
            const getLabelsStub = sandbox
                .stub(github, 'getLabels')
                .resolves(['label-a', 'label-b']);
            const createLabelsStub = sandbox.stub(github, 'createLabels').resolves();
            const pullRequestNumbers = await manifest.createPullRequests();
            (0, chai_1.expect)(pullRequestNumbers).lengthOf(0);
            sinon.assert.calledOnce(getLabelsStub);
            sinon.assert.calledOnceWithExactly(createLabelsStub, [
                'autorelease: pending',
                'autorelease: tagged',
                'autorelease: pre-release',
            ]);
        });
        (0, mocha_1.it)('reopens snoozed, closed pull request if there are changes', async () => {
            sandbox
                .stub(github, 'getFileContentsOnBranch')
                .withArgs('README.md', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)('some-content'));
            sandbox
                .stub(github, 'createPullRequest')
                .withArgs(sinon.match.has('headBranchName', 'release-please/branches/main'), 'main', 'main', sinon.match.string, sinon.match.array, sinon.match({ fork: false, draft: false }))
                .resolves({
                number: 22,
                title: 'pr title1',
                body: 'pr body1',
                headBranchName: 'release-please/branches/main',
                baseBranchName: 'main',
                labels: [],
                files: [],
            });
            mockPullRequests(github, [], [], [
                {
                    number: 22,
                    title: 'pr title1',
                    body: new pull_request_body_1.PullRequestBody([]).toString(),
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    labels: ['autorelease: pending', 'autorelease: snooze'],
                    files: [],
                },
            ]);
            sandbox
                .stub(github, 'updatePullRequest')
                .withArgs(22, sinon.match.any, sinon.match.any, sinon.match.any)
                .resolves({
                number: 22,
                title: 'pr title1',
                body: 'pr body1',
                headBranchName: 'release-please/branches/main',
                baseBranchName: 'main',
                labels: [],
                files: [],
            });
            const manifest = new manifest_1.Manifest(github, 'main', {
                'path/a': {
                    releaseType: 'node',
                    component: 'pkg1',
                },
                'path/b': {
                    releaseType: 'node',
                    component: 'pkg2',
                },
            }, {
                'path/a': version_1.Version.parse('1.0.0'),
                'path/b': version_1.Version.parse('0.2.3'),
            }, {
                separatePullRequests: true,
                plugins: ['node-workspace'],
            });
            sandbox.stub(manifest, 'buildPullRequests').resolves([
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body: new pull_request_body_1.PullRequestBody([
                        {
                            notes: 'Some release notes',
                        },
                    ]),
                    updates: [
                        {
                            path: 'README.md',
                            createIfMissing: false,
                            updater: new raw_content_1.RawContent('some raw content'),
                        },
                    ],
                    labels: [],
                    headRefName: 'release-please/branches/main',
                    draft: false,
                    conventionalCommits: [],
                },
            ]);
            const removeLabelsStub = sandbox
                .stub(github, 'removeIssueLabels')
                .resolves();
            const getLabelsStub = sandbox
                .stub(github, 'getLabels')
                .resolves(['label-a', 'label-b']);
            const createLabelsStub = sandbox.stub(github, 'createLabels').resolves();
            const pullRequestNumbers = await manifest.createPullRequests();
            (0, chai_1.expect)(pullRequestNumbers).lengthOf(1);
            sinon.assert.calledOnce(getLabelsStub);
            sinon.assert.calledOnceWithExactly(createLabelsStub, [
                'autorelease: pending',
                'autorelease: tagged',
                'autorelease: pre-release',
            ]);
            sinon.assert.calledOnce(removeLabelsStub);
        });
        (0, mocha_1.it)('ignores snoozed, closed pull request if there are no changes', async () => {
            const body = new pull_request_body_1.PullRequestBody([
                {
                    notes: '## 1.1.0\n\nSome release notes',
                },
            ]);
            sandbox
                .stub(github, 'getFileContentsOnBranch')
                .withArgs('README.md', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)('some-content'));
            mockPullRequests(github, [], [], [
                {
                    number: 22,
                    title: 'pr title1',
                    body: body.toString(),
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    labels: ['autorelease: closed', 'autorelease: snooze'],
                    files: [],
                },
            ]);
            const manifest = new manifest_1.Manifest(github, 'main', {
                'path/a': {
                    releaseType: 'node',
                    component: 'pkg1',
                },
                'path/b': {
                    releaseType: 'node',
                    component: 'pkg2',
                },
            }, {
                'path/a': version_1.Version.parse('1.0.0'),
                'path/b': version_1.Version.parse('0.2.3'),
            }, {
                separatePullRequests: true,
                plugins: ['node-workspace'],
            });
            sandbox.stub(manifest, 'buildPullRequests').resolves([
                {
                    title: pull_request_title_1.PullRequestTitle.ofTargetBranch('main', 'main'),
                    body,
                    updates: [
                        {
                            path: 'README.md',
                            createIfMissing: false,
                            updater: new raw_content_1.RawContent('some raw content'),
                        },
                    ],
                    labels: [],
                    headRefName: 'release-please/branches/main',
                    draft: false,
                    conventionalCommits: [],
                },
            ]);
            const getLabelsStub = sandbox
                .stub(github, 'getLabels')
                .resolves(['label-a', 'label-b']);
            const createLabelsStub = sandbox.stub(github, 'createLabels').resolves();
            const pullRequestNumbers = await manifest.createPullRequests();
            (0, chai_1.expect)(pullRequestNumbers).lengthOf(0);
            sinon.assert.calledOnce(getLabelsStub);
            sinon.assert.calledOnceWithExactly(createLabelsStub, [
                'autorelease: pending',
                'autorelease: tagged',
                'autorelease: pre-release',
            ]);
        });
    });
    (0, mocha_1.describe)('buildReleases', () => {
        (0, mocha_1.it)('should handle a single manifest release', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore: release main',
                    body: pullRequestBody('release-notes/single-manifest.txt'),
                    labels: ['autorelease: pending'],
                    files: [],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox
                .stub(github, 'getFileContentsOnBranch')
                .withArgs('package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-cloud/release-brancher' })));
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'node',
                },
            }, {
                '.': version_1.Version.parse('1.3.1'),
            });
            const releases = await manifest.buildReleases();
            (0, chai_1.expect)(releases).lengthOf(1);
            (0, chai_1.expect)(releases[0].tag.toString()).to.eql('release-brancher-v1.3.1');
            (0, chai_1.expect)(releases[0].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[0].notes)
                .to.be.a('string')
                .and.satisfy((msg) => msg.startsWith('### Bug Fixes'));
            (0, chai_1.expect)(releases[0].path).to.eql('.');
            (0, chai_1.expect)(releases[0].name).to.eql('release-brancher: v1.3.1');
            (0, chai_1.expect)(releases[0].draft).to.be.undefined;
            (0, chai_1.expect)(releases[0].prerelease).to.be.undefined;
            sinon.assert.calledOnce(getFileContentsStub);
        });
        (0, mocha_1.it)('should handle a multiple manifest release', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore: release main',
                    body: pullRequestBody('release-notes/multiple.txt'),
                    labels: ['autorelease: pending'],
                    files: [
                        'packages/bot-config-utils/package.json',
                        'packages/label-utils/package.json',
                        'packages/object-selector/package.json',
                        'packages/datastore-lock/package.json',
                    ],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('packages/bot-config-utils/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/bot-config-utils' })))
                .withArgs('packages/label-utils/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/label-utils' })))
                .withArgs('packages/object-selector/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/object-selector' })))
                .withArgs('packages/datastore-lock/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/datastore-lock' })));
            const manifest = new manifest_1.Manifest(github, 'main', {
                'packages/bot-config-utils': {
                    releaseType: 'node',
                },
                'packages/label-utils': {
                    releaseType: 'node',
                },
                'packages/object-selector': {
                    releaseType: 'node',
                },
                'packages/datastore-lock': {
                    releaseType: 'node',
                },
            }, {
                'packages/bot-config-utils': version_1.Version.parse('3.1.4'),
                'packages/label-utils': version_1.Version.parse('1.0.1'),
                'packages/object-selector': version_1.Version.parse('1.0.2'),
                'packages/datastore-lock': version_1.Version.parse('2.0.0'),
            });
            const releases = await manifest.buildReleases();
            (0, chai_1.expect)(releases).lengthOf(4);
            (0, chai_1.expect)(releases[0].tag.toString()).to.eql('bot-config-utils-v3.2.0');
            (0, chai_1.expect)(releases[0].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[0].notes)
                .to.be.a('string')
                .and.satisfy((msg) => msg.startsWith('### Features'));
            (0, chai_1.expect)(releases[0].path).to.eql('packages/bot-config-utils');
            (0, chai_1.expect)(releases[0].name).to.eql('bot-config-utils: v3.2.0');
            (0, chai_1.expect)(releases[1].tag.toString()).to.eql('label-utils-v1.1.0');
            (0, chai_1.expect)(releases[1].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[1].notes)
                .to.be.a('string')
                .and.satisfy((msg) => msg.startsWith('### Features'));
            (0, chai_1.expect)(releases[1].path).to.eql('packages/label-utils');
            (0, chai_1.expect)(releases[1].name).to.eql('label-utils: v1.1.0');
            (0, chai_1.expect)(releases[2].tag.toString()).to.eql('object-selector-v1.1.0');
            (0, chai_1.expect)(releases[2].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[2].notes)
                .to.be.a('string')
                .and.satisfy((msg) => msg.startsWith('### Features'));
            (0, chai_1.expect)(releases[2].path).to.eql('packages/object-selector');
            (0, chai_1.expect)(releases[2].name).to.eql('object-selector: v1.1.0');
            (0, chai_1.expect)(releases[3].tag.toString()).to.eql('datastore-lock-v2.1.0');
            (0, chai_1.expect)(releases[3].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[3].notes)
                .to.be.a('string')
                .and.satisfy((msg) => msg.startsWith('### Features'));
            (0, chai_1.expect)(releases[3].path).to.eql('packages/datastore-lock');
            (0, chai_1.expect)(releases[3].name).to.eql('datastore-lock: v2.1.0');
        });
        (0, mocha_1.it)('should handle a mixed manifest release', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore: release main',
                    body: pullRequestBody('release-notes/mixed-componentless-manifest.txt'),
                    labels: ['autorelease: pending'],
                    files: [
                        'packages/bot-config-utils/package.json',
                        'packages/label-utils/package.json',
                    ],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('packages/bot-config-utils/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/bot-config-utils' })))
                .withArgs('packages/label-utils/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/label-utils' })));
            const manifest = new manifest_1.Manifest(github, 'main', {
                'packages/bot-config-utils': {
                    releaseType: 'node',
                    includeComponentInTag: false,
                },
                'packages/label-utils': {
                    releaseType: 'node',
                },
            }, {
                'packages/bot-config-utils': version_1.Version.parse('3.1.4'),
                'packages/label-utils': version_1.Version.parse('1.0.1'),
            });
            const releases = await manifest.buildReleases();
            (0, chai_1.expect)(releases).lengthOf(2);
            (0, chai_1.expect)(releases[0].tag.toString()).to.eql('v3.2.0');
            (0, chai_1.expect)(releases[0].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[0].notes)
                .to.be.a('string')
                .and.satisfy((msg) => msg.startsWith('### Features'));
            (0, chai_1.expect)(releases[0].path).to.eql('packages/bot-config-utils');
            (0, chai_1.expect)(releases[0].name).to.eql('v3.2.0');
            (0, chai_1.expect)(releases[1].tag.toString()).to.eql('label-utils-v1.1.0');
            (0, chai_1.expect)(releases[1].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[1].notes)
                .to.be.a('string')
                .and.satisfy((msg) => msg.startsWith('### Features'));
            (0, chai_1.expect)(releases[1].path).to.eql('packages/label-utils');
            (0, chai_1.expect)(releases[1].name).to.eql('label-utils: v1.1.0');
        });
        (0, mocha_1.it)('should handle a single standalone release', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please--branches--main',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore(main): release 3.2.7',
                    body: pullRequestBody('release-notes/single.txt'),
                    labels: ['autorelease: pending'],
                    files: [],
                    sha: 'abc123',
                },
            ]);
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'simple',
                },
            }, {
                '.': version_1.Version.parse('3.2.6'),
            });
            const releases = await manifest.buildReleases();
            (0, chai_1.expect)(releases).lengthOf(1);
            (0, chai_1.expect)(releases[0].tag.toString()).to.eql('v3.2.7');
            (0, chai_1.expect)(releases[0].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[0].notes)
                .to.be.a('string')
                .and.satisfy((msg) => msg.startsWith('### [3.2.7]'));
            (0, chai_1.expect)(releases[0].path).to.eql('.');
            (0, chai_1.expect)(releases[0].name).to.eql('v3.2.7');
            (0, chai_1.expect)(releases[0].draft).to.be.undefined;
            (0, chai_1.expect)(releases[0].prerelease).to.be.undefined;
        });
        (0, mocha_1.it)('should handle a single component release', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please--branches--main--components--foo',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore(main): release 3.2.7',
                    body: pullRequestBody('release-notes/single.txt'),
                    labels: ['autorelease: pending'],
                    files: [],
                    sha: 'abc123',
                },
            ]);
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'simple',
                    component: 'foo',
                    includeComponentInTag: false,
                },
            }, {
                '.': version_1.Version.parse('3.2.6'),
            });
            const releases = await manifest.buildReleases();
            (0, chai_1.expect)(releases).lengthOf(1);
            (0, chai_1.expect)(releases[0].tag.toString()).to.eql('v3.2.7');
            (0, chai_1.expect)(releases[0].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[0].notes)
                .to.be.a('string')
                .and.satisfy((msg) => msg.startsWith('### [3.2.7]'));
            (0, chai_1.expect)(releases[0].path).to.eql('.');
            (0, chai_1.expect)(releases[0].name).to.eql('v3.2.7');
            (0, chai_1.expect)(releases[0].draft).to.be.undefined;
            (0, chai_1.expect)(releases[0].prerelease).to.be.undefined;
        });
        (0, mocha_1.it)('should allow skipping releases', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore: release main',
                    body: pullRequestBody('release-notes/multiple.txt'),
                    labels: ['autorelease: pending'],
                    files: [
                        'packages/bot-config-utils/package.json',
                        'packages/label-utils/package.json',
                        'packages/object-selector/package.json',
                        'packages/datastore-lock/package.json',
                    ],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('packages/bot-config-utils/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/bot-config-utils' })))
                .withArgs('packages/label-utils/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/label-utils' })))
                .withArgs('packages/object-selector/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/object-selector' })))
                .withArgs('packages/datastore-lock/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/datastore-lock' })));
            const manifest = new manifest_1.Manifest(github, 'main', {
                'packages/bot-config-utils': {
                    releaseType: 'node',
                },
                'packages/label-utils': {
                    releaseType: 'node',
                },
                'packages/object-selector': {
                    releaseType: 'node',
                    skipGithubRelease: true,
                },
                'packages/datastore-lock': {
                    releaseType: 'node',
                },
            }, {
                'packages/bot-config-utils': version_1.Version.parse('3.1.4'),
                'packages/label-utils': version_1.Version.parse('1.0.1'),
                'packages/object-selector': version_1.Version.parse('1.0.2'),
                'packages/datastore-lock': version_1.Version.parse('2.0.0'),
            });
            const releases = await manifest.buildReleases();
            (0, chai_1.expect)(releases).lengthOf(3);
            (0, chai_1.expect)(releases[0].tag.toString()).to.eql('bot-config-utils-v3.2.0');
            (0, chai_1.expect)(releases[0].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[0].notes)
                .to.be.a('string')
                .and.satisfy((msg) => msg.startsWith('### Features'));
            (0, chai_1.expect)(releases[1].tag.toString()).to.eql('label-utils-v1.1.0');
            (0, chai_1.expect)(releases[1].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[1].notes)
                .to.be.a('string')
                .and.satisfy((msg) => msg.startsWith('### Features'));
            (0, chai_1.expect)(releases[2].tag.toString()).to.eql('datastore-lock-v2.1.0');
            (0, chai_1.expect)(releases[2].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[2].notes)
                .to.be.a('string')
                .and.satisfy((msg) => msg.startsWith('### Features'));
        });
        (0, mocha_1.it)('should build draft releases', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore: release main',
                    body: pullRequestBody('release-notes/single-manifest.txt'),
                    labels: ['autorelease: pending'],
                    files: [],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-cloud/release-brancher' })));
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'node',
                    draft: true,
                },
            }, {
                '.': version_1.Version.parse('1.3.1'),
            });
            const releases = await manifest.buildReleases();
            (0, chai_1.expect)(releases).lengthOf(1);
            (0, chai_1.expect)(releases[0].name).to.eql('release-brancher: v1.3.1');
            (0, chai_1.expect)(releases[0].draft).to.be.true;
            (0, chai_1.expect)(releases[0].prerelease).to.be.undefined;
        });
        (0, mocha_1.it)('should build draft releases manifest wide', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore: release main',
                    body: pullRequestBody('release-notes/single-manifest.txt'),
                    labels: ['autorelease: pending'],
                    files: [],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-cloud/release-brancher' })));
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'node',
                },
            }, {
                '.': version_1.Version.parse('1.3.1'),
            }, {
                draft: true,
            });
            const releases = await manifest.buildReleases();
            (0, chai_1.expect)(releases).lengthOf(1);
            (0, chai_1.expect)(releases[0].name).to.eql('release-brancher: v1.3.1');
            (0, chai_1.expect)(releases[0].draft).to.be.true;
            (0, chai_1.expect)(releases[0].prerelease).to.be.undefined;
        });
        (0, mocha_1.it)('should build prerelease releases from beta', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore: release main',
                    body: pullRequestBody('release-notes/single-manifest-prerelease.txt'),
                    labels: ['autorelease: pending'],
                    files: [''],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-cloud/release-brancher' })));
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'node',
                    prerelease: true,
                },
            }, {
                '.': version_1.Version.parse('1.3.0'),
            });
            const releases = await manifest.buildReleases();
            (0, chai_1.expect)(releases).lengthOf(1);
            (0, chai_1.expect)(releases[0].name).to.eql('release-brancher: v1.3.1-beta1');
            (0, chai_1.expect)(releases[0].draft).to.be.undefined;
            (0, chai_1.expect)(releases[0].prerelease).to.be.true;
            (0, chai_1.expect)(releases[0].tag.toString()).to.eql('release-brancher-v1.3.1-beta1');
        });
        (0, mocha_1.it)('should not build prerelease releases from pre-major', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore: release main',
                    body: pullRequestBody('release-notes/single-manifest-pre-major.txt'),
                    labels: ['autorelease: pending'],
                    files: [''],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-cloud/release-brancher' })));
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'node',
                    prerelease: true,
                },
            }, {
                '.': version_1.Version.parse('0.1.0'),
            });
            const releases = await manifest.buildReleases();
            (0, chai_1.expect)(releases).lengthOf(1);
            (0, chai_1.expect)(releases[0].name).to.eql('release-brancher: v0.2.0');
            (0, chai_1.expect)(releases[0].draft).to.be.undefined;
            (0, chai_1.expect)(releases[0].prerelease).to.be.false;
            (0, chai_1.expect)(releases[0].tag.toString()).to.eql('release-brancher-v0.2.0');
        });
        (0, mocha_1.it)('should build prerelease releases from pre-major if the pre-release label is applied', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore: release main',
                    body: pullRequestBody('release-notes/single-manifest-pre-major.txt'),
                    labels: ['autorelease: pending', 'autorelease: pre-release'],
                    files: [''],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-cloud/release-brancher' })));
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'node',
                    prerelease: true,
                },
            }, {
                '.': version_1.Version.parse('0.1.0'),
            });
            const releases = await manifest.buildReleases();
            (0, chai_1.expect)(releases).lengthOf(1);
            (0, chai_1.expect)(releases[0].name).to.eql('release-brancher: v0.2.0');
            (0, chai_1.expect)(releases[0].draft).to.be.undefined;
            (0, chai_1.expect)(releases[0].prerelease).to.be.true;
            (0, chai_1.expect)(releases[0].tag.toString()).to.eql('release-brancher-v0.2.0');
        });
        (0, mocha_1.it)('should not build prerelease releases from non-prerelease', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore: release main',
                    body: pullRequestBody('release-notes/single-manifest.txt'),
                    labels: ['autorelease: pending'],
                    files: [''],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-cloud/release-brancher' })));
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'node',
                    prerelease: true,
                },
            }, {
                '.': version_1.Version.parse('1.3.0'),
            });
            const releases = await manifest.buildReleases();
            (0, chai_1.expect)(releases).lengthOf(1);
            (0, chai_1.expect)(releases[0].name).to.eql('release-brancher: v1.3.1');
            (0, chai_1.expect)(releases[0].draft).to.be.undefined;
            (0, chai_1.expect)(releases[0].prerelease).to.be.false;
            (0, chai_1.expect)(releases[0].tag.toString()).to.eql('release-brancher-v1.3.1');
        });
        (0, mocha_1.it)('should skip component in tag', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please--branches--main--components--release-brancher',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore(main): release v1.3.1',
                    body: pullRequestBody('release-notes/single.txt'),
                    labels: ['autorelease: pending'],
                    files: [],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-cloud/release-brancher' })));
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'node',
                    includeComponentInTag: false,
                },
            }, {
                '.': version_1.Version.parse('1.3.0'),
            });
            const releases = await manifest.buildReleases();
            (0, chai_1.expect)(releases).lengthOf(1);
            (0, chai_1.expect)(releases[0].tag.toString()).to.eql('v1.3.1');
        });
        (0, mocha_1.it)('should handle customized pull request title', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'release: 3.2.7',
                    body: pullRequestBody('release-notes/single.txt'),
                    labels: ['autorelease: pending'],
                    files: [],
                    sha: 'abc123',
                },
            ]);
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'simple',
                    pullRequestTitlePattern: 'release: ${version}',
                },
            }, {
                '.': version_1.Version.parse('3.2.6'),
            });
            const releases = await manifest.buildReleases();
            (0, chai_1.expect)(releases).lengthOf(1);
            (0, chai_1.expect)(releases[0].tag.toString()).to.eql('v3.2.7');
            (0, chai_1.expect)(releases[0].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[0].notes)
                .to.be.a('string')
                .and.satisfy((msg) => msg.startsWith('### [3.2.7]'));
            (0, chai_1.expect)(releases[0].path).to.eql('.');
        });
        (0, mocha_1.it)('should skip component releases for non-component configs', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please--branches--main--components--storage',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore(main): release storage 3.2.7',
                    body: pullRequestBody('release-notes/single.txt'),
                    labels: ['autorelease: pending'],
                    files: [],
                    sha: 'abc123',
                },
            ]);
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'simple',
                    includeComponentInTag: false,
                },
            }, {
                '.': version_1.Version.parse('3.2.6'),
            });
            const releases = await manifest.buildReleases();
            (0, chai_1.expect)(releases).lengthOf(0);
        });
        (0, mocha_1.it)('should handle complex title and base branch', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please--branches--hotfix/v3.1.0-bug--components--my-package-name',
                    baseBranchName: 'hotfix/v3.1.0-bug',
                    number: 1234,
                    title: '[HOTFIX] - chore(hotfix/v3.1.0-bug): release 3.1.0-hotfix1',
                    body: pullRequestBody('release-notes/single.txt'),
                    labels: ['autorelease: pending'],
                    files: [],
                    sha: 'abc123',
                },
            ]);
            const manifest = new manifest_1.Manifest(github, 'hotfix/v3.1.0-bug', {
                '.': {
                    releaseType: 'simple',
                    pullRequestTitlePattern: '[HOTFIX] - chore${scope}: release${component} ${version}',
                    packageName: 'my-package-name',
                    includeComponentInTag: false,
                },
            }, {
                '.': version_1.Version.parse('3.1.0'),
            });
            const releases = await manifest.buildReleases();
            (0, chai_1.expect)(releases).lengthOf(1);
            (0, chai_1.expect)(releases[0].tag.toString()).to.eql('v3.1.0-hotfix1');
            (0, chai_1.expect)(releases[0].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[0].notes).to.be.a('string');
            (0, chai_1.expect)(releases[0].path).to.eql('.');
        });
        (0, mocha_1.it)('should find the correct number of releases with a componentless tag', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please--branches--main',
                    baseBranchName: 'main',
                    number: 2,
                    title: 'chore: release v1.0.1',
                    body: pullRequestBody('release-notes/grouped.txt'),
                    labels: ['autorelease: pending'],
                    files: [],
                    sha: 'abc123',
                },
            ]);
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'simple',
                    pullRequestTitlePattern: 'chore: release v${version}',
                    component: 'base',
                    includeComponentInTag: false,
                },
                api: {
                    releaseType: 'simple',
                    component: 'api',
                },
                chat: {
                    releaseType: 'simple',
                    component: 'chat',
                },
                cmds: {
                    releaseType: 'simple',
                    component: 'cmds',
                },
                presence: {
                    releaseType: 'simple',
                    component: 'presence',
                },
            }, {
                '.': version_1.Version.parse('1.0.0'),
                api: version_1.Version.parse('1.0.0'),
                chat: version_1.Version.parse('1.0.0'),
                cmds: version_1.Version.parse('1.0.0'),
                presence: version_1.Version.parse('1.0.0'),
            }, {
                groupPullRequestTitlePattern: 'chore: release v${version}',
            });
            const releases = await manifest.buildReleases();
            (0, chai_1.expect)(releases).lengthOf(2);
        });
        (0, mocha_1.it)('should handle overflowing release notes', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore: release main',
                    body: pullRequestBody('release-notes/overflow.txt'),
                    labels: ['autorelease: pending'],
                    files: [
                        'packages/bot-config-utils/package.json',
                        'packages/label-utils/package.json',
                        'packages/object-selector/package.json',
                        'packages/datastore-lock/package.json',
                    ],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('packages/bot-config-utils/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/bot-config-utils' })))
                .withArgs('packages/label-utils/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/label-utils' })))
                .withArgs('packages/object-selector/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/object-selector' })))
                .withArgs('packages/datastore-lock/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/datastore-lock' })))
                // This branch is parsed from the overflow PR body
                .withArgs('release-notes.md', 'my-head-branch--release-notes')
                .resolves((0, helpers_1.buildGitHubFileRaw)(pullRequestBody('release-notes/multiple.txt')));
            const manifest = new manifest_1.Manifest(github, 'main', {
                'packages/bot-config-utils': {
                    releaseType: 'node',
                },
                'packages/label-utils': {
                    releaseType: 'node',
                },
                'packages/object-selector': {
                    releaseType: 'node',
                },
                'packages/datastore-lock': {
                    releaseType: 'node',
                },
            }, {
                'packages/bot-config-utils': version_1.Version.parse('3.1.4'),
                'packages/label-utils': version_1.Version.parse('1.0.1'),
                'packages/object-selector': version_1.Version.parse('1.0.2'),
                'packages/datastore-lock': version_1.Version.parse('2.0.0'),
            });
            const releases = await manifest.buildReleases();
            (0, chai_1.expect)(releases).lengthOf(4);
            (0, chai_1.expect)(releases[0].tag.toString()).to.eql('bot-config-utils-v3.2.0');
            (0, chai_1.expect)(releases[0].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[0].notes)
                .to.be.a('string')
                .and.satisfy((msg) => msg.startsWith('### Features'));
            (0, chai_1.expect)(releases[0].path).to.eql('packages/bot-config-utils');
            (0, chai_1.expect)(releases[0].name).to.eql('bot-config-utils: v3.2.0');
            (0, chai_1.expect)(releases[1].tag.toString()).to.eql('label-utils-v1.1.0');
            (0, chai_1.expect)(releases[1].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[1].notes)
                .to.be.a('string')
                .and.satisfy((msg) => msg.startsWith('### Features'));
            (0, chai_1.expect)(releases[1].path).to.eql('packages/label-utils');
            (0, chai_1.expect)(releases[1].name).to.eql('label-utils: v1.1.0');
            (0, chai_1.expect)(releases[2].tag.toString()).to.eql('object-selector-v1.1.0');
            (0, chai_1.expect)(releases[2].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[2].notes)
                .to.be.a('string')
                .and.satisfy((msg) => msg.startsWith('### Features'));
            (0, chai_1.expect)(releases[2].path).to.eql('packages/object-selector');
            (0, chai_1.expect)(releases[2].name).to.eql('object-selector: v1.1.0');
            (0, chai_1.expect)(releases[3].tag.toString()).to.eql('datastore-lock-v2.1.0');
            (0, chai_1.expect)(releases[3].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[3].notes)
                .to.be.a('string')
                .and.satisfy((msg) => msg.startsWith('### Features'));
            (0, chai_1.expect)(releases[3].path).to.eql('packages/datastore-lock');
            (0, chai_1.expect)(releases[3].name).to.eql('datastore-lock: v2.1.0');
        });
    });
    (0, mocha_1.describe)('createReleases', () => {
        (0, mocha_1.it)('should handle a single manifest release', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore: release main',
                    body: pullRequestBody('release-notes/single-manifest.txt'),
                    labels: ['autorelease: pending'],
                    files: [],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-cloud/release-brancher' })));
            mockCreateRelease(github, [
                { id: 123456, sha: 'abc123', tagName: 'release-brancher-v1.3.1' },
            ]);
            const commentStub = sandbox.stub(github, 'commentOnIssue').resolves();
            const addLabelsStub = sandbox.stub(github, 'addIssueLabels').resolves();
            const removeLabelsStub = sandbox
                .stub(github, 'removeIssueLabels')
                .resolves();
            const lockBranchStub = sandbox.stub(github, 'lockBranch').resolves();
            const unlockBranchStub = sandbox.stub(github, 'unlockBranch').resolves();
            const waitForReleaseToBeListedStub = sandbox
                .stub(github, 'waitForReleaseToBeListed')
                .resolves();
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'node',
                },
            }, {
                '.': version_1.Version.parse('1.3.1'),
            });
            const releases = await manifest.createReleases();
            (0, chai_1.expect)(releases).lengthOf(1);
            (0, chai_1.expect)(releases[0].tagName).to.eql('release-brancher-v1.3.1');
            (0, chai_1.expect)(releases[0].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[0].notes).to.eql('some release notes');
            (0, chai_1.expect)(releases[0].path).to.eql('.');
            sinon.assert.calledOnce(commentStub);
            sinon.assert.calledOnceWithExactly(addLabelsStub, ['autorelease: tagged'], 1234);
            sinon.assert.calledOnceWithExactly(removeLabelsStub, ['autorelease: pending'], 1234);
            sinon.assert.calledOnceWithExactly(waitForReleaseToBeListedStub, sinon.match.has('tagName', 'release-brancher-v1.3.1'));
            sinon.assert.calledOnce(lockBranchStub);
            sinon.assert.calledOnce(unlockBranchStub);
        });
        (0, mocha_1.it)('should handle a multiple manifest release', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore: release main',
                    body: pullRequestBody('release-notes/multiple.txt'),
                    labels: ['autorelease: pending'],
                    files: [
                        'packages/bot-config-utils/package.json',
                        'packages/label-utils/package.json',
                        'packages/object-selector/package.json',
                        'packages/datastore-lock/package.json',
                    ],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox
                .stub(github, 'getFileContentsOnBranch')
                .withArgs('packages/bot-config-utils/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/bot-config-utils' })))
                .withArgs('packages/label-utils/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/label-utils' })))
                .withArgs('packages/object-selector/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/object-selector' })))
                .withArgs('packages/datastore-lock/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/datastore-lock' })));
            mockCreateRelease(github, [
                { id: 1, sha: 'abc123', tagName: 'bot-config-utils-v3.2.0' },
                { id: 2, sha: 'abc123', tagName: 'label-utils-v1.1.0' },
                { id: 3, sha: 'abc123', tagName: 'object-selector-v1.1.0' },
                { id: 4, sha: 'abc123', tagName: 'datastore-lock-v2.1.0' },
            ]);
            const commentStub = sandbox.stub(github, 'commentOnIssue').resolves();
            const addLabelsStub = sandbox.stub(github, 'addIssueLabels').resolves();
            const removeLabelsStub = sandbox
                .stub(github, 'removeIssueLabels')
                .resolves();
            const waitForReleaseToBeListedStub = sandbox
                .stub(github, 'waitForReleaseToBeListed')
                .resolves();
            const lockBranchStub = sandbox.stub(github, 'lockBranch').resolves();
            const unlockBranchStub = sandbox.stub(github, 'unlockBranch').resolves();
            const manifest = new manifest_1.Manifest(github, 'main', {
                'packages/bot-config-utils': {
                    releaseType: 'node',
                },
                'packages/label-utils': {
                    releaseType: 'node',
                },
                'packages/object-selector': {
                    releaseType: 'node',
                },
                'packages/datastore-lock': {
                    releaseType: 'node',
                },
            }, {
                'packages/bot-config-utils': version_1.Version.parse('3.1.4'),
                'packages/label-utils': version_1.Version.parse('1.0.1'),
                'packages/object-selector': version_1.Version.parse('1.0.2'),
                'packages/datastore-lock': version_1.Version.parse('2.0.0'),
            });
            const releases = await manifest.createReleases();
            (0, chai_1.expect)(releases).lengthOf(4);
            (0, chai_1.expect)(releases[0].tagName).to.eql('bot-config-utils-v3.2.0');
            (0, chai_1.expect)(releases[0].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[0].notes).to.be.string;
            (0, chai_1.expect)(releases[0].path).to.eql('packages/bot-config-utils');
            (0, chai_1.expect)(releases[1].tagName).to.eql('label-utils-v1.1.0');
            (0, chai_1.expect)(releases[1].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[1].notes).to.be.string;
            (0, chai_1.expect)(releases[1].path).to.eql('packages/label-utils');
            (0, chai_1.expect)(releases[2].tagName).to.eql('object-selector-v1.1.0');
            (0, chai_1.expect)(releases[2].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[2].notes).to.be.string;
            (0, chai_1.expect)(releases[2].path).to.eql('packages/object-selector');
            (0, chai_1.expect)(releases[3].tagName).to.eql('datastore-lock-v2.1.0');
            (0, chai_1.expect)(releases[3].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[3].notes).to.be.string;
            (0, chai_1.expect)(releases[3].path).to.eql('packages/datastore-lock');
            sinon.assert.callCount(commentStub, 4);
            sinon.assert.calledOnceWithExactly(addLabelsStub, ['autorelease: tagged'], 1234);
            sinon.assert.calledOnceWithExactly(removeLabelsStub, ['autorelease: pending'], 1234);
            sinon.assert.calledWith(waitForReleaseToBeListedStub, sinon.match.has('tagName', 'bot-config-utils-v3.2.0'));
            sinon.assert.calledWith(waitForReleaseToBeListedStub, sinon.match.has('tagName', 'label-utils-v1.1.0'));
            sinon.assert.calledWith(waitForReleaseToBeListedStub, sinon.match.has('tagName', 'object-selector-v1.1.0'));
            sinon.assert.calledWith(waitForReleaseToBeListedStub, sinon.match.has('tagName', 'datastore-lock-v2.1.0'));
            sinon.assert.calledOnce(lockBranchStub);
            sinon.assert.calledOnce(unlockBranchStub);
            sinon.assert.calledOnce(getFileContentsStub);
        });
        (0, mocha_1.it)('should handle a single standalone release', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore(main): release 3.2.7',
                    body: pullRequestBody('release-notes/single.txt'),
                    labels: ['autorelease: pending'],
                    files: [],
                    sha: 'abc123',
                },
            ]);
            const addLabelsStub = sandbox.stub(github, 'addIssueLabels').resolves();
            const removeLabelsStub = sandbox
                .stub(github, 'removeIssueLabels')
                .resolves();
            const lockBranchStub = sandbox.stub(github, 'lockBranch').resolves();
            const unlockBranchStub = sandbox.stub(github, 'unlockBranch').resolves();
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'simple',
                },
            }, {
                '.': version_1.Version.parse('3.2.6'),
            });
            mockCreateRelease(github, [
                { id: 123456, sha: 'abc123', tagName: 'v3.2.7' },
            ]);
            const commentStub = sandbox.stub(github, 'commentOnIssue').resolves();
            const waitForReleaseToBeListedStub = sandbox
                .stub(github, 'waitForReleaseToBeListed')
                .resolves();
            const releases = await manifest.createReleases();
            (0, chai_1.expect)(releases).lengthOf(1);
            (0, chai_1.expect)(releases[0].tagName).to.eql('v3.2.7');
            (0, chai_1.expect)(releases[0].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[0].notes).to.be.string;
            (0, chai_1.expect)(releases[0].path).to.eql('.');
            sinon.assert.calledOnce(commentStub);
            sinon.assert.calledOnceWithExactly(addLabelsStub, ['autorelease: tagged'], 1234);
            sinon.assert.calledOnceWithExactly(removeLabelsStub, ['autorelease: pending'], 1234);
            sinon.assert.calledWith(waitForReleaseToBeListedStub, sinon.match.has('tagName', 'v3.2.7'));
            sinon.assert.calledOnce(lockBranchStub);
            sinon.assert.calledOnce(unlockBranchStub);
        });
        (0, mocha_1.it)('should allow customizing pull request labels', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore: release main',
                    body: pullRequestBody('release-notes/single-manifest.txt'),
                    labels: ['some-pull-request-label'],
                    files: [],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-cloud/release-brancher' })));
            mockCreateRelease(github, [
                { id: 123456, sha: 'abc123', tagName: 'release-brancher-v1.3.1' },
            ]);
            const commentStub = sandbox.stub(github, 'commentOnIssue').resolves();
            const addLabelsStub = sandbox.stub(github, 'addIssueLabels').resolves();
            const removeLabelsStub = sandbox
                .stub(github, 'removeIssueLabels')
                .resolves();
            const waitForReleaseToBeListedStub = sandbox
                .stub(github, 'waitForReleaseToBeListed')
                .resolves();
            const lockBranchStub = sandbox.stub(github, 'lockBranch').resolves();
            const unlockBranchStub = sandbox.stub(github, 'unlockBranch').resolves();
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'node',
                },
            }, {
                '.': version_1.Version.parse('1.3.1'),
            }, {
                labels: ['some-pull-request-label'],
                releaseLabels: ['some-tagged-label'],
                prereleaseLabels: ['some-prerelease-label'],
            });
            const releases = await manifest.createReleases();
            (0, chai_1.expect)(releases).lengthOf(1);
            (0, chai_1.expect)(releases[0].tagName).to.eql('release-brancher-v1.3.1');
            (0, chai_1.expect)(releases[0].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[0].notes).to.eql('some release notes');
            sinon.assert.calledOnce(commentStub);
            sinon.assert.calledOnceWithExactly(addLabelsStub, ['some-tagged-label'], 1234);
            sinon.assert.calledOnceWithExactly(removeLabelsStub, ['some-pull-request-label'], 1234);
            sinon.assert.calledWith(waitForReleaseToBeListedStub, sinon.match.has('tagName', 'release-brancher-v1.3.1'));
            sinon.assert.calledOnce(lockBranchStub);
            sinon.assert.calledOnce(unlockBranchStub);
        });
        (0, mocha_1.it)('should create a draft release', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore: release main',
                    body: pullRequestBody('release-notes/single-manifest.txt'),
                    labels: ['autorelease: pending'],
                    files: [],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-cloud/release-brancher' })));
            const githubReleaseStub = mockCreateRelease(github, [
                {
                    id: 123456,
                    sha: 'abc123',
                    tagName: 'release-brancher-v1.3.1',
                    draft: true,
                },
            ]);
            const commentStub = sandbox.stub(github, 'commentOnIssue').resolves();
            const addLabelsStub = sandbox.stub(github, 'addIssueLabels').resolves();
            const removeLabelsStub = sandbox
                .stub(github, 'removeIssueLabels')
                .resolves();
            const waitForReleaseToBeListedStub = sandbox
                .stub(github, 'waitForReleaseToBeListed')
                .resolves();
            const lockBranchStub = sandbox.stub(github, 'lockBranch').resolves();
            const unlockBranchStub = sandbox.stub(github, 'unlockBranch').resolves();
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'node',
                    draft: true,
                },
            }, {
                '.': version_1.Version.parse('1.3.1'),
            });
            const releases = await manifest.createReleases();
            (0, chai_1.expect)(releases).lengthOf(1);
            (0, chai_1.expect)(releases[0].tagName).to.eql('release-brancher-v1.3.1');
            (0, chai_1.expect)(releases[0].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[0].notes).to.eql('some release notes');
            (0, chai_1.expect)(releases[0].draft).to.be.true;
            sinon.assert.calledOnceWithExactly(githubReleaseStub, sinon.match.any, {
                draft: true,
                prerelease: undefined,
            });
            sinon.assert.calledOnce(commentStub);
            sinon.assert.calledOnceWithExactly(addLabelsStub, ['autorelease: tagged'], 1234);
            sinon.assert.calledOnceWithExactly(removeLabelsStub, ['autorelease: pending'], 1234);
            sinon.assert.calledWith(waitForReleaseToBeListedStub, sinon.match.has('tagName', 'release-brancher-v1.3.1'));
            sinon.assert.calledOnce(lockBranchStub);
            sinon.assert.calledOnce(unlockBranchStub);
        });
        (0, mocha_1.it)('should create a prerelease release from beta', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore: release main',
                    body: pullRequestBody('release-notes/single-manifest-prerelease.txt'),
                    labels: ['autorelease: pending'],
                    files: [],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-cloud/release-brancher' })));
            const githubReleaseStub = mockCreateRelease(github, [
                {
                    id: 123456,
                    sha: 'abc123',
                    tagName: 'release-brancher-v1.3.1-beta1',
                    prerelease: true,
                },
            ]);
            const commentStub = sandbox.stub(github, 'commentOnIssue').resolves();
            const addLabelsStub = sandbox.stub(github, 'addIssueLabels').resolves();
            const removeLabelsStub = sandbox
                .stub(github, 'removeIssueLabels')
                .resolves();
            const waitForReleaseToBeListedStub = sandbox
                .stub(github, 'waitForReleaseToBeListed')
                .resolves();
            const lockBranchStub = sandbox.stub(github, 'lockBranch').resolves();
            const unlockBranchStub = sandbox.stub(github, 'unlockBranch').resolves();
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'node',
                    prerelease: true,
                },
            }, {
                '.': version_1.Version.parse('1.3.1'),
            });
            const releases = await manifest.createReleases();
            (0, chai_1.expect)(releases).lengthOf(1);
            (0, chai_1.expect)(releases[0].tagName).to.eql('release-brancher-v1.3.1-beta1');
            (0, chai_1.expect)(releases[0].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[0].notes).to.eql('some release notes');
            (0, chai_1.expect)(releases[0].draft).to.be.undefined;
            sinon.assert.calledOnceWithExactly(githubReleaseStub, sinon.match.any, {
                draft: undefined,
                prerelease: true,
            });
            sinon.assert.calledOnce(commentStub);
            sinon.assert.calledOnceWithExactly(addLabelsStub, ['autorelease: tagged', 'autorelease: pre-release'], 1234);
            sinon.assert.calledOnceWithExactly(removeLabelsStub, ['autorelease: pending'], 1234);
            sinon.assert.calledWith(waitForReleaseToBeListedStub, sinon.match.has('tagName', 'release-brancher-v1.3.1-beta1'));
            sinon.assert.calledOnce(lockBranchStub);
            sinon.assert.calledOnce(unlockBranchStub);
        });
        (0, mocha_1.it)('should not create a prerelease release from non-prerelease', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore: release main',
                    body: pullRequestBody('release-notes/single-manifest.txt'),
                    labels: ['autorelease: pending'],
                    files: [],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-cloud/release-brancher' })));
            const githubReleaseStub = mockCreateRelease(github, [
                {
                    id: 123456,
                    sha: 'abc123',
                    tagName: 'release-brancher-v1.3.1',
                    prerelease: false,
                },
            ]);
            const commentStub = sandbox.stub(github, 'commentOnIssue').resolves();
            const addLabelsStub = sandbox.stub(github, 'addIssueLabels').resolves();
            const removeLabelsStub = sandbox
                .stub(github, 'removeIssueLabels')
                .resolves();
            const waitForReleaseToBeListedStub = sandbox
                .stub(github, 'waitForReleaseToBeListed')
                .resolves();
            const lockBranchStub = sandbox.stub(github, 'lockBranch').resolves();
            const unlockBranchStub = sandbox.stub(github, 'unlockBranch').resolves();
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'node',
                    prerelease: true,
                },
            }, {
                '.': version_1.Version.parse('1.3.1'),
            });
            const releases = await manifest.createReleases();
            (0, chai_1.expect)(releases).lengthOf(1);
            (0, chai_1.expect)(releases[0].tagName).to.eql('release-brancher-v1.3.1');
            (0, chai_1.expect)(releases[0].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[0].notes).to.eql('some release notes');
            (0, chai_1.expect)(releases[0].draft).to.be.undefined;
            sinon.assert.calledOnceWithExactly(githubReleaseStub, sinon.match.any, {
                draft: undefined,
                prerelease: false,
            });
            sinon.assert.calledOnce(commentStub);
            sinon.assert.calledOnceWithExactly(addLabelsStub, ['autorelease: tagged'], 1234);
            sinon.assert.calledOnceWithExactly(removeLabelsStub, ['autorelease: pending'], 1234);
            sinon.assert.calledWith(waitForReleaseToBeListedStub, sinon.match.has('tagName', 'release-brancher-v1.3.1'));
            sinon.assert.calledOnce(lockBranchStub);
            sinon.assert.calledOnce(unlockBranchStub);
        });
        (0, mocha_1.it)('should create a prerelease when pull request labelled as pre-release', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore: release main',
                    body: pullRequestBody('release-notes/single-manifest.txt'),
                    labels: ['autorelease: pending', 'autorelease: pre-release'],
                    files: [],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-cloud/release-brancher' })));
            const githubReleaseStub = mockCreateRelease(github, [
                {
                    id: 123456,
                    sha: 'abc123',
                    tagName: 'release-brancher-v1.3.1',
                    prerelease: true,
                },
            ]);
            const commentStub = sandbox.stub(github, 'commentOnIssue').resolves();
            const addLabelsStub = sandbox.stub(github, 'addIssueLabels').resolves();
            const removeLabelsStub = sandbox
                .stub(github, 'removeIssueLabels')
                .resolves();
            const waitForReleaseToBeListedStub = sandbox
                .stub(github, 'waitForReleaseToBeListed')
                .resolves();
            const lockBranchStub = sandbox.stub(github, 'lockBranch').resolves();
            const unlockBranchStub = sandbox.stub(github, 'unlockBranch').resolves();
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'node',
                },
            }, {
                '.': version_1.Version.parse('1.3.1'),
            });
            const releases = await manifest.createReleases();
            (0, chai_1.expect)(releases).lengthOf(1);
            (0, chai_1.expect)(releases[0].tagName).to.eql('release-brancher-v1.3.1');
            (0, chai_1.expect)(releases[0].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[0].notes).to.eql('some release notes');
            (0, chai_1.expect)(releases[0].draft).to.be.undefined;
            sinon.assert.calledOnceWithExactly(githubReleaseStub, sinon.match.any, {
                draft: undefined,
                prerelease: true,
            });
            sinon.assert.calledOnce(commentStub);
            sinon.assert.calledOnceWithExactly(addLabelsStub, ['autorelease: tagged', 'autorelease: pre-release'], 1234);
            sinon.assert.calledOnceWithExactly(removeLabelsStub, ['autorelease: pending'], 1234);
            sinon.assert.calledWith(waitForReleaseToBeListedStub, sinon.match.has('tagName', 'release-brancher-v1.3.1'));
            sinon.assert.calledOnce(lockBranchStub);
            sinon.assert.calledOnce(unlockBranchStub);
        });
        (0, mocha_1.it)('should handle partially failed manifest release', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore: release main',
                    body: pullRequestBody('release-notes/multiple.txt'),
                    labels: ['autorelease: pending'],
                    files: [
                        'packages/bot-config-utils/package.json',
                        'packages/label-utils/package.json',
                        'packages/object-selector/package.json',
                        'packages/datastore-lock/package.json',
                    ],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('packages/bot-config-utils/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/bot-config-utils' })))
                .withArgs('packages/label-utils/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/label-utils' })))
                .withArgs('packages/object-selector/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/object-selector' })))
                .withArgs('packages/datastore-lock/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/datastore-lock' })));
            mockCreateRelease(github, [
                {
                    id: 1,
                    sha: 'abc123',
                    tagName: 'bot-config-utils-v3.2.0',
                    duplicate: true,
                },
                { id: 2, sha: 'abc123', tagName: 'label-utils-v1.1.0' },
                { id: 3, sha: 'abc123', tagName: 'object-selector-v1.1.0' },
                { id: 4, sha: 'abc123', tagName: 'datastore-lock-v2.1.0' },
            ]);
            const commentStub = sandbox.stub(github, 'commentOnIssue').resolves();
            const addLabelsStub = sandbox.stub(github, 'addIssueLabels').resolves();
            const removeLabelsStub = sandbox
                .stub(github, 'removeIssueLabels')
                .resolves();
            const waitForReleaseToBeListedStub = sandbox
                .stub(github, 'waitForReleaseToBeListed')
                .resolves();
            const lockBranchStub = sandbox.stub(github, 'lockBranch').resolves();
            const unlockBranchStub = sandbox.stub(github, 'unlockBranch').resolves();
            const manifest = new manifest_1.Manifest(github, 'main', {
                'packages/bot-config-utils': {
                    releaseType: 'node',
                },
                'packages/label-utils': {
                    releaseType: 'node',
                },
                'packages/object-selector': {
                    releaseType: 'node',
                },
                'packages/datastore-lock': {
                    releaseType: 'node',
                },
            }, {
                'packages/bot-config-utils': version_1.Version.parse('3.1.4'),
                'packages/label-utils': version_1.Version.parse('1.0.1'),
                'packages/object-selector': version_1.Version.parse('1.0.2'),
                'packages/datastore-lock': version_1.Version.parse('2.0.0'),
            });
            const releases = await manifest.createReleases();
            (0, chai_1.expect)(releases).lengthOf(3);
            (0, chai_1.expect)(releases[0].tagName).to.eql('label-utils-v1.1.0');
            (0, chai_1.expect)(releases[0].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[0].notes).to.be.string;
            (0, chai_1.expect)(releases[0].path).to.eql('packages/label-utils');
            (0, chai_1.expect)(releases[1].tagName).to.eql('object-selector-v1.1.0');
            (0, chai_1.expect)(releases[1].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[1].notes).to.be.string;
            (0, chai_1.expect)(releases[1].path).to.eql('packages/object-selector');
            (0, chai_1.expect)(releases[2].tagName).to.eql('datastore-lock-v2.1.0');
            (0, chai_1.expect)(releases[2].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[2].notes).to.be.string;
            (0, chai_1.expect)(releases[2].path).to.eql('packages/datastore-lock');
            sinon.assert.callCount(commentStub, 3);
            sinon.assert.calledOnceWithExactly(addLabelsStub, ['autorelease: tagged'], 1234);
            sinon.assert.calledOnceWithExactly(removeLabelsStub, ['autorelease: pending'], 1234);
            sinon.assert.calledWith(waitForReleaseToBeListedStub, sinon.match.has('tagName', 'label-utils-v1.1.0'));
            sinon.assert.calledWith(waitForReleaseToBeListedStub, sinon.match.has('tagName', 'object-selector-v1.1.0'));
            sinon.assert.calledWith(waitForReleaseToBeListedStub, sinon.match.has('tagName', 'datastore-lock-v2.1.0'));
            sinon.assert.calledOnce(lockBranchStub);
            sinon.assert.calledOnce(unlockBranchStub);
        });
        (0, mocha_1.it)('should throw DuplicateReleaseError if all releases already tagged', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore: release main',
                    body: pullRequestBody('release-notes/multiple.txt'),
                    labels: ['autorelease: pending'],
                    files: [
                        'packages/bot-config-utils/package.json',
                        'packages/label-utils/package.json',
                        'packages/object-selector/package.json',
                        'packages/datastore-lock/package.json',
                    ],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('packages/bot-config-utils/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/bot-config-utils' })))
                .withArgs('packages/label-utils/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/label-utils' })))
                .withArgs('packages/object-selector/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/object-selector' })))
                .withArgs('packages/datastore-lock/package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-automations/datastore-lock' })));
            mockCreateRelease(github, [
                {
                    id: 1,
                    sha: 'abc123',
                    tagName: 'bot-config-utils-v3.2.0',
                    duplicate: true,
                },
                { id: 2, sha: 'abc123', tagName: 'label-utils-v1.1.0', duplicate: true },
                {
                    id: 3,
                    sha: 'abc123',
                    tagName: 'object-selector-v1.1.0',
                    duplicate: true,
                },
                {
                    id: 4,
                    sha: 'abc123',
                    tagName: 'datastore-lock-v2.1.0',
                    duplicate: true,
                },
            ]);
            const commentStub = sandbox.stub(github, 'commentOnIssue').resolves();
            const addLabelsStub = sandbox.stub(github, 'addIssueLabels').resolves();
            const removeLabelsStub = sandbox
                .stub(github, 'removeIssueLabels')
                .resolves();
            const lockBranchStub = sandbox.stub(github, 'lockBranch').resolves();
            const unlockBranchStub = sandbox.stub(github, 'unlockBranch').resolves();
            const manifest = new manifest_1.Manifest(github, 'main', {
                'packages/bot-config-utils': {
                    releaseType: 'node',
                },
                'packages/label-utils': {
                    releaseType: 'node',
                },
                'packages/object-selector': {
                    releaseType: 'node',
                },
                'packages/datastore-lock': {
                    releaseType: 'node',
                },
            }, {
                'packages/bot-config-utils': version_1.Version.parse('3.1.4'),
                'packages/label-utils': version_1.Version.parse('1.0.1'),
                'packages/object-selector': version_1.Version.parse('1.0.2'),
                'packages/datastore-lock': version_1.Version.parse('2.0.0'),
            });
            try {
                await manifest.createReleases();
                (0, chai_1.expect)(false).to.be.true;
            }
            catch (err) {
                (0, chai_1.expect)(err).instanceof(errors_1.DuplicateReleaseError);
            }
            sinon.assert.notCalled(commentStub);
            sinon.assert.calledOnce(addLabelsStub);
            sinon.assert.calledOnce(removeLabelsStub);
            sinon.assert.calledOnce(lockBranchStub);
            sinon.assert.calledOnce(unlockBranchStub);
        });
        (0, mocha_1.it)('should use fallback when branch lock fails due to missing token permissions (REST error)', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore: release main',
                    body: pullRequestBody('release-notes/single-manifest.txt'),
                    labels: ['autorelease: pending'],
                    files: [],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-cloud/release-brancher' })));
            mockCreateRelease(github, [
                { id: 123456, sha: 'abc123', tagName: 'release-brancher-v1.3.1' },
            ]);
            const commentStub = sandbox.stub(github, 'commentOnIssue').resolves();
            const addLabelsStub = sandbox.stub(github, 'addIssueLabels').resolves();
            const removeLabelsStub = sandbox
                .stub(github, 'removeIssueLabels')
                .resolves();
            const waitForReleaseToBeListedStub = sandbox
                .stub(github, 'waitForReleaseToBeListed')
                .resolves();
            const unlockBranchStub = sandbox.stub(github, 'unlockBranch').resolves();
            // make the lock branch fail with the relevant permission error
            sandbox.replace(github, 'lockBranch', async () => {
                throw new request_error_1.RequestError('Resource not accessible by integration', 403, {
                    request: {
                        method: 'POST',
                        url: 'https://api.github.com/foo',
                        body: {
                            bar: 'baz',
                        },
                        headers: {
                            authorization: 'token secret123',
                        },
                    },
                    response: {
                        status: 403,
                        url: 'https://api.github.com/foo',
                        headers: {
                            'x-github-request-id': '1:2:3:4',
                        },
                        data: {
                            foo: 'bar',
                        },
                    },
                });
            });
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'node',
                },
            }, {
                '.': version_1.Version.parse('1.3.1'),
            });
            const releases = await manifest.createReleases();
            (0, chai_1.expect)(releases).lengthOf(1);
            (0, chai_1.expect)(releases[0].tagName).to.eql('release-brancher-v1.3.1');
            (0, chai_1.expect)(releases[0].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[0].notes).to.eql('some release notes');
            (0, chai_1.expect)(releases[0].path).to.eql('.');
            sinon.assert.calledOnce(commentStub);
            sinon.assert.calledOnceWithExactly(addLabelsStub, ['autorelease: tagged'], 1234);
            sinon.assert.calledOnceWithExactly(removeLabelsStub, ['autorelease: pending'], 1234);
            sinon.assert.calledWith(waitForReleaseToBeListedStub, sinon.match.has('tagName', 'release-brancher-v1.3.1'));
            // ensure we don't try to update permissions rules again given the lock failed
            sinon.assert.notCalled(unlockBranchStub);
        });
        (0, mocha_1.it)('should use fallback when branch lock fails due to missing token permissions (GraphQL error)', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please/branches/main',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore: release main',
                    body: pullRequestBody('release-notes/single-manifest.txt'),
                    labels: ['autorelease: pending'],
                    files: [],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-cloud/release-brancher' })));
            mockCreateRelease(github, [
                { id: 123456, sha: 'abc123', tagName: 'release-brancher-v1.3.1' },
            ]);
            const commentStub = sandbox.stub(github, 'commentOnIssue').resolves();
            const addLabelsStub = sandbox.stub(github, 'addIssueLabels').resolves();
            const removeLabelsStub = sandbox
                .stub(github, 'removeIssueLabels')
                .resolves();
            const waitForReleaseToBeListedStub = sandbox
                .stub(github, 'waitForReleaseToBeListed')
                .resolves();
            const unlockBranchStub = sandbox.stub(github, 'unlockBranch').resolves();
            // make the lock branch fail with the relevant permission error
            sandbox.replace(github, 'lockBranch', async () => {
                throw new graphql_1.GraphqlResponseError({
                    method: 'GET',
                    url: '/foo/bar',
                }, {}, {
                    data: {},
                    errors: [
                        {
                            type: 'FORBIDDEN',
                            message: 'Resource not accessible by integration',
                            path: ['foo'],
                            extensions: {},
                            locations: [
                                {
                                    line: 123,
                                    column: 456,
                                },
                            ],
                        },
                    ],
                });
            });
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'node',
                },
            }, {
                '.': version_1.Version.parse('1.3.1'),
            });
            const releases = await manifest.createReleases();
            (0, chai_1.expect)(releases).lengthOf(1);
            (0, chai_1.expect)(releases[0].tagName).to.eql('release-brancher-v1.3.1');
            (0, chai_1.expect)(releases[0].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[0].notes).to.eql('some release notes');
            (0, chai_1.expect)(releases[0].path).to.eql('.');
            sinon.assert.calledOnce(commentStub);
            sinon.assert.calledOnceWithExactly(addLabelsStub, ['autorelease: tagged'], 1234);
            sinon.assert.calledOnceWithExactly(removeLabelsStub, ['autorelease: pending'], 1234);
            sinon.assert.calledWith(waitForReleaseToBeListedStub, sinon.match.has('tagName', 'release-brancher-v1.3.1'));
            // ensure we don't try to update permissions rules again given the lock failed
            sinon.assert.notCalled(unlockBranchStub);
        });
        (0, mocha_1.it)('should align changes and target branches when release and changes branches are in sync', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please--branches--main--changes--next',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore: release main v1.3.1',
                    body: pullRequestBody('release-notes/single-manifest.txt'),
                    labels: ['autorelease: pending'],
                    files: [],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-cloud/release-brancher' })));
            mockCreateRelease(github, [
                { id: 123456, sha: 'abc123', tagName: 'release-brancher-v1.3.1' },
            ]);
            const commentStub = sandbox.stub(github, 'commentOnIssue').resolves();
            const addLabelsStub = sandbox.stub(github, 'addIssueLabels').resolves();
            const removeLabelsStub = sandbox
                .stub(github, 'removeIssueLabels')
                .resolves();
            const waitForReleaseToBeListedStub = sandbox
                .stub(github, 'waitForReleaseToBeListed')
                .resolves();
            const waitForFileToBeUpToDateOnBranch = sandbox
                .stub(github, 'waitForFileToBeUpToDateOnBranch')
                .resolves();
            const lockBranchStub = sandbox.stub(github, 'lockBranch').resolves();
            const unlockBranchStub = sandbox.stub(github, 'unlockBranch').resolves();
            // release branch in synced with changes-branch, safe to align changes-branch with target-branch
            const isBranchSyncedWithPullRequestCommitsStub = sandbox
                .stub(github, 'isBranchSyncedWithPullRequestCommits')
                .withArgs('next', sinon.match.has('headBranchName', 'release-please--branches--main--changes--next'))
                .resolves(true);
            const alignBranchWithAnotherStub = sandbox
                .stub(github, 'alignBranchWithAnother')
                .resolves();
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'node',
                },
            }, {
                '.': version_1.Version.parse('1.3.1'),
            });
            const releases = await manifest.createReleases();
            (0, chai_1.expect)(releases).lengthOf(1);
            (0, chai_1.expect)(releases[0].tagName).to.eql('release-brancher-v1.3.1');
            (0, chai_1.expect)(releases[0].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[0].notes).to.eql('some release notes');
            (0, chai_1.expect)(releases[0].path).to.eql('.');
            sinon.assert.calledOnce(commentStub);
            sinon.assert.calledOnceWithExactly(addLabelsStub, ['autorelease: tagged'], 1234);
            sinon.assert.calledOnceWithExactly(removeLabelsStub, ['autorelease: pending'], 1234);
            sinon.assert.calledWith(waitForReleaseToBeListedStub, sinon.match.has('tagName', 'release-brancher-v1.3.1'));
            sinon.assert.calledWith(waitForFileToBeUpToDateOnBranch, {
                branch: 'next',
                filePath: '.release-please-manifest.json',
                checkFileStatus: sinon.match.func,
            });
            sinon.assert.calledOnce(isBranchSyncedWithPullRequestCommitsStub);
            sinon.assert.calledOnce(alignBranchWithAnotherStub);
            sinon.assert.calledOnce(lockBranchStub);
            sinon.assert.calledOnce(unlockBranchStub);
        });
        (0, mocha_1.it)('should not align and not throw when release branch is missing but changes-branch already synced with target-branch', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please--branches--main--changes--next',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore: release main',
                    body: pullRequestBody('release-notes/single-manifest.txt'),
                    labels: ['autorelease: pending'],
                    files: [],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-cloud/release-brancher' })));
            mockCreateRelease(github, [
                { id: 123456, sha: 'abc123', tagName: 'release-brancher-v1.3.1' },
            ]);
            const commentStub = sandbox.stub(github, 'commentOnIssue').resolves();
            const addLabelsStub = sandbox.stub(github, 'addIssueLabels').resolves();
            const removeLabelsStub = sandbox
                .stub(github, 'removeIssueLabels')
                .resolves();
            const waitForReleaseToBeListedStub = sandbox
                .stub(github, 'waitForReleaseToBeListed')
                .resolves();
            const lockBranchStub = sandbox.stub(github, 'lockBranch').resolves();
            const unlockBranchStub = sandbox.stub(github, 'unlockBranch').resolves();
            // throw 404 not found when comparing changes-branch against pull request commits
            const isBranchSyncedWithPullRequestCommitsStub = sandbox
                .stub(github, 'isBranchSyncedWithPullRequestCommits')
                .withArgs('next', sinon.match.has('headBranchName', 'release-please--branches--main--changes--next'))
                .throwsException(new request_error_1.RequestError('Resource not found', 404, {
                request: {
                    method: 'GET',
                    url: 'https://api.github.com/foo',
                    body: {
                        bar: 'baz',
                    },
                    headers: {
                        authorization: 'token secret123',
                    },
                },
                response: {
                    status: 404,
                    url: 'https://api.github.com/foo',
                    headers: {
                        'x-github-request-id': '1:2:3:4',
                    },
                    data: {
                        foo: 'bar',
                    },
                },
            }));
            // changes-branch already synced with target-branch
            const isBranchASyncedWithBStub = sandbox
                .stub(github, 'isBranchASyncedWithB')
                .withArgs('next', 'main')
                .resolves(true);
            const alignBranchWithAnotherStub = sandbox
                .stub(github, 'alignBranchWithAnother')
                .resolves();
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'node',
                },
            }, {
                '.': version_1.Version.parse('1.3.1'),
            });
            const releases = await manifest.createReleases();
            (0, chai_1.expect)(releases).lengthOf(1);
            (0, chai_1.expect)(releases[0].tagName).to.eql('release-brancher-v1.3.1');
            (0, chai_1.expect)(releases[0].sha).to.eql('abc123');
            (0, chai_1.expect)(releases[0].notes).to.eql('some release notes');
            (0, chai_1.expect)(releases[0].path).to.eql('.');
            sinon.assert.calledOnce(commentStub);
            sinon.assert.calledOnceWithExactly(addLabelsStub, ['autorelease: tagged'], 1234);
            sinon.assert.calledOnceWithExactly(removeLabelsStub, ['autorelease: pending'], 1234);
            sinon.assert.calledWith(waitForReleaseToBeListedStub, sinon.match.has('tagName', 'release-brancher-v1.3.1'));
            sinon.assert.calledOnce(isBranchSyncedWithPullRequestCommitsStub);
            sinon.assert.calledOnce(isBranchASyncedWithBStub);
            sinon.assert.notCalled(alignBranchWithAnotherStub);
            sinon.assert.calledOnce(lockBranchStub);
            sinon.assert.calledOnce(unlockBranchStub);
        });
        (0, mocha_1.it)('should not throw when release branch is missing and changes-branch not in synced with target-branch', async () => {
            mockPullRequests(github, [], [
                {
                    headBranchName: 'release-please--branches--main--changes--next',
                    baseBranchName: 'main',
                    number: 1234,
                    title: 'chore: release main',
                    body: pullRequestBody('release-notes/single-manifest.txt'),
                    labels: ['autorelease: pending'],
                    files: [],
                    sha: 'abc123',
                },
            ]);
            const getFileContentsStub = sandbox.stub(github, 'getFileContentsOnBranch');
            getFileContentsStub
                .withArgs('package.json', 'main')
                .resolves((0, helpers_1.buildGitHubFileRaw)(JSON.stringify({ name: '@google-cloud/release-brancher' })));
            mockCreateRelease(github, [
                { id: 123456, sha: 'abc123', tagName: 'release-brancher-v1.3.1' },
            ]);
            const commentStub = sandbox.stub(github, 'commentOnIssue').resolves();
            const addLabelsStub = sandbox.stub(github, 'addIssueLabels').resolves();
            const removeLabelsStub = sandbox
                .stub(github, 'removeIssueLabels')
                .resolves();
            const waitForReleaseToBeListedStub = sandbox
                .stub(github, 'waitForReleaseToBeListed')
                .resolves();
            const lockBranchStub = sandbox.stub(github, 'lockBranch').resolves();
            const unlockBranchStub = sandbox.stub(github, 'unlockBranch').resolves();
            // throw 404 not found when comparing changes-branch against release branch
            const isBranchSyncedWithPullRequestCommitsStub = sandbox
                .stub(github, 'isBranchSyncedWithPullRequestCommits')
                .withArgs('next', sinon.match.has('headBranchName', 'release-please--branches--main--changes--next'))
                .throwsException(new request_error_1.RequestError('Resource not found', 404, {
                request: {
                    method: 'GET',
                    url: 'https://api.github.com/foo',
                    body: {
                        bar: 'baz',
                    },
                    headers: {
                        authorization: 'token secret123',
                    },
                },
                response: {
                    status: 404,
                    url: 'https://api.github.com/foo',
                    headers: {
                        'x-github-request-id': '1:2:3:4',
                    },
                    data: {
                        foo: 'bar',
                    },
                },
            }));
            // changes-branch not in synced with target-branch
            const isBranchASyncedWithBStub = sandbox
                .stub(github, 'isBranchASyncedWithB')
                .withArgs('next', 'main')
                .resolves(false);
            const alignBranchWithAnotherStub = sandbox
                .stub(github, 'alignBranchWithAnother')
                .resolves();
            const manifest = new manifest_1.Manifest(github, 'main', {
                '.': {
                    releaseType: 'node',
                },
            }, {
                '.': version_1.Version.parse('1.3.1'),
            });
            await manifest.createReleases();
            // releases are still created
            sinon.assert.calledOnce(commentStub);
            sinon.assert.calledOnceWithExactly(addLabelsStub, ['autorelease: tagged'], 1234);
            sinon.assert.calledOnceWithExactly(removeLabelsStub, ['autorelease: pending'], 1234);
            sinon.assert.calledWith(waitForReleaseToBeListedStub, sinon.match.has('tagName', 'release-brancher-v1.3.1'));
            sinon.assert.calledOnce(isBranchSyncedWithPullRequestCommitsStub);
            sinon.assert.calledOnce(isBranchASyncedWithBStub);
            sinon.assert.notCalled(alignBranchWithAnotherStub);
            sinon.assert.calledOnce(lockBranchStub);
            sinon.assert.calledOnce(unlockBranchStub);
        });
    });
});
//# sourceMappingURL=manifest.js.map