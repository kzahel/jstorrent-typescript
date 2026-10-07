# ChromeOS Hardware Testing

Topic: chromeos-hardware-testing

Status: current controller ownership; product evidence retains its exact source.

Last reconciled: 2026-10-08

## Authority and tool selection

The preferred public source is
[Machine Control](https://github.com/kzahel/machine-control), normally available
in the sibling checkout `~/code/machine-control`. Read its
[ChromeOS platform skill](https://github.com/kzahel/machine-control/blob/main/platforms/chromeos/skills/SKILL.md)
and [common CLI guide](https://github.com/kzahel/machine-control/blob/main/docs/cli-guide.md)
before a hardware session. The former `chromeos-testbed` repository is read-only
history unless explicitly documented as a generated distribution.

Keep generic device transport, desktop/browser control, captures, DevTools,
ARCVM ADB, Crostini and recovery in Machine Control. This repository owns
JSTorrent builds, controlled fixtures, product assertions and result records.
Do not copy the controller implementation or private inventory here.

Use unit/integration tests, diagnostic CLIs and scripted runners first when
they expose the required behavior. Real window/input/presentation tests may
need native accessibility or browser control; inspect semantic state before
coordinates. Use a separate test browser for automated browser checks and
reap it afterward. A delivered action is not evidence of the expected effect.

## Session ownership and cleanup

Start with read-only discovery and the selected target's doctor:

```bash
mc=~/code/machine-control/bin/machine-control
"$mc" targets
"$mc" --target chromeos target doctor
```

The target selector is configured privately; it is not an SSH address or a
credential. Verify exact identity and acquire the supported exclusive claim
before meaningful use, following the common CLI guide. Claims may not be
supported by every appliance adapter; record that capability explicitly.

Record initial VM power and owned test state. Boot a VM only for its prepared
check, shut it down between uses, and release claims in finally cleanup.
Build/approval waits are not active VM use. Join owned services, reap test
browsers, close forwarding/listener processes and remove only owned fixtures.
Preserve inherited production profiles, downloads and app data. Do not change
the dedicated physical ChromeOS appliance's idle/lid availability policy as
part of testing or cleanup.

## Project build and deployment boundary

Build the intended extension package with its project command, then delegate
platform deployment through the current common interface:

```bash
"$mc" --target chromeos testbed -- deploy-ext extension/dist \
  --name jstorrent-extension --reload dbokmlpefliilbjldladbimlcfgbolhk
```

Only use the target/package identity and replacement scope prepared for that
session. First unpacked loading may require native Chrome UI. Verify the
observed extension version and pairing result; an unpacked development install
is not preserved-profile Chrome Web Store update evidence.

Build Android with the normal Gradle command and selected identity/signature,
then delegate APK installation:

```bash
"$mc" --target chromeos testbed -- install-apk path/to/owned-candidate.apk
```

ADB authorization may show a real ChromeOS prompt. Follow the platform guide
and approve only an observed prompt; ordinary doctor deliberately does not
probe ADB. Never uninstall or clear an inherited production app to work around
a signature mismatch. Keep APK-development installation separate from actual
Play-managed delivery and verify the latter's installer/certificate/identity.

`scripts/deploy-chromebook.sh` and `scripts/deploy-android-chromebook.sh` still
use legacy CLI/SSH aliases and unowned tunnel helpers. They are compatibility
conveniences, not the preferred controller or cleanup contract; they have not
been migrated in this documentation slice. Use Machine Control and task-owned
forwarding from its guide rather than assuming those scripts qualify a current
restoring session. Keep actual target routes and secret locators private.

For captures and diagnostics, the current platform bridge includes:

```bash
"$mc" --target chromeos testbed -- desktop-tree --depth 3
"$mc" --target chromeos testbed -- screenshot path/to/owned-capture.png
"$mc" --target chromeos testbed -- diagnostics
```

## Play and fresh-install acceptance

Use a dedicated explicitly disposable installation for fresh-install testing;
retained production upgrade testing preserves the installed app and data.
A real Play flow must follow the extension's store handoff, install through
Play, verify its installer and managed signing identity, launch/pair through
the actual chooser, add a real SAF root and verify independent payload hashes.
An ADB APK install cannot substitute for that store leg.

Use unique fixture roots. Uninstalling an owned disposable app does not imply
permission to remove shared downloads; never recursively clear that directory.
Torrent removal and file deletion are separate assertions. APK development
can repeat chooser/pairing/SAF/transfer checks while explicitly excluding store
qualification. Preserve all earlier exact-version evidence below as historical.

## Crostini and recovery

Crostini is needed only for Linux-container assertions or shared-folder work.
Use the current Machine Control platform/native controls and ordinary Terminal
startup, then observe registration, connection, folder access and independent
bytes. The former `crostini-status/start/stop` commands are not present in the
current platform CLI and must not be treated as supported current commands.
Do not invent an administrative `vmc`/LXD shortcut as product startup evidence.

Reboot and OS-update recovery belong to the current platform guide. Routine
read-only doctor comes first. A signed-out profile, unreachable transport,
missing DevTools and a replaced root image are distinct states; repeated
reboots or Chrome restarts are not a generic repair. Stored credentials remain
in their approved secret transport and are never printed or passed in command
arguments. Root-image transitions and physical sign-in retain their explicit
controller boundaries.

## Historical product evidence

The 2026-07-24 exploratory physical run passed extension 1.1.1 / Play app
1.0.23 fresh installation, chooser/pairing/SAF and an independently verified
100-MiB transfer. Web-to-native handoff could leave Chrome in front; actual
chooser and Android surfaces sometimes needed native UI/pointer fallbacks.
See [the fresh-install record](../archive/reports/2026-07-24-chromeos-fresh-install-exploratory-test.md).

The same day's no-Play run used the then-public Crostini installer, ordinary
Terminal startup and observable host registration/health before automatic
extension discovery reached Ready. Linux payload transfer and actual ChromeOS
Flex remained separate gaps. See [the Crostini record](../archive/reports/2026-07-24-chromeos-crostini-no-play-store-test.md).

These records establish their dated artifacts and controller behavior, not
current replacement qualification. Current Rust replacement evidence belongs
to the replacement repository's cutover checklist and restoring runners.
