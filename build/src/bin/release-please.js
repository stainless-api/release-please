#!/usr/bin/env node
"use strict";
// Copyright 2019 Google LLC
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
exports.handleError = exports.parser = void 0;
const coerce_option_1 = require("../util/coerce-option");
const yargs = require("yargs");
const github_1 = require("../github");
const manifest_1 = require("../manifest");
const changelog_notes_1 = require("../changelog-notes");
const logger_1 = require("../util/logger");
const factory_1 = require("../factory");
const bootstrapper_1 = require("../bootstrapper");
const diff_1 = require("diff");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const parseGithubRepoUrl = require('parse-github-repo-url');
function gitHubOptions(yargs) {
    return yargs
        .option('token', { describe: 'GitHub token with repo write permissions' })
        .option('api-url', {
        describe: 'URL to use when making API requests',
        default: github_1.GH_API_URL,
        type: 'string',
    })
        .option('graphql-url', {
        describe: 'URL to use when making GraphQL requests',
        default: github_1.GH_GRAPHQL_URL,
        type: 'string',
    })
        .option('default-branch', {
        describe: 'The branch to open release PRs against and tag releases on',
        type: 'string',
        deprecated: 'use --target-branch instead',
    })
        .option('target-branch', {
        describe: 'The branch to open release PRs against and tag releases on',
        type: 'string',
    })
        .option('repo-url', {
        describe: 'GitHub URL to generate release for',
        demand: true,
    })
        .option('dry-run', {
        describe: 'Prepare but do not take action',
        type: 'boolean',
        default: false,
    })
        .option('use-graphql', {
        describe: 'Whether or not the GraphQL API should be used. If false, the REST API will be used instead.',
        type: 'boolean',
        default: true,
    })
        .middleware(_argv => {
        const argv = _argv;
        // allow secrets to be loaded from file path
        // rather than being passed directly to the bin.
        if (argv.token)
            argv.token = (0, coerce_option_1.coerceOption)(argv.token);
        if (argv.apiUrl)
            argv.apiUrl = (0, coerce_option_1.coerceOption)(argv.apiUrl);
        if (argv.graphqlUrl)
            argv.graphqlUrl = (0, coerce_option_1.coerceOption)(argv.graphqlUrl);
    });
}
function releaseOptions(yargs) {
    return yargs
        .option('draft', {
        describe: 'mark release as a draft. no tag is created but tag_name and ' +
            'target_commitish are associated with the release for future ' +
            'tag creation upon "un-drafting" the release.',
        type: 'boolean',
        default: false,
    })
        .option('prerelease', {
        describe: 'mark release that have prerelease versions ' +
            'as as a prerelease on Github',
        type: 'boolean',
        default: false,
    })
        .option('label', {
        default: 'autorelease: pending',
        describe: 'comma-separated list of labels to remove to from release PR',
    })
        .option('release-label', {
        describe: 'set a pull request label other than "autorelease: tagged"',
        default: 'autorelease: tagged',
        type: 'string',
    })
        .option('prerelease-label', {
        describe: 'set a pre-release pull request label other than "autorelease: pre-release"',
        default: 'autorelease: pre-release',
        type: 'string',
    })
        .option('snapshot-label', {
        describe: 'set a java snapshot pull request label other than "autorelease: snapshot"',
        default: 'autorelease: snapshot',
        type: 'string',
    });
}
function pullRequestOptions(yargs) {
    // common to ReleasePR and GitHubRelease
    return yargs
        .option('label', {
        default: 'autorelease: pending',
        describe: 'comma-separated list of labels to add to from release PR',
    })
        .option('skip-labeling', {
        describe: 'skip application of labels to pull requests',
        type: 'boolean',
        default: false,
    })
        .option('fork', {
        describe: 'should the PR be created from a fork',
        type: 'boolean',
        default: false,
    })
        .option('changes-branch', {
        describe: 'If provided, override the branch used to find conventional commits with changes for new version',
        type: 'string',
    })
        .option('draft-pull-request', {
        describe: 'mark pull request as a draft',
        type: 'boolean',
        default: false,
    })
        .option('signoff', {
        describe: 'Add Signed-off-by line at the end of the commit log message using the user and email provided. (format "Name <email@example.com>").',
        type: 'string',
    })
        .option('reviewers', {
        describe: 'Github usernames that should be assigned as reviewers to the release pull request',
        type: 'string',
        coerce(arg) {
            if (arg) {
                return arg.split(',');
            }
            return arg;
        },
    });
}
function pullRequestStrategyOptions(yargs) {
    return yargs
        .option('release-as', {
        describe: 'override the semantically determined release version',
        type: 'string',
    })
        .option('bump-minor-pre-major', {
        describe: 'should we bump the semver minor prior to the first major release',
        default: false,
        type: 'boolean',
    })
        .option('bump-patch-for-minor-pre-major', {
        describe: 'should we bump the semver patch instead of the minor for non-breaking' +
            ' changes prior to the first major release',
        default: false,
        type: 'boolean',
    })
        .option('extra-files', {
        describe: 'extra files for the strategy to consider',
        type: 'string',
        coerce(arg) {
            if (arg) {
                return arg.split(',');
            }
            return arg;
        },
    })
        .option('version-file', {
        describe: 'path to version file to update, e.g., version.rb',
        type: 'string',
    })
        .option('snapshot', {
        describe: 'is it a snapshot (or pre-release) being generated?',
        type: 'boolean',
        default: false,
    })
        .option('versioning-strategy', {
        describe: 'strategy used for bumping versions',
        choices: (0, factory_1.getVersioningStrategyTypes)(),
        default: 'default',
    })
        .option('changelog-path', {
        default: 'CHANGELOG.md',
        describe: 'where can the CHANGELOG be found in the project?',
        type: 'string',
    })
        .option('changelog-type', {
        describe: 'type of changelog to build',
        choices: (0, factory_1.getChangelogTypes)(),
    })
        .option('changelog-sections', {
        describe: 'comma-separated list of scopes to include in the changelog',
        type: 'string',
        coerce: (arg) => {
            if (arg) {
                return (0, changelog_notes_1.buildChangelogSections)(arg.split(','));
            }
            return arg;
        },
    })
        .option('changelog-host', {
        describe: 'host for hyperlinks in the changelog',
        type: 'string',
    })
        .option('last-package-version', {
        describe: 'last version # that package was released as',
        type: 'string',
        deprecated: 'use --latest-tag-version instead',
    })
        .option('latest-tag-version', {
        describe: 'Override the detected latest tag version',
        type: 'string',
    })
        .option('latest-tag-sha', {
        describe: 'Override the detected latest tag SHA',
        type: 'string',
    })
        .option('latest-tag-name', {
        describe: 'Override the detected latest tag name',
        type: 'string',
    })
        .middleware(_argv => {
        const argv = _argv;
        if (argv.defaultBranch) {
            logger_1.logger.warn('--default-branch is deprecated. Please use --target-branch instead.');
            argv.targetBranch = argv.targetBranch || argv.defaultBranch;
        }
        if (argv.lastPackageVersion) {
            logger_1.logger.warn('--latest-package-version is deprecated. Please use --latest-tag-version instead.');
            argv.latestTagVersion =
                argv.latestTagVersion || argv.lastPackageVersion;
        }
    });
}
function manifestConfigOptions(yargs, defaultType) {
    return yargs
        .option('path', {
        describe: 'release from path other than root directory',
        type: 'string',
    })
        .option('component', {
        describe: 'name of component release is being minted for',
        type: 'string',
    })
        .option('package-name', {
        describe: 'name of package release is being minted for',
        type: 'string',
    })
        .option('release-type', {
        describe: 'what type of repo is a release being created for?',
        choices: (0, factory_1.getReleaserTypes)(),
        default: defaultType,
    });
}
function manifestOptions(yargs) {
    return yargs
        .option('config-file', {
        default: 'release-please-config.json',
        describe: 'where can the config file be found in the project?',
    })
        .option('manifest-file', {
        default: '.release-please-manifest.json',
        describe: 'where can the manifest file be found in the project?',
    });
}
function taggingOptions(yargs) {
    return yargs
        .option('include-v-in-tags', {
        describe: 'include "v" in tag versions',
        type: 'boolean',
        default: true,
    })
        .option('monorepo-tags', {
        describe: 'include library name in tags and release branches',
        type: 'boolean',
        default: false,
    })
        .option('pull-request-title-pattern', {
        describe: 'Title pattern to make release PR',
        type: 'string',
    })
        .option('pull-request-header', {
        describe: 'Header for release PR',
        type: 'string',
    });
}
const createReleasePullRequestCommand = {
    command: 'release-pr',
    describe: 'create or update a PR representing the next release',
    builder(yargs) {
        return manifestOptions(manifestConfigOptions(taggingOptions(pullRequestOptions(pullRequestStrategyOptions(gitHubOptions(yargs))))));
    },
    async handler(argv) {
        const github = await buildGitHub(argv);
        const targetBranch = argv.targetBranch || github.repository.defaultBranch;
        let manifest;
        if (argv.releaseType) {
            manifest = await manifest_1.Manifest.fromConfig(github, targetBranch, {
                releaseType: argv.releaseType,
                component: argv.component,
                packageName: argv.packageName,
                draftPullRequest: argv.draftPullRequest,
                bumpMinorPreMajor: argv.bumpMinorPreMajor,
                bumpPatchForMinorPreMajor: argv.bumpPatchForMinorPreMajor,
                changelogPath: argv.changelogPath,
                changelogType: argv.changelogType,
                changelogHost: argv.changelogHost,
                pullRequestTitlePattern: argv.pullRequestTitlePattern,
                pullRequestHeader: argv.pullRequestHeader,
                changelogSections: argv.changelogSections,
                releaseAs: argv.releaseAs,
                versioning: argv.versioningStrategy,
                extraFiles: argv.extraFiles,
                versionFile: argv.versionFile,
                includeComponentInTag: argv.monorepoTags,
                includeVInTag: argv.includeVInTags,
                reviewers: argv.reviewers,
            }, extractManifestOptions(argv), argv.path);
        }
        else {
            const manifestOptions = extractManifestOptions(argv);
            manifest = await manifest_1.Manifest.fromManifest(github, targetBranch, argv.configFile, argv.manifestFile, manifestOptions, argv.path, argv.releaseAs);
        }
        if (argv.dryRun) {
            const pullRequests = await manifest.buildPullRequests([], []);
            logger_1.logger.debug(`Would open ${pullRequests.length} pull requests`);
            logger_1.logger.debug('fork:', manifest.fork);
            logger_1.logger.debug('changes branch:', manifest.changesBranch);
            for (const pullRequest of pullRequests) {
                logger_1.logger.debug('title:', pullRequest.title.toString());
                logger_1.logger.debug('branch:', pullRequest.headRefName);
                logger_1.logger.debug('draft:', pullRequest.draft);
                logger_1.logger.debug('body:', pullRequest.body.toString());
                logger_1.logger.debug('updates:', pullRequest.updates.length);
                const changes = await github.buildChangeSet(pullRequest.updates, manifest.changesBranch);
                for (const update of pullRequest.updates) {
                    logger_1.logger.debug(`  ${update.path}: `, 
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    update.updater.constructor);
                    if (argv.trace) {
                        const change = changes.get(update.path);
                        if (change) {
                            const patch = (0, diff_1.createPatch)(update.path, change.originalContent || '', change.content || '');
                            logger_1.logger.trace(patch);
                        }
                        else {
                            logger_1.logger.warn(`no change found for ${update.path}`);
                        }
                    }
                }
            }
        }
        else {
            const pullRequestNumbers = await manifest.createPullRequests();
            logger_1.logger.trace(pullRequestNumbers);
        }
    },
};
const createReleaseCommand = {
    command: 'github-release',
    describe: 'create a GitHub release from a release PR',
    builder(yargs) {
        return releaseOptions(manifestOptions(manifestConfigOptions(taggingOptions(gitHubOptions(yargs)))));
    },
    async handler(argv) {
        const github = await buildGitHub(argv);
        const targetBranch = argv.targetBranch ||
            argv.defaultBranch ||
            github.repository.defaultBranch;
        let manifest;
        if (argv.releaseType) {
            manifest = await manifest_1.Manifest.fromConfig(github, targetBranch, {
                releaseType: argv.releaseType,
                component: argv.component,
                packageName: argv.packageName,
                draft: argv.draft,
                prerelease: argv.prerelease,
                includeComponentInTag: argv.monorepoTags,
                includeVInTag: argv.includeVInTags,
            }, extractManifestOptions(argv), argv.path);
        }
        else {
            const manifestOptions = extractManifestOptions(argv);
            manifest = await manifest_1.Manifest.fromManifest(github, targetBranch, argv.configFile, argv.manifestFile, manifestOptions);
        }
        if (argv.dryRun) {
            const releases = await manifest.buildReleases();
            logger_1.logger.info(`Would tag ${releases.length} releases:`);
            for (const release of releases) {
                logger_1.logger.info({
                    name: release.name,
                    tag: release.tag.toString(),
                    notes: release.notes,
                    sha: release.sha,
                    draft: release.draft,
                    prerelease: release.prerelease,
                    pullNumber: release.pullRequest.number,
                });
            }
        }
        else {
            const releaseNumbers = await manifest.createReleases();
            logger_1.logger.debug(releaseNumbers);
        }
    },
};
const createManifestPullRequestCommand = {
    command: 'manifest-pr',
    describe: 'create a release-PR using a manifest file',
    deprecated: 'use release-pr instead.',
    builder(yargs) {
        return manifestOptions(pullRequestOptions(gitHubOptions(yargs)));
    },
    async handler(argv) {
        logger_1.logger.warn('manifest-pr is deprecated. Please use release-pr instead.');
        const github = await buildGitHub(argv);
        const targetBranch = argv.targetBranch ||
            argv.defaultBranch ||
            github.repository.defaultBranch;
        const manifestOptions = extractManifestOptions(argv);
        const manifest = await manifest_1.Manifest.fromManifest(github, targetBranch, argv.configFile, argv.manifestFile, manifestOptions);
        if (argv.dryRun) {
            const pullRequests = await manifest.buildPullRequests([], []);
            logger_1.logger.debug(`Would open ${pullRequests.length} pull requests`);
            logger_1.logger.debug('fork:', manifest.fork);
            for (const pullRequest of pullRequests) {
                logger_1.logger.debug('title:', pullRequest.title.toString());
                logger_1.logger.debug('branch:', pullRequest.headRefName);
                logger_1.logger.debug('draft:', pullRequest.draft);
                logger_1.logger.debug('body:', pullRequest.body.toString());
                logger_1.logger.debug('updates:', pullRequest.updates.length);
                for (const update of pullRequest.updates) {
                    logger_1.logger.debug(`  ${update.path}: `, 
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    update.updater.constructor);
                }
            }
        }
        else {
            const pullRequestNumbers = await manifest.createPullRequests();
            logger_1.logger.debug(pullRequestNumbers);
        }
    },
};
const createManifestReleaseCommand = {
    command: 'manifest-release',
    describe: 'create releases/tags from last release-PR using a manifest file',
    deprecated: 'use github-release instead',
    builder(yargs) {
        return manifestOptions(releaseOptions(gitHubOptions(yargs)));
    },
    async handler(argv) {
        logger_1.logger.warn('manifest-release is deprecated. Please use github-release instead.');
        const github = await buildGitHub(argv);
        const targetBranch = argv.targetBranch ||
            argv.defaultBranch ||
            github.repository.defaultBranch;
        const manifestOptions = extractManifestOptions(argv);
        const manifest = await manifest_1.Manifest.fromManifest(github, targetBranch, argv.configFile, argv.manifestFile, manifestOptions);
        if (argv.dryRun) {
            const releases = await manifest.buildReleases();
            logger_1.logger.info(releases);
        }
        else {
            const releaseNumbers = await manifest.createReleases();
            logger_1.logger.debug(releaseNumbers);
        }
    },
};
const bootstrapCommand = {
    command: 'bootstrap',
    describe: 'configure release manifest',
    builder(yargs) {
        return manifestConfigOptions(manifestOptions(releaseOptions(pullRequestStrategyOptions(gitHubOptions(yargs)))))
            .option('initial-version', {
            description: 'current version',
        })
            .coerce('path', arg => {
            return arg || manifest_1.ROOT_PROJECT_PATH;
        });
    },
    async handler(argv) {
        const github = await buildGitHub(argv);
        const targetBranch = argv.targetBranch ||
            argv.defaultBranch ||
            github.repository.defaultBranch;
        const bootstrapper = new bootstrapper_1.Bootstrapper(github, targetBranch, argv.manifestFile, argv.configFile, argv.initialVersion);
        const path = argv.path || manifest_1.ROOT_PROJECT_PATH;
        const releaserConfig = {
            releaseType: argv.releaseType,
            component: argv.component,
            packageName: argv.packageName,
            draft: argv.draft,
            prerelease: argv.prerelease,
            draftPullRequest: argv.draftPullRequest,
            bumpMinorPreMajor: argv.bumpMinorPreMajor,
            bumpPatchForMinorPreMajor: argv.bumpPatchForMinorPreMajor,
            changelogPath: argv.changelogPath,
            changelogHost: argv.changelogHost,
            changelogSections: argv.changelogSections,
            releaseAs: argv.releaseAs,
            versioning: argv.versioningStrategy,
            extraFiles: argv.extraFiles,
            versionFile: argv.versionFile,
        };
        if (argv.dryRun) {
            const pullRequest = await bootstrapper.buildPullRequest(path, releaserConfig);
            logger_1.logger.debug('Would open 1 pull request');
            logger_1.logger.debug('title:', pullRequest.title);
            logger_1.logger.debug('branch:', pullRequest.headBranchName);
            logger_1.logger.debug('body:', pullRequest.body);
            logger_1.logger.debug('updates:', pullRequest.updates.length);
            const changes = await github.buildChangeSet(pullRequest.updates, targetBranch);
            for (const update of pullRequest.updates) {
                logger_1.logger.debug(`  ${update.path}: `, 
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                update.updater.constructor);
                if (argv.trace) {
                    const change = changes.get(update.path);
                    if (change) {
                        const patch = (0, diff_1.createPatch)(update.path, change.originalContent || '', change.content || '');
                        logger_1.logger.debug(patch);
                    }
                    else {
                        logger_1.logger.warn(`no change found for ${update.path}`);
                    }
                }
            }
        }
        else {
            const pullRequest = await bootstrapper.bootstrap(path, releaserConfig);
            logger_1.logger.debug(pullRequest);
        }
    },
};
const debugConfigCommand = {
    command: 'debug-config',
    describe: 'debug manifest config',
    builder(yargs) {
        return manifestConfigOptions(manifestOptions(gitHubOptions(yargs)));
    },
    async handler(argv) {
        const github = await buildGitHub(argv);
        const manifestOptions = extractManifestOptions(argv);
        const targetBranch = argv.targetBranch ||
            argv.defaultBranch ||
            github.repository.defaultBranch;
        const manifest = await manifest_1.Manifest.fromManifest(github, targetBranch, argv.configFile, argv.manifestFile, manifestOptions);
        logger_1.logger.debug(manifest);
    },
};
async function buildGitHub(argv) {
    const [owner, repo] = parseGithubRepoUrl(argv.repoUrl);
    const github = await github_1.GitHub.create({
        owner,
        repo,
        token: argv.token,
        apiUrl: argv.apiUrl,
        graphqlUrl: argv.graphqlUrl,
        useGraphql: argv.useGraphql,
        retries: 3,
        throttlingRetries: 3,
    });
    return github;
}
exports.parser = yargs
    .command(createReleasePullRequestCommand)
    .command(createReleaseCommand)
    .command(createManifestPullRequestCommand)
    .command(createManifestReleaseCommand)
    .command(bootstrapCommand)
    .command(debugConfigCommand)
    .option('debug', {
    describe: 'print verbose errors (use only for local debugging).',
    default: false,
    type: 'boolean',
})
    .option('trace', {
    describe: 'print extra verbose errors (use only for local debugging).',
    default: false,
    type: 'boolean',
})
    .middleware(argv => {
    if (argv.trace || process.env['LOG_LEVEL'] === 'trace') {
        (0, logger_1.setLogger)(new logger_1.CheckpointLogger(true, true));
    }
    else if (argv.debug || process.env['LOG_LEVEL'] === 'debug') {
        (0, logger_1.setLogger)(new logger_1.CheckpointLogger(true));
    }
})
    .option('plugin', {
    describe: 'load plugin named release-please-<plugin-name>',
    type: 'array',
    default: [],
})
    .middleware(argv => {
    for (const pluginName of argv.plugin) {
        logger_1.logger.debug(`requiring plugin: ${pluginName}`);
        try {
            const plugin = require(pluginName.toString());
            if (plugin === null || plugin === void 0 ? void 0 : plugin.init) {
                logger_1.logger.debug(`loading plugin: ${pluginName}`);
            }
            else {
                logger_1.logger.warn(`plugin: ${pluginName} did not have an init() function.`);
            }
        }
        catch (e) {
            logger_1.logger.warn(`failed to require plugin: ${pluginName}:`, e);
        }
    }
})
    .demandCommand(1)
    .strict(true)
    .scriptName('release-please');
function extractManifestOptions(argv) {
    const manifestOptions = {};
    if ('changesBranch' in argv && argv.changesBranch) {
        manifestOptions.changesBranch = argv.changesBranch;
    }
    if ('fork' in argv && argv.fork !== undefined) {
        manifestOptions.fork = argv.fork;
    }
    if ('reviewers' in argv && argv.reviewers) {
        manifestOptions.reviewers = argv.reviewers;
    }
    if (argv.label !== undefined) {
        let labels = argv.label.split(',');
        if (labels.length === 1 && labels[0] === '')
            labels = [];
        manifestOptions.labels = labels;
    }
    if ('skipLabeling' in argv && argv.skipLabeling !== undefined) {
        manifestOptions.skipLabeling = argv.skipLabeling;
    }
    if ('releaseLabel' in argv && argv.releaseLabel) {
        manifestOptions.releaseLabels = argv.releaseLabel.split(',');
    }
    if ('prereleaseLabel' in argv && argv.prereleaseLabel) {
        manifestOptions.prereleaseLabels = argv.prereleaseLabel.split(',');
    }
    if ('snapshotLabel' in argv && argv.snapshotLabel) {
        manifestOptions.snapshotLabels = argv.snapshotLabel.split(',');
    }
    if ('signoff' in argv && argv.signoff) {
        manifestOptions.signoff = argv.signoff;
    }
    if ('draft' in argv && argv.draft !== undefined) {
        manifestOptions.draft = argv.draft;
    }
    if ('draftPullRequest' in argv && argv.draftPullRequest !== undefined) {
        manifestOptions.draftPullRequest = argv.draftPullRequest;
    }
    return manifestOptions;
}
// The errors returned by octokit currently contain the
// request object, this contains information we don't want to
// leak. For this reason, we capture exceptions and print
// a less verbose error message (run with --debug to output
// the request object, don't do this in CI/CD).
const handleError = (err) => {
    var _a, _b;
    let status = '';
    if (exports.handleError.yargsArgs === undefined) {
        throw new Error('Set handleError.yargsArgs with a yargs.Arguments instance.');
    }
    const ya = exports.handleError.yargsArgs;
    const errorLogger = (_a = exports.handleError.logger) !== null && _a !== void 0 ? _a : logger_1.logger;
    const command = ((_b = ya === null || ya === void 0 ? void 0 : ya._) === null || _b === void 0 ? void 0 : _b.length) ? ya._[0] : '';
    if (err.status) {
        status = '' + err.status;
    }
    errorLogger.error(`command ${command} failed${status ? ` with status ${status}` : ''}`);
    if (ya === null || ya === void 0 ? void 0 : ya.debug) {
        logger_1.logger.error('---------');
        logger_1.logger.error(err.stack);
    }
    process.exitCode = 1;
};
exports.handleError = handleError;
// Only run parser if executed with node bin, this allows
// for the parser to be easily tested:
let argv;
if (require.main === module) {
    (async () => {
        argv = await exports.parser.parseAsync();
        exports.handleError.yargsArgs = argv;
        process.on('unhandledRejection', err => {
            (0, exports.handleError)(err);
        });
        process.on('uncaughtException', err => {
            (0, exports.handleError)(err);
        });
    })();
}
//# sourceMappingURL=release-please.js.map