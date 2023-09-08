import { CargoManifest } from '../updaters/rust/common';
import { BaseStrategy, BuildUpdatesOptions } from './base';
import { Update } from '../update';
export declare class Rust extends BaseStrategy {
    private packageManifest?;
    private workspaceManifest?;
    protected buildUpdates(options: BuildUpdatesOptions): Promise<Update[]>;
    getDefaultPackageName(): Promise<string | undefined>;
    /**
     * @returns the package's manifest, ie. `crates/foobar/Cargo.toml`
     */
    protected getPackageManifest(): Promise<CargoManifest | null>;
    private getContent;
    protected getManifest(path: string): Promise<CargoManifest | null>;
}
