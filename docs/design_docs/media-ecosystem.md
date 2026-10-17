# Media Ecosystem: Sync, Search Plugins, and playsvideo Integration

## Overview

This document captures the design for three interconnected features:
1. **User sync** via Firebase — torrent lists and watchlists across devices
2. **Search plugin architecture** — URL-based, auto-updating plugins for content discovery
3. **playsvideo cooperation** — two separate apps that interoperate via standard APIs and an open `media://` URI scheme

The guiding principle: each component is independently useful and independently defensible. The user's own deliberate actions wire them together.

## 1. User Sync (Firebase)

### Authentication

Firebase Auth with Google Sign-In. Simple, no custom auth infrastructure.

Per-platform auth flow:

| Platform | Method |
|----------|--------|
| Extension | Chrome Identity API (`chrome.identity.getAuthToken`) |
| Android | Google Sign-In SDK (native) |
| Tauri Desktop | Open system browser → OAuth → redirect to localhost listener |
| Node CLI | Firebase REST API with stored refresh token |

### Token Storage

Store the Firebase refresh token in whatever local storage each platform already uses. No encryption, no keychain, no new infrastructure.

| Platform | Storage |
|----------|---------|
| Extension | `chrome.storage.local` |
| Android | SharedPreferences |
| Tauri Desktop | SQLite database (per-profile, already exists in io-daemon) |
| Node CLI | Config file |

The Tauri desktop stores the token in the existing per-profile SQLite database. This aligns with the existing multi-profile concept (originally for multiple Chrome profiles) — the sync credential is scoped to a profile, keeping the mapping simple.

Rationale for no encryption: if an attacker can read the user's local storage, they already have access to everything else on the machine. The refresh token is scoped to the Firebase project only — it can't access the user's Google account, Gmail, Drive, etc. Worst case: someone reads/writes the user's synced torrent list. And it's revocable server-side.

### What Syncs

**Simple Firestore doc per user: `users/{uid}/sync`**

The sync payload is deliberately lightweight:
- TMDB IDs (watchlist) — completely innocuous, just "user likes these shows"
- Settings/preferences
- Optionally: verified info hash ↔ TMDB ID mappings (user-curated)

The watchlist syncs **TMDB IDs, not info hashes**. Each device resolves TMDB titles to healthy torrents independently via search plugins. This means:
- The sync payload contains no torrent-specific data by default
- It's equivalent to syncing a list of movie bookmarks
- If the user opts into syncing verified hashes, those are encrypted (see below)

### End-to-End Encryption (Opt-In)

Default: plain Firestore sync (zero friction, just sign in with Google).

Power users can enable "Encrypted Sync" in settings, which adds a one-time device-pairing step:
1. First device generates a random AES-256 key, stores it locally
2. Adding a second device: scan QR code or enter short numeric code to transfer the key
3. All sync data is encrypted client-side before writing to Firestore
4. Firestore only ever sees ciphertext

The Firestore infrastructure doesn't change — E2EE is purely a client-side concern. Same doc, just encrypted payload.

This is especially relevant for users who opt into syncing verified info hashes alongside TMDB IDs.

### Info Hash Privacy Rationale

Storing user ↔ info hash mappings in a Google-hosted database was a concern based on experience at BitTorrent Inc., where the worry was discovery/subpoena exposure. For an indie product:
- It's the user's own private data in their own authenticated account
- Firestore security rules scope access to `users/{uid}`
- It's no different from a user bookmarking a magnet link in Chrome (which Google already syncs)
- The E2EE opt-in covers privacy-conscious users
- The default watchlist syncs TMDB IDs only — no torrent data at all

### Multi-Profile Interaction

The existing multi-profile system (per-Chrome-profile SQLite databases in the io-daemon) is orthogonal to sync. Sync operates at the user (Firebase UID) level. Local profiles stay as they are. The active profile is what connects to the sync account.

## 2. Search Plugin Architecture

### Design

Plugins are JavaScript modules that implement a standard search interface. They are:
- **Not bundled** with JSTorrent (except the Internet Archive plugin)
- **User-installed** via URL
- **Auto-updating** from their source URL
- **Community-maintained** — JSTorrent defines the API, the community builds plugins

### Installation via URL Scheme

```
jstorrent://plugin?url=https://raw.githubusercontent.com/someone/ia-plugin/main/plugin.js
```

One-click install from any webpage, GitHub README, forum post. JSTorrent intercepts the URL, shows a confirmation dialog ("Install search plugin from github.com?"), user approves, done.

Same pattern as `magnet:` links — users already understand "click link, app opens, confirm."

### Plugin Source: Raw GitHub URLs

Plugins hosted as raw GitHub URLs get the full git ecosystem for free:
- Version history and rollbacks
- Forks (don't like a plugin? fork it, change the URL)
- Commit diffs (plugin author goes rogue? users see it)
- Pull requests for community contributions

### Auto-Update

- Plugin declares a `version` field
- JSTorrent periodically re-fetches the source URL
- If version is newer, update (silently or with notification)
- Optional pinning: `jstorrent://plugin?url=...&pin=abc123` installs a specific commit hash, disabling auto-update

### First-Party Plugin: Internet Archive

Ship or prominently feature an Internet Archive search plugin:
- Completely legal — IA uses BitTorrent as a distribution method for public domain and CC content
- Demonstrates the plugin system with real, useful content
- Sets the tone that the plugin ecosystem isn't inherently about piracy
- Requires **web seed support** (BEP 19 / BEP 17) for good performance, since many IA torrents have few or no peers

### Community Plugin Directory

Options (least to most involvement):
1. **Fully hands-off**: plugins are just URLs, community maintains their own lists anywhere
2. **GitHub wiki/repo**: community-maintained list on a JSTorrent GitHub page (qBittorrent model)
3. **Curated directory**: JSTorrent-maintained list (more control, more liability)

Recommendation: option 2. Define the plugin API spec, let the community maintain the directory. Moderate for malware/broken plugins, not for content.

### No-Plugins-Installed Flow

When JSTorrent receives a search query (e.g., from playsvideo) but has no plugins installed:
- Show a message: "Want to search for this? Browse community plugins at [link]"
- JSTorrent itself never helps find infringing content
- The user's deliberate action of finding, choosing, and installing a plugin is their own intent

## 3. The `media://` URI Scheme

### Motivation

No standard URI scheme exists for "look up this media." Streaming services have no incentive to standardize (walled gardens). Open source media apps (Kodi, Jellyfin, Plex) all built proprietary ecosystems.

`media://` is unregistered with IANA. The namespace is available.

### URI Format

```
# Provider-agnostic search (the core)
media://search?q=Breaking+Bad&year=2008&type=tv

# Provider-specific lookup (optional, for exact matches)
media://tmdb/tv/1396
media://tmdb/movie/550
media://imdb/tt0137523
media://tvdb/81189

# Hierarchical (episodes)
media://tmdb/tv/1396/season/1/episode/3
```

The default is keywords + metadata hints. No provider assumed. The handler resolves however it wants. Provider-prefixed URIs are optional for when the caller has a known ID.

### Reference Implementation

A standalone open-source app/extension — a "media router":
- Searches TMDB for metadata
- Shows legal streaming providers (via TMDB Watch Providers API)
- Handles `media://` intents and routes to registered handlers
- Completely legitimate standalone product

This establishes the protocol independently of JSTorrent and playsvideo.

### IANA Registration

Register `media://` as a provisional IANA URI scheme with a simple one-page spec hosted on GitHub. Reference implementation + spec in the same repo.

## 4. playsvideo + JSTorrent Cooperation

### Separation of Concerns

| App | Owns | Touches TMDB? | Revenue? |
|-----|------|---------------|----------|
| **playsvideo** | Library, watchlist, watch history, TMDB metadata, playback | Yes (free, non-commercial use) | No |
| **JSTorrent** | Torrent downloads, search plugins, file↔torrent mappings | No | Yes (nagware/paid features) |

This separation is important for TMDB API terms compliance: commercial use requires a separate agreement. TMDB integration lives in the free app; monetization lives in the torrent client.

### playsvideo as the Library/Brain

playsvideo stores everything:
- TMDB IDs (watchlist)
- Verified info hashes (user-curated, paired with TMDB IDs)
- File paths and watch progress
- Metadata cache (posters, descriptions — cached up to 6 months per TMDB terms)

JSTorrent is stateless from playsvideo's perspective. It provides two services on demand:
1. "Download this info hash"
2. "What torrent owns this file path?"

If the user uninstalls JSTorrent, their library and watch history remain intact in playsvideo. They just can't fetch new content.

### TMDB Integration in playsvideo

- Use TMDB API at runtime for search, metadata, and artwork (not bundled exports — avoids "no derivatives" clause in TMDB terms)
- Cache per-title metadata locally (up to 6 months)
- Watch Providers API shows legal streaming sources per title/country
- New episode air dates, season info, release status — the watchlist becomes a live dashboard

### Communication Channels

| Platform | Mechanism |
|----------|-----------|
| Chrome extension | `chrome.runtime.sendMessage` via `externally_connectable` — can detect if JSTorrent extension is installed |
| Android | Standard intents between separate APKs — `queryIntentActivities` discovers handlers |
| Tauri desktop | Localhost IPC or `media://` URL scheme handler |
| Web (generic) | `media://` URI — fire and forget, OS routes to whatever is registered |

The extension context is the most elegant: both apps are extensions (or have extension components), Chrome messaging provides discovery and communication for free.

### User Flow (Full Stack)

1. User opens **playsvideo**, searches TMDB, finds a movie
2. playsvideo shows: "Stream on Netflix, Hulu, Apple TV+" (legal sources from TMDB Watch Providers)
3. If JSTorrent extension is detected: an additional subtle option appears (e.g., download icon)
4. User clicks it → playsvideo sends title + year to JSTorrent via extension messaging
5. **JSTorrent** queries search plugins → user picks a torrent → download starts
6. File lands in shared download folder
7. **playsvideo** picks up the file, asks JSTorrent "what torrent owns this path?" → stores the TMDB ID ↔ info hash mapping
8. Movie appears in playsvideo library with artwork, ready to play on any device

Every step is a deliberate user action. Neither app explicitly facilitates the other's controversial use case.

### Legal Posture

The architecture follows the **Kodi model** — platform with plugin API ships clean, community builds add-ons:
- playsvideo shows legal streaming sources. Never touches a torrent.
- JSTorrent is a torrent client for downloading legal content (Linux ISOs, Internet Archive, Creative Commons). Ships with an IA plugin.
- Search plugins are third-party, user-installed, community-maintained.
- The `media://` protocol is an open standard with a reference implementation that routes to legal sources.
- Each component is independently defensible. The user's own actions wire them together.

Precedent: Kodi has operated this way for 20+ years. Individual add-on authors and "fully loaded box" sellers have faced legal action, but the Kodi project never has.

## 5. Web Seed Support (BEP 17 / BEP 19)

Required for a good Internet Archive plugin experience. Many IA torrents have few or no BitTorrent peers but include HTTP web seed URLs pointing to `archive.org` servers.

Implementation involves:
- HTTP range requests to web seed URLs alongside normal peer connections
- Coordinating piece selection between peers and web seeds
- Retry/fallback logic

Also broadly useful beyond IA — Linux distros, game mods, and open source projects use web seeds for guaranteed availability.

## Implementation Priority

Suggested order:
1. **Search plugin API** — define the spec, build the IA plugin, `jstorrent://plugin` URL handler
2. **Web seed support** — makes the IA plugin actually useful
3. **Firebase sync** — Google Sign-In + Firestore for watchlist sync (TMDB IDs)
4. **`media://` URI scheme** — publish spec, build reference router
5. **playsvideo integration** — TMDB search, watch providers, extension messaging to JSTorrent
6. **E2EE opt-in** — device-pairing key exchange for encrypted sync

Each step delivers standalone value. The full ecosystem emerges incrementally.
