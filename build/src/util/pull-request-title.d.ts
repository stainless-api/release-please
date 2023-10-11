import { Logger } from './logger';
import { Version } from '../version';
export declare function generateMatchPattern(pullRequestTitlePattern?: string): RegExp;
export declare class PullRequestTitle {
    component?: string;
    changesBranch?: string;
    targetBranch?: string;
    version?: Version;
    pullRequestTitlePattern: string;
    matchPattern: RegExp;
    private constructor();
    static parse(title: string, pullRequestTitlePattern?: string, logger?: Logger): PullRequestTitle | undefined;
    static ofComponentVersion(component: string, version: Version, pullRequestTitlePattern?: string): PullRequestTitle;
    static ofVersion(version: Version, pullRequestTitlePattern?: string): PullRequestTitle;
    static ofTargetBranchVersion(targetBranch: string, changesBranch: string, version: Version, pullRequestTitlePattern?: string): PullRequestTitle;
    static ofComponentTargetBranchVersion(component?: string, targetBranch?: string, changesBranch?: string, version?: Version, pullRequestTitlePattern?: string): PullRequestTitle;
    static ofTargetBranch(targetBranch: string, changesBranch: string, pullRequestTitlePattern?: string): PullRequestTitle;
    getTargetBranch(): string | undefined;
    getChangesBRanch(): string | undefined;
    getComponent(): string | undefined;
    getVersion(): Version | undefined;
    toString(): string;
}
