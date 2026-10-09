# JSTorrent Website

The public website is an Astro application deployed to GitHub Pages. It
contains the product site, downloads, blog, legacy compatibility routes, and a
browser-hosted client page that reuses JSTorrent's React/Solid packages.

## Development

From the repository root, install the committed dependency graph first:

```bash
pnpm install --frozen-lockfile
pnpm --filter jstorrent-website dev
pnpm --filter jstorrent-website build
pnpm --filter jstorrent-website preview
```

The development server uses <http://localhost:3000>.

Run the hosted feedback/uninstall security checks from the repository root:

```bash
node --test tests/hosted-context.test.mjs
```

`public/product-context.js` accepts bounded known query fields and renders them
as text. Preserve the existing Google Form destinations and analytics recipient;
never test these pages by submitting a form. Changing hosted copy locally does
not establish public deployment or authorize enabling additional client context.

## Source Map

- `src/pages/`: Astro routes, client page, blog, and RSS
- `src/components/`: product, download, FAQ, and client components
- `src/content/`: blog content
- `public/`: static files, AltStore source JSON, and retained legacy URLs
- `astro.config.mjs`: site URL, integrations, aliases, and development port

The build aliases `@jstorrent/engine`, `@jstorrent/client`, and
`@jstorrent/ui` to workspace source.

## Deployment

[`deploy-website.yml`](../.github/workflows/deploy-website.yml) builds and
deploys the site on relevant `main` changes and `website-v*` tags. It resolves
the latest legacy Tauri release while the production descriptor is disabled.
An enabled curated descriptor takes precedence over runtime discovery.

See the [release topic](../docs/topics/releases.md) for the optional website tag
workflow.

## Replacement release qualification

The compatible Astro 7.3.6 website graph was qualified on 2026-10-08 in a
fresh archive checkout, preserving inherited workspace module links. Frozen
installation, the six-page static build, eight hosted security tests, client
TypeScript and 112 shared-client tests pass. Eighteen browser captures at
390/1200 pixels have no horizontal overflow, broken images, page exceptions or
RSTorrent display text. No form was submitted or website deployed.

Use explicit `?url` imports for shared React PNG logos: Astro's ordinary image
imports return metadata, while React `<img>` requires a URL. The application
header and action groups wrap on narrow screens.

The version-scoped website graph has zero npm registry advisory entries across
440 dependency package names. Other workspace findings remain outside this
website qualification. `http-cache-semantics` 4.3.0 still reproduces upstream
max-stale behavior despite registry range clearance. Inspected Astro 7.3.6
remote-image loading only uses `storable()`/`timeToLive()`; the static site has
no viewer-request shared HTTP cache or server adapter. This bounded call-path
assessment must be repeated before introducing one.

Shared-client tests in a fresh checkout require normal workspace builds:

```bash
pnpm --filter @jstorrent/client... build
pnpm --filter @jstorrent/client typecheck
pnpm --filter @jstorrent/client test
```

## Curated production handoff

`src/data/production-release.json` remains disabled with no release inventory.
The old published downloads continue until a separately approved cutover.

Before activation, qualify and publish the exact immutable replacement capsule.
Record its canonical version and `desktop-v<version>` tag, repository
`kzahel/rstorrent`, full source SHA, original updater key ID
`415D3DF4B3D0CFB8`, and all 15 asset names, byte lengths and SHA-256 values.
The first replacement's Linux offering is AppImage-only on both architectures;
production DEB/RPM entries are rejected. Existing legacy discovery/downloads
remain unchanged while the descriptor is disabled.
The production publisher is currently intentionally disabled; a signed candidate
build does not establish publication. Do not enable this descriptor for a preview,
synthetic fixture or an unavailable asset.

The build validates the closed inventory and rejects missing, duplicate,
wrong-product, malformed or mismatched metadata. Metadata validation does not
verify file bytes, signatures or public availability. Those checks must precede
setting `qualified` and explicitly enabling the descriptor in a reviewed commit.
The enabled view pins every download to this capsule, uses actual macOS DMGs,
and offers both Linux AppImages without the legacy installer command. Linux
support is best effort; the headless fallback links explicitly to setup from
source rather than promising an unpromoted public package. Source and CI links
select the matching repository; existing support recipients are retained. Late
legacy release discovery cannot replace these curated links.

Run the focused guards with the repository's Node 24 or newer baseline:

```bash
pnpm test:production-website-release
pnpm --filter jstorrent-website build
```

Review phone/wide Windows, Mac and both Linux architecture choices before an
approved website deployment. A local disabled build or controlled fixture screen
is preparation, not public delivery evidence. Pushing relevant `main` changes
also deploys the website and requires an explicit instruction.
