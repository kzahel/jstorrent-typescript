import { useState, useRef, useEffect, useCallback } from 'react'
import { formatBytes } from '@jstorrent/ui'
import { getConfigDefault } from '@jstorrent/engine'
import { EngineProvider } from './context/EngineContext'
import { ConfigProvider } from './context/ConfigContext'
import { EngineManagerProvider } from './context/EngineManagerContext'
import { SearchPluginServiceProvider } from './context/SearchPluginServiceContext'
import { useConfigInit } from './hooks/useConfigInit'
import { createHostChannel } from './host/create-host-channel'
import { HostChannelProvider } from './host/HostChannelContext'
import { DaemonEngineManager } from './engine-manager/daemon-engine-manager'
import type { DownloadRoot } from './types'
import { useIOBridgeState, ConnectionStatus } from './hooks/useIOBridgeState'
import { useSystemBridge } from './hooks/useSystemBridge'
import { SystemIndicator } from './components/SystemIndicator'
import { SystemBridgePanel } from './components/SystemBridgePanel'
import { openExternalUrl } from './utils/external-links'
import { SystemBridgePanelChromeos } from './components/SystemBridgePanelChromeos'
import { SettingsOverlay } from './components/SettingsOverlay'
import { SearchPluginsOverlay } from './components/SearchPluginsOverlay'
import { useChromeOSBootstrap } from './hooks/useChromeOSBootstrap'
import { AppContent } from './AppContent'
import { copyTextToClipboard } from './utils/clipboard'
import { standaloneAlert } from './utils/dialogs'
import jsIcon from './assets/js-32.png?url'

// Re-export types for backwards compatibility
export type { AppContentProps, FileInfo } from './AppContent'

// Create the host channel and engine manager at module level
const channel = createHostChannel()
channel.connect() // fire-and-forget; state changes arrive via onStateChanged
const engineManager = new DaemonEngineManager(channel)
window.engineManager = engineManager

const isDevMode = channel.isDevMode()

/**
 * ChromeAppContent - Wrapper around AppContent that provides Chrome-specific callbacks.
 * Uses engineManager for file operations and channel for duplicate notifications.
 */
function ChromeAppContent({
  onOpenLoggingSettings,
  supportsVideoPopup,
  supportsLanShare,
  onOpenSearchOverlay,
}: {
  onOpenLoggingSettings?: () => void
  supportsVideoPopup: boolean
  supportsLanShare: boolean
  onOpenSearchOverlay?: () => void
}) {
  return (
    <AppContent
      onOpenLoggingSettings={onOpenLoggingSettings}
      onDuplicateTorrent={(name) => channel.notify({ type: 'duplicate-torrent', name })}
      onTorrentAdded={() => channel.notify({ type: 'torrent-added' })}
      isDevMode={isDevMode}
      onOpenFolder={async (torrentHash) => {
        const result = await engineManager.openTorrentFolder(torrentHash)
        if (!result.ok) {
          standaloneAlert(`Failed to open folder: ${result.error}`)
        }
      }}
      onOpenFile={async (torrentHash, file) => {
        const result = await engineManager.openFile(torrentHash, file.path)
        if (!result.ok) {
          standaloneAlert(`Failed to open file: ${result.error}`)
        }
      }}
      onRevealInFolder={async (torrentHash, file) => {
        const result = await engineManager.revealInFolder(torrentHash, file.path)
        if (!result.ok) {
          standaloneAlert(`Failed to reveal in folder: ${result.error}`)
        }
      }}
      onCopyFilePath={async (torrentHash, file) => {
        const fullPath = engineManager.getFilePath(torrentHash, file.path)
        if (fullPath) {
          await navigator.clipboard.writeText(fullPath)
        } else {
          standaloneAlert('Failed to get file path: storage root not found')
        }
      }}
      onCopyLanShareUrl={
        supportsLanShare
          ? async (torrentHash, file) => {
              const result = await engineManager.createLanShareUrl(torrentHash, file.path)
              if (!result.ok || !result.url) {
                standaloneAlert(`Failed to create LAN share URL: ${result.error}`)
                return
              }
              await copyTextToClipboard(result.url)
            }
          : undefined
      }
      onCreateDirectPlaybackUrl={
        supportsLanShare
          ? async (torrentHash, file) => {
              const result = await engineManager.createLanShareUrl(torrentHash, file.path)
              if (!result.ok || !result.url) {
                return null
              }
              return {
                url: result.url,
                mimeType: result.mimeType ?? null,
              }
            }
          : undefined
      }
      onOpenVideoPopup={
        supportsVideoPopup
          ? async (options) => {
              await channel.openVideoPlayerPopup(options)
            }
          : undefined
      }
      shareUrl={import.meta.env.SHARE_URL}
      onOpenSearchOverlay={onOpenSearchOverlay}
    />
  )
}

function App() {
  const [engine, setEngine] = useState<Awaited<ReturnType<typeof engineManager.init>> | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  const initStartedRef = useRef(false)
  const indicatorRef = useRef<HTMLButtonElement>(null)
  const [defaultRootKey, setDefaultRootKey] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [searchPluginsOpen, setSearchPluginsOpen] = useState(false)
  // Force re-render for stats updates (engine object is mutable)
  const [statsRevision, forceUpdate] = useState(0)

  // ConfigHub is available after engine init - apply UI caches when ready
  const configHub = engineManager.configHub
  useConfigInit(configHub)

  // NOTE: Rate limits, connection limits, UPnP, and logging settings are now
  // automatically propagated to the engine via ConfigHub subscriptions.
  // See: packages/engine/src/core/bt-engine.ts wireConfigSubscriptions()

  // Periodic refresh for header stats (engine object is mutable)
  useEffect(() => {
    if (!engine) return
    const interval = setInterval(() => forceUpdate((n) => n + 1), 1000)
    return () => clearInterval(interval)
  }, [engine])

  // Update tab title with transfer rates (every 5 seconds)
  useEffect(() => {
    if (!engine) {
      document.title = 'JSTorrent'
      return
    }
    // Only update title every 5th tick (5 seconds)
    if (statsRevision % 5 !== 0) return
    const downRate = engine.torrents.reduce((sum, t) => sum + t.downloadSpeed, 0)
    const upRate = engine.torrents.reduce((sum, t) => sum + t.uploadSpeed, 0)
    if (downRate > 0 || upRate > 0) {
      document.title = `JSTorrent - ↓${formatBytes(downRate)}/s ↑${formatBytes(upRate)}/s`
    } else {
      document.title = 'JSTorrent'
    }
  }, [engine, statsRevision])

  // Settings tab state (settings themselves come from context)
  const [settingsTab, setSettingsTab] = useState<
    'general' | 'interface' | 'network' | 'advanced' | 'profiles'
  >('general')

  // Handle native events from SW port
  // Always forward to engineManager - it queues events if engine not ready yet
  const handleNativeEvent = useCallback((event: string, payload: unknown) => {
    engineManager.handleNativeEvent(event, payload)
  }, [])

  // Open logging settings (memoized to prevent LogTable remounts)
  const handleOpenLoggingSettings = useCallback(() => {
    setSettingsTab('advanced')
    setSettingsOpen(true)
  }, [])

  // Subscribe to IOBridge state
  const {
    state: ioBridgeState,
    isConnected,
    hasEverConnected,
    retry,
    launch,
    cancel,
    takeOver,
    getStats,
    getMetrics,
    chromeosBootstrapState,
    chromeosHasEverConnected,
  } = useIOBridgeState({
    onNativeEvent: handleNativeEvent,
  })

  // ChromeOS bootstrap action callbacks
  const chromeosBootstrap = useChromeOSBootstrap()
  const supportsVideoPopup = ioBridgeState.platform !== 'tauri'
  const supportsLanShare = ioBridgeState.daemonInfo?.capabilities?.lan_share_urls === true

  // Track previous status to detect transitions
  const prevStatusRef = useRef<ConnectionStatus | null>(null)

  // Reset engine when daemon disconnects so we can reinitialize with fresh connection info
  useEffect(() => {
    const currentStatus = ioBridgeState.status
    const prevStatus = prevStatusRef.current

    // Detect transition from connected to disconnected
    if (prevStatus === 'connected' && currentStatus === 'disconnected') {
      console.log('[App] Daemon disconnected, resetting engine for reconnection')
      engineManager.reset()
      // Defer state updates to next microtask to avoid cascading renders
      queueMicrotask(() => {
        setEngine(null)
        setInitError(null)
      })
    }

    prevStatusRef.current = currentStatus
  }, [ioBridgeState.status])

  // Get roots from connected state
  const roots: DownloadRoot[] =
    ioBridgeState.status === 'connected' ? (ioBridgeState.roots ?? []) : []

  // Auto-select first accessible root as default when roots are available but no default is set.
  // This ensures the badge shows "Ready" (not "Setup") immediately when roots exist,
  // rather than waiting for engine init to set defaultRootKey.
  const effectiveDefaultRootKey =
    defaultRootKey ?? roots.find((r) => r.last_stat_ok !== false)?.key ?? null

  // Check if there are pending torrents (torrents added but not downloading)
  const hasPendingTorrents = engine
    ? engine.torrents.some((t) => t.userState === 'active' && !t.hasMetadata)
    : false

  // System bridge hook for UI state (panel, readiness indicator)
  const systemBridge = useSystemBridge({
    state: ioBridgeState as Parameters<typeof useSystemBridge>[0]['state'],
    roots,
    defaultRootKey: effectiveDefaultRootKey,
    hasPendingTorrents,
    extensionVersion: channel.getVersion(),
    getStats,
    getMetrics,
    onRetry: retry,
    onLaunch: launch,
    onCancel: cancel,
    onAddFolder: async () => {
      const existingRoots = roots.length
      const root = await engineManager.pickDownloadFolder()
      if (root) {
        // If this is the first root, set it as default
        if (existingRoots === 0) {
          setDefaultRootKey(root.key)
          await engineManager.setDefaultRoot(root.key)
        }
      }
    },
    onSetDefaultRoot: async (key: string) => {
      setDefaultRootKey(key)
      if (engine) {
        await engineManager.setDefaultRoot(key)
      }
    },
  })

  // Initialize engine when connected
  // Uses engineManager.engine as source of truth to handle reconnection scenarios
  useEffect(() => {
    if (!isConnected) {
      // Daemon disconnected - reset init flag to allow re-init on reconnect
      if (initStartedRef.current) {
        console.log('[App] Daemon disconnected, will re-init on reconnect')
        initStartedRef.current = false
      }
      return
    }

    // Skip if engine already exists or init already started
    if (engineManager.engine || initStartedRef.current || initError) {
      return
    }

    // Initialize engine
    initStartedRef.current = true
    engineManager
      .init()
      .then((eng) => {
        setEngine(eng)
        // Set default root from engine (getDefaultRoot returns the key string)
        const currentDefault = eng.storageRootManager.getDefaultRoot()
        if (currentDefault) {
          setDefaultRootKey(currentDefault)
        }
      })
      .catch((e) => {
        console.error('Failed to initialize engine:', e)
        setInitError(String(e))
        initStartedRef.current = false // Allow retry on error
      })
  }, [isConnected, initError])

  // Render UI - ConfigProvider wraps content when configHub is available
  // The useConfigInit hook handles applying theme/maxFps/progressBarStyle when ready
  const content = (
    <EngineManagerProvider manager={engineManager}>
      <SearchPluginServiceProvider>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Header with System Bridge indicator */}
          <div
            style={{
              padding: '8px 16px',
              flexWrap: 'wrap',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src={jsIcon} alt="JSTorrent" style={{ width: '24px', height: '24px' }} />
              <h1 style={{ margin: 0, fontSize: '18px' }}>JSTorrent</h1>
            </div>

            {/* System Bridge indicator */}
            <div style={{ position: 'relative' }}>
              <SystemIndicator
                ref={indicatorRef}
                label={systemBridge.readiness.indicator.label}
                color={systemBridge.readiness.indicator.color}
                pulse={systemBridge.readiness.pulse}
                onClick={systemBridge.togglePanel}
              />
              {systemBridge.panelOpen &&
                (ioBridgeState.platform === 'chromeos' && chromeosBootstrapState ? (
                  <SystemBridgePanelChromeos
                    state={chromeosBootstrapState}
                    daemonVersion={systemBridge.daemonVersion}
                    versionStatus={systemBridge.versionStatus}
                    appVersion={channel.getVersion()}
                    roots={roots}
                    defaultRootKey={effectiveDefaultRootKey}
                    hasEverConnected={chromeosHasEverConnected}
                    onClose={systemBridge.closePanel}
                    onLaunch={chromeosBootstrap.openIntent}
                    onResetPairing={chromeosBootstrap.resetPairing}
                    onAddFolder={async () => {
                      const existingRoots = engineManager.getRoots().length
                      const root = await engineManager.pickDownloadFolder()
                      if (root) {
                        if (existingRoots === 0) {
                          setDefaultRootKey(root.key)
                          await engineManager.setDefaultRoot(root.key)
                        }
                      }
                    }}
                    onOpenSettings={() => setSettingsOpen(true)}
                    anchorRef={indicatorRef}
                    onFetchStats={getStats}
                    backendType={systemBridge.backendType}
                    ioBridgeConnected={ioBridgeState.status === 'connected'}
                    daemonHost={ioBridgeState.daemonInfo?.host ?? undefined}
                    daemonPort={ioBridgeState.daemonInfo?.port}
                  />
                ) : (
                  <SystemBridgePanel
                    state={ioBridgeState as Parameters<typeof SystemBridgePanel>[0]['state']}
                    versionStatus={systemBridge.versionStatus}
                    backendType={systemBridge.backendType}
                    daemonVersion={systemBridge.daemonVersion}
                    appVersion={channel.getVersion()}
                    roots={roots}
                    defaultRootKey={effectiveDefaultRootKey}
                    hasEverConnected={hasEverConnected}
                    rootsManageable={engineManager.rootsManageable}
                    onRetry={retry}
                    onLaunch={launch}
                    onCancel={cancel}
                    onTakeOver={takeOver}
                    onAddFolder={async () => {
                      const existingRoots = engineManager.getRoots().length
                      const root = await engineManager.pickDownloadFolder()
                      if (root) {
                        if (existingRoots === 0) {
                          setDefaultRootKey(root.key)
                          await engineManager.setDefaultRoot(root.key)
                        }
                      }
                    }}
                    onSetDefaultRoot={(key) => {
                      setDefaultRootKey(key)
                      engineManager.setDefaultRoot(key)
                    }}
                    onClose={systemBridge.closePanel}
                    onOpenSettings={() => setSettingsOpen(true)}
                    onFetchStats={getStats}
                    anchorRef={indicatorRef}
                  />
                ))}
            </div>

            <div
              style={{
                marginLeft: 'auto',
                display: 'flex',
                flexWrap: 'wrap',
                maxWidth: '100%',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                {engine ? (
                  <>
                    {engine.torrents.length} torrents | {engine.numConnections} peers | ↓{' '}
                    {formatBytes(engine.torrents.reduce((sum, t) => sum + t.downloadSpeed, 0))}/s |
                    ↑ {formatBytes(engine.torrents.reduce((sum, t) => sum + t.uploadSpeed, 0))}/s
                  </>
                ) : isConnected ? (
                  'Initializing...'
                ) : (
                  'Not connected'
                )}
              </span>
              <button
                onClick={async () => openExternalUrl(await systemBridge.getBugReportUrl())}
                style={{
                  background: 'var(--button-bg)',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  padding: '6px 12px',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                title="Report a bug or send feedback"
              >
                <span style={{ fontSize: '14px' }}>&#x1F41B;</span>
                Report Bug
              </button>
              <button
                onClick={() => setSearchPluginsOpen(true)}
                style={{
                  background: 'var(--button-bg)',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  padding: '6px 12px',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
                title="Manage search plugins"
              >
                <span style={{ fontSize: '14px' }}>⌕</span>
                Plugins
              </button>
              <button
                onClick={() => setSettingsOpen(true)}
                style={{
                  background: 'var(--button-bg)',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  padding: '6px 12px',
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <span style={{ fontSize: '16px' }}>⚙</span>
                Settings
              </button>
            </div>
          </div>

          {/* Main content */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {engine ? (
              <EngineProvider engine={engine}>
                <ChromeAppContent
                  onOpenLoggingSettings={handleOpenLoggingSettings}
                  supportsVideoPopup={supportsVideoPopup}
                  supportsLanShare={supportsLanShare}
                  onOpenSearchOverlay={() => setSearchPluginsOpen(true)}
                />
              </EngineProvider>
            ) : initError ? (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <div style={{ color: 'var(--accent-error)', marginBottom: '16px' }}>
                  Failed to initialize: {initError}
                </div>
                <button
                  onClick={() => {
                    setInitError(null)
                    retry()
                  }}
                >
                  Retry
                </button>
              </div>
            ) : (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                {ioBridgeState.status === 'connecting' && 'Connecting to daemon...'}
                {ioBridgeState.status === 'disconnected' &&
                  (ioBridgeState.platform === 'chromeos'
                    ? 'Click the indicator above to launch the companion app.'
                    : 'Click the indicator above to set up JSTorrent.')}
                {ioBridgeState.status === 'connected' && !engine && 'Initializing engine...'}
              </div>
            )}
          </div>

          {/* Profile in use overlay */}
          {ioBridgeState.status === 'disconnected' &&
            ioBridgeState.lastError === 'profile_in_use' && (
              <div
                style={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background: 'rgba(0, 0, 0, 0.5)',
                  backdropFilter: 'blur(4px)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                }}
              >
                <div
                  style={{
                    background: 'var(--bg-primary)',
                    borderRadius: '8px',
                    padding: '32px',
                    maxWidth: '400px',
                    textAlign: 'center',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                  }}
                >
                  <div
                    style={{
                      fontSize: '18px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      marginBottom: '12px',
                    }}
                  >
                    Profile In Use
                  </div>
                  <div
                    style={{
                      color: 'var(--text-secondary)',
                      marginBottom: '24px',
                      lineHeight: 1.5,
                    }}
                  >
                    {ioBridgeState.profileInUseInfo?.clientType
                      ? `This profile is in use by ${ioBridgeState.profileInUseInfo.clientType}${ioBridgeState.profileInUseInfo.clientVersion ? ` v${ioBridgeState.profileInUseInfo.clientVersion}` : ''}.`
                      : 'This profile is currently in use by another client.'}
                  </div>
                  <button
                    onClick={takeOver}
                    style={{
                      padding: '10px 20px',
                      background: 'var(--accent-primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      fontWeight: 500,
                    }}
                  >
                    Take Over Profile
                  </button>
                </div>
              </div>
            )}

          {/* Settings overlay - only render when config is available */}
          {configHub && (
            <SettingsOverlay
              isOpen={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              activeTab={settingsTab}
              setActiveTab={setSettingsTab}
            />
          )}
          <SearchPluginsOverlay
            isOpen={searchPluginsOpen}
            onClose={() => setSearchPluginsOpen(false)}
          />
        </div>
      </SearchPluginServiceProvider>
    </EngineManagerProvider>
  )

  // Wrap with ConfigProvider when configHub is available, otherwise just return content
  // ConfigProvider requires a non-null config, so we can't wrap before engine init
  if (configHub) {
    return (
      <ConfigProvider config={configHub} getDefault={getConfigDefault}>
        {content}
      </ConfigProvider>
    )
  }

  return content
}

function AppWithChannel() {
  return (
    <HostChannelProvider channel={channel}>
      <App />
    </HostChannelProvider>
  )
}

export { AppWithChannel as App, AppContent }
