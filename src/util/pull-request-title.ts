// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import {logger as defaultLogger, Logger} from './logger';
import {Version} from '../version';

// cannot import from '..' - transpiled code references to RELEASE_PLEASE
// at the script level are undefined, they are only defined inside function
// or instance methods/properties.

const DEFAULT_PR_TITLE_PATTERN = 'release: ${componentsSegment}';

/**
 * Default pattern for a component in the "components segment" of the release PR title
 */
const DEFAULT_PR_TITLE_PATTERN_SINGLE_COMPONENT_SEGMENT =
  '${component} ${version}';

/**
 * Default separator for components in the "component segment" of the release PR.
 */
const DEFAULT_PR_TITLE_PATTERN_COMPONENT_SEPARATOR = ',';

export function generateMatchPatternPRTitleComponentsSegment(
  componentsSegmentPattern?: string
): RegExp {
  return new RegExp(
    `^${(
      componentsSegmentPattern ||
      DEFAULT_PR_TITLE_PATTERN_SINGLE_COMPONENT_SEGMENT
    )
      .replace('[', '\\[') // TODO: handle all regex escaping
      .replace(']', '\\]')
      .replace('(', '\\(')
      .replace(')', '\\)')
      .replace(
        '${scope}',
        '(\\((?<changesBranch>[\\w-./]+ => )?(?<branch>[\\w-./]+)\\))?'
      )
      .replace('${component}', ' ?(?<component>@?[\\w-./]*)?')
      .replace('${version}', 'v?(?<version>[0-9].*)')
      .replace('${changesBranch}', '(?<changesBranch>?[\\w-./]+)?')
      .replace('${branch}', '(?<branch>[\\w-./]+)?')}$`
  );
}

export function generateMatchPatternPRTitle(
  pullRequestTitlePattern?: string,
  componentsSegmentPattern?: string,
  componentsSegmentSeparator?: string
): RegExp {
  const matchPatternComponentsSegment =
    generateMatchPatternPRTitleComponentsSegment(
      componentsSegmentPattern ||
        DEFAULT_PR_TITLE_PATTERN_SINGLE_COMPONENT_SEGMENT
    );
  return new RegExp(
    `^${(pullRequestTitlePattern || DEFAULT_PR_TITLE_PATTERN)
      .replace('[', '\\[') // TODO: handle all regex escaping
      .replace(']', '\\]')
      .replace('(', '\\(')
      .replace(')', '\\)')
      .replace(
        '${scope}',
        '(\\((?<changesBranch>[\\w-./]+ => )?(?<branch>[\\w-./]+)\\))?'
      )
      // FIXME(sam): review + fix regexp for components segment, it should handle
      // the separator.
      .replace('${componentsSegment}', ` ${matchPatternComponentsSegment}`)
      .replace('${changesBranch}', '(?<changesBranch>?[\\w-./]+)?')
      .replace('${branch}', '(?<branch>[\\w-./]+)?')}$`
  );
}

export class PullRequestTitle {
  components?: string[];
  changesBranch?: string;
  targetBranch?: string;
  versions?: Version[];
  pullRequestTitlePattern: string;
  matchPattern: RegExp;

  private constructor(opts: {
    versions?: Version[];
    components?: string[];
    targetBranch?: string;
    changesBranch?: string;
    pullRequestTitlePattern?: string;
    logger?: Logger;
  }) {
    this.versions = opts.versions;
    this.components = opts.components;
    this.targetBranch = opts.targetBranch;
    this.changesBranch = opts.changesBranch || this.targetBranch;
    this.pullRequestTitlePattern =
      opts.pullRequestTitlePattern || DEFAULT_PR_TITLE_PATTERN;
    this.matchPattern = generateMatchPattern(this.pullRequestTitlePattern);
  }

  static parse(
    title: string,
    pullRequestTitlePattern?: string,
    logger: Logger = defaultLogger
  ): PullRequestTitle | undefined {
    const matchPattern = generateMatchPattern(pullRequestTitlePattern);
    const match = title.match(matchPattern);
    if (match?.groups) {
      return new PullRequestTitle({
        versions: match.groups['versions']
          ? Version.parseMultiple(match.groups['versions'])
          : undefined,
        components: match.groups['components'],
        changesBranch: match.groups['changesBranch'],
        targetBranch: match.groups['branch'],
        pullRequestTitlePattern,
        logger,
      });
    }
    return undefined;
  }

  static ofComponentVersion(
    components: string[],
    versions: Version[],
    pullRequestTitlePattern?: string
  ): PullRequestTitle {
    return new PullRequestTitle({
      versions,
      components,
      pullRequestTitlePattern,
    });
  }
  static ofSingleVersion(
    version: Version,
    pullRequestTitlePattern?: string
  ): PullRequestTitle {
    return new PullRequestTitle({versions: [version], pullRequestTitlePattern});
  }
  static ofTargetBranchVersion(
    targetBranch: string,
    changesBranch: string,
    versions: Version[],
    pullRequestTitlePattern?: string
  ): PullRequestTitle {
    return new PullRequestTitle({
      versions,
      targetBranch,
      changesBranch,
      pullRequestTitlePattern,
    });
  }

  static ofComponentTargetBranchVersion(
    components?: string[],
    targetBranch?: string,
    changesBranch?: string,
    versions?: Version[],
    pullRequestTitlePattern?: string
  ): PullRequestTitle {
    return new PullRequestTitle({
      versions,
      components,
      targetBranch,
      changesBranch,
      pullRequestTitlePattern,
    });
  }

  static ofTargetBranch(
    targetBranch: string,
    changesBranch: string,
    pullRequestTitlePattern?: string
  ): PullRequestTitle {
    return new PullRequestTitle({
      targetBranch,
      changesBranch,
      pullRequestTitlePattern,
    });
  }

  getTargetBranch(): string | undefined {
    return this.targetBranch;
  }
  getChangesBranch(): string | undefined {
    return this.changesBranch;
  }
  getComponents(): string[] | undefined {
    return this.components;
  }
  getVersions(): Version[] | undefined {
    return this.versions;
  }

  toString(): string {
    const scope = this.targetBranch
      ? this.changesBranch && this.changesBranch !== this.targetBranch
        ? `(${this.changesBranch} => ${this.targetBranch})`
        : `(${this.targetBranch})`
      : '';
    const components = this.components ? ` ${this.components}` : '';
    const versions = this.versions ?? '';

    // FIXME(sam): replace template values using indices for versions and components
    // Should look like: `releases: ${components[0]} ${versions[0]}, ${components[1]} ${versions[1]}`

    // return this.pullRequestTitlePattern
    //   .replace('${scope}', scope)
    //   .replace('${component}', component)
    //   .replace('${version}', version.toString())
    //   .replace('${changesBranch}', this.changesBranch || '')
    //   .replace('${branch}', this.targetBranch || '')
    //   .trim();
  }
}
