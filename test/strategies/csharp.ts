import {describe, it, afterEach, beforeEach} from 'mocha';
import {CSharp} from '../../src/strategies/csharp';
import {
  buildMockConventionalCommit,
  buildGitHubFileContent,
  assertHasUpdate,
} from '../helpers';
import nock = require('nock');
import * as sinon from 'sinon';
import {GitHub} from '../../src/github';
import {Version} from '../../src/version';
import {TagName} from '../../src/util/tag-name';
import {expect} from 'chai';
import {Changelog} from '../../src/updaters/changelog';
import {CsProj} from '../../src/updaters/dotnet/csproj';
import * as assert from 'assert';
import {MissingRequiredFileError} from '../../src/errors';

nock.disableNetConnect();
const sandbox = sinon.createSandbox();
const fixturesPath = './test/fixtures/strategies/csharp';

describe('CSharp', () => {
  let github: GitHub;
  const commits = [
    ...buildMockConventionalCommit(
      'fix(deps): update dependency Newtonsoft.Json to v13.0.1'
    ),
  ];
  beforeEach(async () => {
    github = await GitHub.create({
      owner: 'googleapis',
      repo: 'csharp-test-repo',
      defaultBranch: 'main',
    });
  });
  afterEach(() => {
    sandbox.restore();
  });
  describe('buildReleasePullRequest', () => {
    it('returns release PR changes with defaultInitialVersion', async () => {
      const expectedVersion = '0.0.1';
      const strategy = new CSharp({
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
      expect(release!.version?.toString()).to.eql(expectedVersion);
    });
    it('builds a release pull request', async () => {
      const expectedVersion = '0.123.5';
      const strategy = new CSharp({
        targetBranch: 'main',
        github,
        component: 'Acme.TestProject',
        packageName: 'Acme.TestProject',
      });
      sandbox
        .stub(github, 'findFilesByGlobAndRef')
        .resolves(['TestProject.csproj']);
      const latestRelease = {
        tag: new TagName(Version.parse('0.123.4'), 'Acme.TestProject'),
        sha: 'abc123',
        notes: 'some notes',
      };
      const pullRequest = await strategy.buildReleasePullRequest({
        commits,
        latestRelease,
      });
      expect(pullRequest!.version?.toString()).to.eql(expectedVersion);
    });
    it('detects a default component', async () => {
      const expectedVersion = '0.123.5';
      const strategy = new CSharp({
        targetBranch: 'main',
        github,
      });
      const commits = [
        ...buildMockConventionalCommit(
          'fix(deps): update dependency Newtonsoft.Json to v13.0.1'
        ),
      ];
      const latestRelease = {
        tag: new TagName(Version.parse('0.123.4'), 'TestProject'),
        sha: 'abc123',
        notes: 'some notes',
      };
      sandbox
        .stub(github, 'findFilesByGlobAndRef')
        .resolves(['TestProject.csproj']);
      const getFileContentsStub = sandbox.stub(
        github,
        'getFileContentsOnBranch'
      );
      getFileContentsStub
        .withArgs('TestProject.csproj', 'main')
        .resolves(buildGitHubFileContent(fixturesPath, 'TestProject.csproj'));
      const pullRequest = await strategy.buildReleasePullRequest({
        commits,
        latestRelease,
      });
      expect(pullRequest!.version?.toString()).to.eql(expectedVersion);
    });
    it('detects a default packageName', async () => {
      const expectedVersion = '0.123.5';
      const strategy = new CSharp({
        targetBranch: 'main',
        github,
        component: 'TestProject',
      });
      const commits = [
        ...buildMockConventionalCommit(
          'fix(deps): update dependency Newtonsoft.Json to v13.0.1'
        ),
      ];
      const latestRelease = {
        tag: new TagName(Version.parse('0.123.4'), 'TestProject'),
        sha: 'abc123',
        notes: 'some notes',
      };
      sandbox
        .stub(github, 'findFilesByGlobAndRef')
        .resolves(['TestProject.csproj']);
      const getFileContentsStub = sandbox.stub(
        github,
        'getFileContentsOnBranch'
      );
      getFileContentsStub
        .withArgs('TestProject.csproj', 'main')
        .resolves(buildGitHubFileContent(fixturesPath, 'TestProject.csproj'));
      const pullRequest = await strategy.buildReleasePullRequest({
        commits,
        latestRelease,
      });
      expect(pullRequest!.version?.toString()).to.eql(expectedVersion);
    });
    it('handles missing csproj file', async () => {
      sandbox.stub(github, 'findFilesByGlobAndRef').resolves([]);
      const strategy = new CSharp({
        targetBranch: 'main',
        github,
      });
      const latestRelease = {
        tag: new TagName(Version.parse('0.123.4'), 'TestProject'),
        sha: 'abc123',
        notes: 'some notes',
      };
      assert.rejects(async () => {
        await strategy.buildReleasePullRequest({commits, latestRelease});
      }, MissingRequiredFileError);
    });
  });
  describe('buildUpdates', () => {
    it('builds common files', async () => {
      const strategy = new CSharp({
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
      const updates = release!.updates;
      assertHasUpdate(updates, 'CHANGELOG.md', Changelog);
      assertHasUpdate(updates, 'TestProject.csproj', CsProj);
    });
  });
  describe('getDefaultPackageName', () => {
    it('reads package name from PackageId', async () => {
      const strategy = new CSharp({
        targetBranch: 'main',
        github,
      });
      sandbox
        .stub(github, 'findFilesByGlobAndRef')
        .resolves(['TestProject.csproj']);
      sandbox
        .stub(github, 'getFileContentsOnBranch')
        .withArgs('TestProject.csproj', 'main')
        .resolves(buildGitHubFileContent(fixturesPath, 'TestProject.csproj'));
      const packageName = await strategy.getDefaultPackageName();
      expect(packageName).to.eql('Acme.TestProject');
    });
  });
  describe('normalizeComponent', () => {
    it('strips namespace prefix from component', async () => {
      const strategy = new CSharp({
        targetBranch: 'main',
        github,
        component: 'Acme.Utilities.Core',
      });
      sandbox
        .stub(github, 'findFilesByGlobAndRef')
        .resolves(['TestProject.csproj']);
      const component = await strategy.getBranchComponent();
      expect(component).to.eql('Core');
    });
    it('handles component without namespace', async () => {
      const strategy = new CSharp({
        targetBranch: 'main',
        github,
        component: 'TestProject',
      });
      sandbox
        .stub(github, 'findFilesByGlobAndRef')
        .resolves(['TestProject.csproj']);
      const component = await strategy.getBranchComponent();
      expect(component).to.eql('TestProject');
    });
  });
});
