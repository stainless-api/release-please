exports['Manifest buildPullRequests should allow creating multiple pull requests 1'] = `
:sparkles: Stainless prepared a new release
---


## [1.0.1](https://github.com/fake-owner/fake-repo/compare/pkg1-v1.0.0...pkg1-v1.0.1) (1983-10-10)


### Bug Fixes

* some bugfix ([aaaaaa](https://github.com/fake-owner/fake-repo/commit/aaaaaa))

---
This Pull Request has been generated automatically as part of [Stainless](https://stainlessapi.com/)'s release process.
For a better experience, it is recommended to use either rebase-merge or squash-merge when merging this pull request ([see details](https://github.com/stainless-api/release-please/#linear-git-commit-history-use-squash-merge)).

_More technical details can be found at [stainless-api/release-please](https://github.com/stainless-api/release-please)_.
`

exports['Manifest buildPullRequests should allow creating multiple pull requests 2'] = `
:sparkles: Stainless prepared a new release
---


## [0.2.4](https://github.com/fake-owner/fake-repo/compare/pkg2-v0.2.3...pkg2-v0.2.4) (1983-10-10)


### Bug Fixes

* some bugfix ([bbbbbb](https://github.com/fake-owner/fake-repo/commit/bbbbbb))

---
This Pull Request has been generated automatically as part of [Stainless](https://stainlessapi.com/)'s release process.
For a better experience, it is recommended to use either rebase-merge or squash-merge when merging this pull request ([see details](https://github.com/stainless-api/release-please/#linear-git-commit-history-use-squash-merge)).

_More technical details can be found at [stainless-api/release-please](https://github.com/stainless-api/release-please)_.
`

exports['Manifest buildPullRequests should allow customizing pull request title with root package 1'] = `
:sparkles: Stainless prepared a new release
---


<details><summary>root: 1.2.2</summary>

## [1.2.2](https://github.com/fake-owner/fake-repo/compare/root-v1.2.1...root-v1.2.2) (1983-10-10)


### Bug Fixes

* some bugfix ([aaaaaa](https://github.com/fake-owner/fake-repo/commit/aaaaaa))
</details>

<details><summary>pkg1: 1.0.2</summary>

## [1.0.2](https://github.com/fake-owner/fake-repo/compare/pkg1-v1.0.1...pkg1-v1.0.2) (1983-10-10)


### Bug Fixes

* some bugfix ([aaaaaa](https://github.com/fake-owner/fake-repo/commit/aaaaaa))
</details>

---
This Pull Request has been generated automatically as part of [Stainless](https://stainlessapi.com/)'s release process.
For a better experience, it is recommended to use either rebase-merge or squash-merge when merging this pull request ([see details](https://github.com/stainless-api/release-please/#linear-git-commit-history-use-squash-merge)).

_More technical details can be found at [stainless-api/release-please](https://github.com/stainless-api/release-please)_.
`

exports['Manifest buildPullRequests should allow overriding commit message 1'] = `
:sparkles: Stainless prepared a new release
---


## [1.0.1](https://github.com/fake-owner/fake-repo/compare/v1.0.0...v1.0.1) (1983-10-10)


### Bug Fixes

* real fix message ([def456](https://github.com/fake-owner/fake-repo/commit/def456))

---
This Pull Request has been generated automatically as part of [Stainless](https://stainlessapi.com/)'s release process.
For a better experience, it is recommended to use either rebase-merge or squash-merge when merging this pull request ([see details](https://github.com/stainless-api/release-please/#linear-git-commit-history-use-squash-merge)).

_More technical details can be found at [stainless-api/release-please](https://github.com/stainless-api/release-please)_.
`

exports['Manifest buildPullRequests should handle mixing componentless configs 1'] = `
:sparkles: Stainless prepared a new release
---


<details><summary>1.0.1</summary>

## [1.0.1](https://github.com/fake-owner/fake-repo/compare/v1.0.0...v1.0.1) (1983-10-10)


### Bug Fixes

* some bugfix ([aaaaaa](https://github.com/fake-owner/fake-repo/commit/aaaaaa))
</details>

<details><summary>pkg2: 0.2.4</summary>

## [0.2.4](https://github.com/fake-owner/fake-repo/compare/pkg2-v0.2.3...pkg2-v0.2.4) (1983-10-10)


### Bug Fixes

* some bugfix ([bbbbbb](https://github.com/fake-owner/fake-repo/commit/bbbbbb))
</details>

---
This Pull Request has been generated automatically as part of [Stainless](https://stainlessapi.com/)'s release process.
For a better experience, it is recommended to use either rebase-merge or squash-merge when merging this pull request ([see details](https://github.com/stainless-api/release-please/#linear-git-commit-history-use-squash-merge)).

_More technical details can be found at [stainless-api/release-please](https://github.com/stainless-api/release-please)_.
`

exports['Manifest buildPullRequests should handle multiple package repository 1'] = `
:sparkles: Stainless prepared a new release
---


<details><summary>pkg1: 1.0.1</summary>

## [1.0.1](https://github.com/fake-owner/fake-repo/compare/pkg1-v1.0.0...pkg1-v1.0.1) (1983-10-10)


### Bug Fixes

* some bugfix ([aaaaaa](https://github.com/fake-owner/fake-repo/commit/aaaaaa))
</details>

<details><summary>pkg2: 0.2.4</summary>

## [0.2.4](https://github.com/fake-owner/fake-repo/compare/pkg2-v0.2.3...pkg2-v0.2.4) (1983-10-10)


### Bug Fixes

* some bugfix ([bbbbbb](https://github.com/fake-owner/fake-repo/commit/bbbbbb))
</details>

---
This Pull Request has been generated automatically as part of [Stainless](https://stainlessapi.com/)'s release process.
For a better experience, it is recommended to use either rebase-merge or squash-merge when merging this pull request ([see details](https://github.com/stainless-api/release-please/#linear-git-commit-history-use-squash-merge)).

_More technical details can be found at [stainless-api/release-please](https://github.com/stainless-api/release-please)_.
`

exports['Manifest buildPullRequests should report issue via PR comment if labeled as custom version but version not found in title 1'] = `

## Invalid version number in PR title

:rotating_light: This Pull Request has the \`autorelease: custom version\` label but the version number cannot be found in the title. Instead the generated version \`0.2.4\` will be used.

If you want to set a custom version be sure to use the [semantic versioning format](https://devhints.io/semver), e.g \`1.2.3\`.

If you do not want to set a custom version and want  to get rid of this warning, remove the label \`autorelease: custom version\` from this Pull Request.

`

exports['Manifest buildPullRequests should use version from existing PR title if differs from release branch manifest 1'] = `

## Release version edited manually

The Pull Request version has been manually set to \`6.7.9-alpha.1\` and will be used for the release.

If you instead want to use the version number \`1.0.1\` generated from conventional commits, just remove the label \`autorelease: custom version\` from this Pull Request.

`

exports['Manifest buildPullRequests should use version from existing PR title if differs from release branch manifest 2'] = `

## Release version edited manually

The Pull Request version has been manually set to \`7.8.9\` and will be used for the release.

If you instead want to use the version number \`2.0.1\` generated from conventional commits, just remove the label \`autorelease: custom version\` from this Pull Request.

`

exports['Manifest buildPullRequests should use version from existing PR title if differs from release branch manifest 3'] = `

## Release version edited manually

The Pull Request version has been manually set to \`8.9.0\` and will be used for the release.

If you instead want to use the version number \`3.0.1\` generated from conventional commits, just remove the label \`autorelease: custom version\` from this Pull Request.

`

exports['Manifest buildPullRequests should use version from existing PR title if differs from release branch manifest 4'] = `

## Release version edited manually

The Pull Request version has been manually set to \`9.0.1\` and will be used for the release.

If you instead want to use the version number \`4.0.1\` generated from conventional commits, just remove the label \`autorelease: custom version\` from this Pull Request.

`

exports['Manifest buildPullRequests should warn end user via PR comment if version not found in title and not labeled as custom version 1'] = `

## Invalid version number in PR title

:warning: No version number can be found in the title, the generated version \`0.2.4\` will be used. Did you want to change the version for this release?

To set a custom version be sure to use the [semantic versioning format](https://devhints.io/semver), e.g \`1.2.3\`.

`
