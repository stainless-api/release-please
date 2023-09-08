import { BaseStrategy, BuildUpdatesOptions } from './base';
import { Update } from '../update';
export declare class KRMBlueprint extends BaseStrategy {
    protected buildUpdates(options: BuildUpdatesOptions): Promise<Update[]>;
}
