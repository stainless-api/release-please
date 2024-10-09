import { Repository } from '@google-automations/git-file-utils';
import { DefaultUpdater } from '../default';
import { Version } from '../../version';
export declare class GithubImportsGo extends DefaultUpdater {
    private repository;
    constructor(options: {
        repository: Repository;
        version: Version;
    });
    updateContent(content: string): string;
}
