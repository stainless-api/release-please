import {BaseStrategy, BuildUpdatesOptions} from './base';
import {Update} from '../update';
import {Changelog} from '../updaters/changelog';
import {CsProj} from '../updaters/dotnet/csproj';
import {GitHubFileContents} from '@google-automations/git-file-utils';
import {FileNotFoundError, MissingRequiredFileError} from '../errors';

export class CSharp extends BaseStrategy {
  private csprojContents?: GitHubFileContents;

  protected async buildUpdates(
    options: BuildUpdatesOptions
  ): Promise<Update[]> {
    const updates: Update[] = [];
    const version = options.newVersion;

    updates.push({
      path: this.addPath(this.changelogPath),
      createIfMissing: true,
      updater: new Changelog({
        version,
        changelogEntry: options.changelogEntry,
      }),
    });

    const csprojName = await this.getCsprojName();
    updates.push({
      path: this.addPath(csprojName),
      createIfMissing: false,
      cachedFileContents: this.csprojContents,
      updater: new CsProj({
        version,
      }),
    });

    return updates;
  }

  async getDefaultPackageName(): Promise<string | undefined> {
    const csprojContents = await this.getCsprojContents();
    const pkg = this.parseCsprojPackageName(csprojContents.parsedContent);
    return pkg;
  }

  protected normalizeComponent(component: string | undefined): string {
    if (!component) {
      return '';
    }
    // Handle namespace-style components (e.g., "Acme.Utilities" -> "Utilities")
    return component.includes('.') ? component.split('.').pop()! : component;
  }

  private async getCsprojName(): Promise<string> {
    // First, try to find .csproj files in the path
    const files = await this.github.findFilesByGlobAndRef(
      '**/*.csproj',
      this.changesBranch,
      this.path === '.' ? undefined : this.path
    );

    if (files.length > 0) {
      // Return just the filename, not the full path
      const fullPath = files[0];
      return fullPath.split('/').pop()!;
    }

    throw new MissingRequiredFileError(
      this.addPath('*.csproj'),
      'csharp',
      `${this.repository.owner}/${this.repository.repo}#${this.changesBranch}`
    );
  }

  private async getCsprojContents(): Promise<GitHubFileContents> {
    if (!this.csprojContents) {
      const csprojName = await this.getCsprojName();
      const csprojPath = this.addPath(csprojName);
      const errMissingFile = new MissingRequiredFileError(
        csprojPath,
        'csharp',
        `${this.repository.owner}/${this.repository.repo}#${this.changesBranch}`
      );
      try {
        this.csprojContents = await this.github.getFileContentsOnBranch(
          csprojPath,
          this.changesBranch
        );
      } catch (e) {
        if (e instanceof FileNotFoundError) {
          throw errMissingFile;
        }
        throw e;
      }
      if (!this.csprojContents) {
        throw errMissingFile;
      }
    }
    return this.csprojContents;
  }

  private parseCsprojPackageName(content: string): string | undefined {
    // Try PackageId first (preferred for NuGet packages)
    const packageIdMatch = content.match(/<PackageId>([^<]+)<\/PackageId>/);
    if (packageIdMatch) {
      return packageIdMatch[1];
    }

    // Fall back to AssemblyName
    const assemblyNameMatch = content.match(
      /<AssemblyName>([^<]+)<\/AssemblyName>/
    );
    if (assemblyNameMatch) {
      return assemblyNameMatch[1];
    }

    // If neither is specified, try to get from the project file name
    // (The csproj name without extension is typically the package name)
    return undefined;
  }
}
