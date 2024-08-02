exports['Plugin compatibility linked-versions and group-pull-request-title-pattern should find release to create 1'] = `
:sparkles: Stainless prepared a new release
---


<details><summary>primary: 1.1.0</summary>

## [1.1.0](https://github.com/fake-owner/fake-repo/compare/primary-v1.0.0...primary-v1.1.0) (1983-10-10)


### Features

* some feature ([aaaaaa](https://github.com/fake-owner/fake-repo/commit/aaaaaa))
</details>

<details><summary>pkgA: 1.1.0</summary>

## [1.1.0](https://github.com/fake-owner/fake-repo/compare/pkgA-v1.0.0...pkgA-v1.1.0) (1983-10-10)


### Features

* some feature ([aaaaaa](https://github.com/fake-owner/fake-repo/commit/aaaaaa))
</details>

---
This Pull Request has been generated automatically as part of [Stainless](https://stainlessapi.com/)'s release process. See [our docs](https://app.stainlessapi.com/docs/guides/publish) for more details.
We've used the included commits to determine the [semver version number](https://semver.org/#semantic-versioning-specification-semver) for this Pull Request. Alternatively, you can manually set the version number in the title of this Pull Request.

For a better experience, it is recommended to use either rebase-merge or squash-merge when merging this pull request ([see details](https://github.com/stainless-api/release-please/#linear-git-commit-history-use-squash-merge)).

_More technical details can be found at [stainless-api/release-please](https://github.com/stainless-api/release-please)_.
`
