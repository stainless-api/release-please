import { Update } from '../update';
import { VersionsMap } from '../version';
import { GitHubFileContents } from '@google-automations/git-file-utils';
import { ConventionalCommit } from '../commit';
import { Java, JavaBuildUpdatesOption } from './java';
export declare class JavaYoshi extends Java {
    private versionsContent?;
    /**
     * Override this method to post process commits
     * @param {ConventionalCommit[]} commits parsed commits
     * @returns {ConventionalCommit[]} modified commits
     */
    protected postProcessCommits(commits: ConventionalCommit[]): Promise<ConventionalCommit[]>;
    protected needsSnapshot(): Promise<boolean>;
    protected buildVersionsMap(): Promise<VersionsMap>;
    protected getVersionsContent(): Promise<GitHubFileContents>;
    protected buildUpdates(options: JavaBuildUpdatesOption): Promise<Update[]>;
    protected updateVersionsMap(versionsMap: VersionsMap, conventionalCommits: ConventionalCommit[]): Promise<VersionsMap>;
}