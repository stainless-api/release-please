import { BaseStrategy, BuildUpdatesOptions } from './base';
import { Update } from '../update';
export declare class TerraformModule extends BaseStrategy {
    protected buildUpdates(options: BuildUpdatesOptions): Promise<Update[]>;
}
