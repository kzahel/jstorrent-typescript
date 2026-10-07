import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { selectProductionWebsiteRelease } from '../website/src/lib/production-release.ts'

function qualifiedFixture() {
  const version = '0.3.0'
  const payloads = [
    `JSTorrent_${version}_x64-setup.exe`,
    `JSTorrent_${version}_x64_en-US.msi`,
    `JSTorrent_${version}_amd64.AppImage`,
    `JSTorrent_${version}_amd64.deb`,
    `JSTorrent-${version}-1.x86_64.rpm`,
    `JSTorrent_${version}_aarch64.AppImage`,
    `JSTorrent_${version}_arm64.deb`,
    `JSTorrent-${version}-1.aarch64.rpm`,
    'JSTorrent_aarch64.app.tar.gz',
    'JSTorrent_x64.app.tar.gz',
  ]
  const names = [
    ...payloads,
    ...payloads.map((n) => n + '.sig'),
    `JSTorrent_${version}_aarch64.dmg`,
    `JSTorrent_${version}_x64.dmg`,
    'latest.json',
  ]
  return {
    schema: 1,
    enabled: true,
    release: {
      version,
      tag: 'desktop-v0.3.0',
      repository: 'kzahel/rstorrent',
      sourceSha: 'a'.repeat(40),
      updaterPublicKeyId: '415D3DF4B3D0CFB8',
      qualified: true,
      assets: names.map((name) => ({ name, bytes: 1234, sha256: 'b'.repeat(64) })),
    },
  }
}

test('committed descriptor keeps the published delivery unchanged', () => {
  const descriptor = JSON.parse(
    readFileSync(new URL('../website/src/data/production-release.json', import.meta.url)),
  )
  assert.equal(descriptor.enabled, false)
  assert.equal(descriptor.release, null)
  assert.equal(selectProductionWebsiteRelease(descriptor), null)
})

test('an enabled qualified matrix binds all platform URLs to its immutable release', () => {
  const links = selectProductionWebsiteRelease(qualifiedFixture())
  assert.equal(links.tag, 'v0.3.0')
  const expectedSuffixes = {
    windowsUrl: 'JSTorrent_0.3.0_x64-setup.exe',
    macosPrimaryArmUrl: 'JSTorrent_0.3.0_aarch64.dmg',
    macosPrimaryIntelUrl: 'JSTorrent_0.3.0_x64.dmg',
    macosArmUrl: 'JSTorrent_0.3.0_aarch64.dmg',
    macosIntelUrl: 'JSTorrent_0.3.0_x64.dmg',
    linuxDebUrl: 'JSTorrent_0.3.0_amd64.deb',
    linuxAppImageUrl: 'JSTorrent_0.3.0_amd64.AppImage',
    linuxArm64DebUrl: 'JSTorrent_0.3.0_arm64.deb',
    linuxArm64AppImageUrl: 'JSTorrent_0.3.0_aarch64.AppImage',
  }
  for (const [field, name] of Object.entries(expectedSuffixes)) {
    assert.equal(
      links[field],
      'https://github.com/kzahel/rstorrent/releases/download/desktop-v0.3.0/' + name,
    )
  }
})

test('prepared qualified metadata remains inactive until enabled', () => {
  const data = qualifiedFixture()
  data.enabled = false
  assert.equal(selectProductionWebsiteRelease(data), null)
})

for (const [name, mutate] of [
  [
    'empty enabled inventory',
    (data) => {
      data.release = null
    },
  ],
  [
    'unsupported schema',
    (data) => {
      data.schema = 2
    },
  ],
  [
    'string enabled flag',
    (data) => {
      data.enabled = 'true'
    },
  ],
  [
    'unknown configuration fields',
    (data) => {
      data.url = 'https://example.invalid'
    },
  ],
  [
    'qualification absent',
    (data) => {
      data.release.qualified = false
    },
  ],
  [
    'incubation updater root',
    (data) => {
      data.release.updaterPublicKeyId = '788A785131367096'
    },
  ],
  [
    'source SHA absent',
    (data) => {
      data.release.sourceSha = ''
    },
  ],
  [
    'alternate repository',
    (data) => {
      data.release.repository = 'attacker/repository'
    },
  ],
  [
    'prerelease tag',
    (data) => {
      data.release.tag = 'desktop-latest-v0.3.0'
    },
  ],
  [
    'version mismatch',
    (data) => {
      data.release.version = '0.3.1'
    },
  ],
  [
    'noncanonical version',
    (data) => {
      data.release.version = '00.3.0'
      data.release.tag = 'desktop-v00.3.0'
    },
  ],
  [
    'old version',
    (data) => {
      data.release.version = '0.2.1'
      data.release.tag = 'desktop-v0.2.1'
    },
  ],
  [
    'missing architecture',
    (data) => {
      data.release.assets.pop()
    },
  ],
  [
    'duplicate asset',
    (data) => {
      data.release.assets[1] = data.release.assets[0]
    },
  ],
  [
    'preview product',
    (data) => {
      data.release.assets[0].name = 'JSTorrent Preview_0.3.0_x64-setup.exe'
    },
  ],
  [
    'injected asset URL',
    (data) => {
      data.release.assets[0].url = 'https://example.invalid'
    },
  ],
  [
    'invalid hash',
    (data) => {
      data.release.assets[0].sha256 = 'not-a-hash'
    },
  ],
  [
    'zero bytes',
    (data) => {
      data.release.assets[0].bytes = 0
    },
  ],
  [
    'oversized asset',
    (data) => {
      data.release.assets[0].bytes = 512 * 1024 * 1024 + 1
    },
  ],
]) {
  test('refuses ' + name, () => {
    const data = qualifiedFixture()
    mutate(data)
    assert.throws(() => selectProductionWebsiteRelease(data))
  })
}
