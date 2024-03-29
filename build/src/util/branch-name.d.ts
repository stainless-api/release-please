import { Version } from '../version';
import { Logger } from './logger';
export declare class BranchName {
    component?: string;
    targetBranch?: string;
    changesBranch?: string;
    version?: Version;
    static parse(branchName: string, logger?: Logger): BranchName | undefined;
    static ofComponentVersion(branchPrefix: string, version: Version): BranchName;
    static ofVersion(version: Version): BranchName;
    static ofTargetBranch(targetBranch: string, changesBranch: string): BranchName;
    static ofComponentTargetBranch(component: string, targetBranch: string, changesBranch: string): BranchName;
    static ofGroupTargetBranch(group: string, targetBranch: string, changesBranch: string): BranchName;
    constructor(_branchName: string);
    static matches(_branchName: string): boolean;
    getTargetBranch(): string | undefined;
    getChangesBranch(): string | undefined;
    getComponent(): string | undefined;
    getVersion(): Version | undefined;
    toString(): string;
}