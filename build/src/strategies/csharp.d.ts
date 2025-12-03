import { BaseStrategy, BuildUpdatesOptions } from './base';
import { Update } from '../update';
export declare class CSharp extends BaseStrategy {
    private csprojContents?;
    protected buildUpdates(options: BuildUpdatesOptions): Promise<Update[]>;
    getDefaultPackageName(): Promise<string | undefined>;
    protected normalizeComponent(component: string | undefined): string;
    private getCsprojName;
    private getCsprojContents;
    private parseCsprojPackageName;
}
