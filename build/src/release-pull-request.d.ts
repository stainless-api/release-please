import { Update } from './update';
import { Version } from './version';
import { PullRequestBody } from './util/pull-request-body';
import { PullRequestTitle } from './util/pull-request-title';
import { ConventionalCommit } from './commit';
export interface ReleasePullRequest {
    readonly title: PullRequestTitle;
    readonly body: PullRequestBody;
    labels: string[];
    readonly headRefName: string;
    readonly version?: Version;
    readonly previousVersion?: Version;
    readonly draft: boolean;
    readonly group?: string;
    updates: Update[];
    readonly conventionalCommits: ConventionalCommit[];
}
