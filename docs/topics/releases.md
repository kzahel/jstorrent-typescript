# Releases

Topic: `releases`

Status: **current release map, reconciled with repository scripts and GitHub
Actions workflows on 2026-07-23**.

JSTorrent components release independently. Release scripts are not dry-run
helpers: most update version files, create a commit, push it, create a tag, and
push the tag. Run one only when a release is intended.

## Preflight

Before any component release:

1. Work on `main` and fetch the current remote state.
2. Confirm the working tree is clean and the intended commits are pushed or
   ready to be pushed by the release script.
3. Review the component changelog and add `## [<version>]` when the script
   requires it.
4. Run the relevant build, tests, and product smoke tests.
5. Confirm `git config user.name` and `git config user.email` identify the
   maintainer.
6. Inspect the release script and current workflow before relying on this
   topic if either has changed since the last reconciliation date.

Use versions without a leading `v`, for example:

```bash
./scripts/release-android.sh 1.2.3
```

## Component Map

| Component | Script and tag | Automated result | Remaining manual work |
| --- | --- | --- | --- |
| Engine | `release-engine.sh`, `engine-v*` | Tests, builds, publishes `@jstorrent/engine` to npm, creates GitHub release | Verify npm and release |
| Plugin SDK | `release-plugin-sdk.sh`, `plugin-sdk-v*` | Tests, builds, publishes `@jstorrent/plugin-sdk` to npm, creates GitHub release | Verify npm and release |
| Extension | `release-extension.sh`, `extension-v*` | Builds, runs Playwright, creates ZIP and GitHub release | Upload ZIP to Chrome Web Store |
| Android | `release-android.sh`, `android-v*` | Builds signed APK/AAB and mapping file, creates GitHub release | Upload AAB and mapping to Play Console, publish |
| Tauri desktop | `release-tauri-app.sh`, `tauri-app-v*` | Builds signed installers, updater metadata, and GitHub release | Verify installers and updater propagation |
| iOS | `release-ios.sh`, `ios-v*` | Builds/tests, uploads to App Store Connect, notarizes, fetches ADP, updates AltStore source, publishes release | Verify; use fallback workflow only on failure |
| Website | `release-website.sh`, `website-v*` | Deploys website through GitHub Pages workflow | Tag is optional bookkeeping; normal relevant `main` changes also deploy |

All release scripts live in [`scripts/`](../../scripts/README.md). The matching
workflows live under [`.github/workflows/`](../../.github/workflows/).

## Website Replacement Qualification

The 2026-10-08 compatible website patch is locally qualified using a frozen
fresh-checkout installation, Astro 7.3.6 six-page static build, eight hosted
security cases, 112 shared-client cases and 18 responsive browser captures.
Explicit logo URL imports and wrapping header controls resolve the actual
hosted `/app` broken image and narrow-screen overflow. See
[the website README](../../website/README.md) for commands and the bounded
cache-library assessment. The website's version-scoped npm graph is clear;
this does not clear unrelated retired-workspace findings or establish public
deployment. Normal relevant `main` changes still deploy through the existing
website workflow; local commits do not authorize that push.


## Fragment and narrow-width presentation

The website now realigns an initial fragment after the client-only Downloads
island mounts and fonts settle. This also corrects FAQ links displaced by that
insertion. Sticky-header scroll spacing keeps headings visible; at320px the
header controls use a second row, long release-note tokens wrap, and the retained
FAQ command scrolls horizontally within its answer. Actual hero, direct Download
and direct FAQ navigation passes at320/390/1200px in a fresh synthetic-enabled
static build. The real descriptor stays disabled; no public deployment occurs.


## Chromebook Linux recovery copy

The curated successor view's No Play Store FAQ now offers the native AppImage,
best-effort compatibility guidance and explicitly labeled headless setup from
source. It explains separate Android/Linux libraries and does not advertise
legacy daemon attachment. Disabled production metadata retains the legacy
answer and links. Fresh enabled/disabled builds,24 inventory guards, tracked
docs and320/390/1200 fragment captures pass; the disabled answer's normalized
text and links match the original exactly. No website is deployed.

## Engine and Plugin SDK

Both npm releases require a matching changelog entry and update their package
version before committing and tagging:

```bash
./scripts/release-engine.sh <version>
./scripts/release-plugin-sdk.sh <version>
```

The workflows run typechecking, tests, a package build, and `npm pack
--dry-run` before publishing with provenance.

## Extension

Before releasing the extension:

- Run `./scripts/e2e-companion-smoke.sh`; the release script checks for a
  recent successful run.
- Review backend minimums in
  `packages/client/src/hooks/useSystemBridge.ts` when the extension depends on
  new daemon or native-host behavior.
- Release required Android and Tauri backends before increasing those
  minimums.

Then run:

```bash
./scripts/release-extension.sh <version>
```

CI creates `jstorrent-extension.zip` and a GitHub release. Chrome Web Store
submission is manual.

## Android

```bash
./scripts/release-android.sh <version>
```

The script increments `versionCode` and updates `versionName`. Android CI
builds and attaches the signed APK, AAB, and compressed mapping file. Upload
the CI-produced AAB to Play Console; `build-playstore-bundle.sh` is a local
recovery path, not a required second build after successful CI.

## Tauri Desktop

```bash
./scripts/release-tauri-app.sh <version>
```

The script updates the Tauri configuration, JavaScript package, Rust workspace
version, lockfile, and changelog. CI builds platform installers, signs
configured targets, validates `latest.json`, and updates the GitHub release
download table. The finalizer also publishes `SHA256SUMS` from GitHub's
recorded asset digests. The Linux desktop and Crostini installers hash the
downloaded asset locally and refuse to install when the manifests are missing,
do not name the selected asset, or do not match. A website-hosted manifest
bootstraps release 0.2.1, which predates the release finalizer; subsequent
releases carry their manifest as a release asset. Existing applications
consume the updater metadata.

## iOS

```bash
./scripts/release-ios.sh <version>
```

The iOS path is automated through notarization and AltStore source publication.
Its safety invariants, verification steps, and recovery workflow are maintained
in
[`ios-altstore-pal-distribution.md`](ios-altstore-pal-distribution.md).

## Website

Relevant `website/**` changes on `main` deploy automatically. An optional
version tag can be created with:

```bash
./scripts/release-website.sh <version>
```

The deploy workflow discovers the latest legacy Tauri release while
`website/src/data/production-release.json` is disabled. The replacement handoff
is locally prepared with a closed 15-asset inventory and original updater root.
An explicitly enabled qualified descriptor overrides runtime discovery, uses
actual macOS DMGs and removes the legacy Linux installer command. Desktop 0.3.0 is now public at the immutable `desktop-v0.3.0` tag in
`kzahel/rstorrent`, bound to signed source
`ff632f4588a474d7b169de3cea228bd406e6982d`. All 17 actual public downloads
passed independent whole-file hashes. The descriptor now selects those exact
15 core assets and the separately verified corresponding-source archive.
Website deployment and desktop feed activation remain distinct operations.
See [the website README](../../website/README.md) for activation invariants,
focused guards and the distinction between metadata and byte/signature evidence.

On 2026-10-09, the accepted best-effort Linux scope narrows production to both
AppImages, excluding DEB/RPM while preserving disabled legacy behavior. All 24
inventory guards pass. A fresh frozen-install checkout builds both disabled
and synthetic-enabled six-page sites; eight phone/wide platform/architecture
views pass link/layout/error checks with 16 captures. The direct inherited
workspace build fails on an existing missing solid-js module link, so that
failure is retained separately rather than reported as passed. Temporary
checkout/browser/server state is removed; the actual descriptor stays
disabled/null and no push/deployment occurs.

## Recovery Rules

- Do not rerun a release script until checking whether its commit or tag was
  already created.
- If CI failed after the tag was pushed, prefer rerunning the failed workflow
  or job over inventing a replacement tag.
- Do not move or recreate a published tag without explicit maintainer
  direction.
- iOS has a dedicated **iOS Finalize Release** fallback workflow for
  post-notarization failures.

## Code Map

- [`release-engine.sh`](../../scripts/release-engine.sh)
- [`release-plugin-sdk.sh`](../../scripts/release-plugin-sdk.sh)
- [`release-extension.sh`](../../scripts/release-extension.sh)
- [`release-android.sh`](../../scripts/release-android.sh)
- [`release-tauri-app.sh`](../../scripts/release-tauri-app.sh)
- [`release-ios.sh`](../../scripts/release-ios.sh)
- [`release-website.sh`](../../scripts/release-website.sh)
- [`engine-publish.yml`](../../.github/workflows/engine-publish.yml)
- [`plugin-sdk-publish.yml`](../../.github/workflows/plugin-sdk-publish.yml)
- [`extension-ci.yml`](../../.github/workflows/extension-ci.yml)
- [`android-ci.yml`](../../.github/workflows/android-ci.yml)
- [`tauri-app-ci.yml`](../../.github/workflows/tauri-app-ci.yml)
- [`ios-ci.yml`](../../.github/workflows/ios-ci.yml)
- [`ios-finalize-release.yml`](../../.github/workflows/ios-finalize-release.yml)
- [`deploy-website.yml`](../../.github/workflows/deploy-website.yml)

## Replacement AppImage source access

The prepared curated successor inventory now requires a closed, independently
bounded source archive descriptor beside its15 core assets. Both Linux download
choices provide adjacent source and rebuild instructions, including original
library notices. Disabled metadata retains published legacy delivery. Final
source archive bytes and exact AppImage bindings must be verified before
activation; this metadata validation does not itself establish publication.

On2026-10-10, the maintainer authorizes staged production cutover. The prepared
website is ready for deployment with the curated release disabled until exact
public desktop/source availability passes. Privacy copy now describes actual
pseudonymous counts, optional hosted context and page recipients; release builds
keep additional hosted context disabled. Public validation and Web Store review
submission follow deployment. Website publication does not activate desktop feeds.


## Qualified desktop 0.3.0 website activation

The enabled descriptor binds actual public downloads rather than a fixture.
Fresh frozen-checkout validation covers the 30 inventory/source guards, selector
TypeScript, focused lint, SDK and Astro build, tracked documentation and
390/1200px Windows, both Mac choices and both Linux architectures. Linux remains
best effort with adjacent source/rebuild access and headless setup from source.
Production updater activation and asynchronous store approvals are separate
checks; this website commit does not imply their completion.
