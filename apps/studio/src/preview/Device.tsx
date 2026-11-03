import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { IconRotate, IconSafeArea } from '../ui/icons'
import {
  ASPECT_RATIOS,
  DEFAULT_SETTINGS,
  DEVICES,
  fitScale,
  matchAspect,
  parseSettings,
  resolveDevice,
  withAspect,
  withSize,
  type AspectId,
  type DeviceSettings,
  type Insets,
  type ResolvedDevice,
} from './devices'

/**
 * The device preview: a frame drawn at the device's logical resolution (one
 * point is one CSS pixel, so text wraps exactly as on the phone), scaled to
 * fit the light table. Content sits inside the safe area, like an app that
 * wraps screens in SafeAreaView (see examples/expo-app/App.tsx).
 */

// ---------- Settings, shared by every preview and remembered per browser ----------

const KEY = 'freshed:preview-device:v1'
const listeners = new Set<() => void>()
let current: DeviceSettings = load()

function load(): DeviceSettings {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? parseSettings(JSON.parse(raw)) : DEFAULT_SETTINGS
  } catch {
    return DEFAULT_SETTINGS
  }
}

function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function useDeviceSettings() {
  const settings = useSyncExternalStore(subscribe, () => current)
  const update = useCallback((fn: (s: DeviceSettings) => DeviceSettings) => {
    current = fn(current)
    try {
      localStorage.setItem(KEY, JSON.stringify(current))
    } catch {
      // Private windows can refuse storage; the setting still applies for this session.
    }
    listeners.forEach((l) => l())
  }, [])
  return [settings, update] as const
}

// ---------- Preview: controls, stage and readout ----------

const BEZEL = 12

export function DevicePreview({
  label,
  children,
  overlay,
}: {
  label: string
  children: ReactNode
  /** Drawn over the whole screen, outside the safe area (e.g. "Flow ended"). */
  overlay?: ReactNode
}) {
  const [settings, update] = useDeviceSettings()
  const device = resolveDevice(settings)
  const stage = useRef<HTMLDivElement>(null)
  const box = useBoxSize(stage)
  const frame = { width: device.width + BEZEL * 2, height: device.height + BEZEL * 2 }
  const scale = settings.zoom === 'actual' ? 1 : fitScale(frame, box)

  return (
    <>
      <DeviceBar settings={settings} device={device} update={update} />
      <div className="table-stage" ref={stage}>
        <div
          className="device-fit"
          style={{ width: frame.width * scale, height: frame.height * scale }}
        >
          <div
            style={{
              width: frame.width,
              height: frame.height,
              transform: `scale(${scale})`,
              transformOrigin: '0 0',
            }}
          >
            <DeviceFrame
              device={device}
              safeArea={settings.safeArea}
              label={label}
              overlay={overlay}
            >
              {children}
            </DeviceFrame>
          </div>
        </div>
      </div>
      <DeviceMeta settings={settings} device={device} update={update} scale={scale} />
    </>
  )
}

function useBoxSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const cs = getComputedStyle(el)
      const width = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const height = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

type Update = (fn: (s: DeviceSettings) => DeviceSettings) => void

function DeviceBar({
  settings,
  device,
  update,
}: {
  settings: DeviceSettings
  device: ResolvedDevice
  update: Update
}) {
  const aspect = matchAspect(device.width, device.height)
  const landscape = settings.orientation === 'landscape'
  return (
    <div className="device-bar" role="toolbar" aria-label="Preview device">
      <select
        className="select device-select"
        aria-label="Device"
        value={settings.custom ? 'custom' : settings.device}
        onChange={(e) => {
          const id = e.target.value
          if (id !== 'custom') update((s) => ({ ...s, device: id, custom: null }))
        }}
      >
        {(['iOS', 'Android'] as const).map((group) => (
          <optgroup key={group} label={group}>
            {DEVICES.filter((d) => d.group === group).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · {d.width}×{d.height}
              </option>
            ))}
          </optgroup>
        ))}
        {settings.custom ? (
          <option value="custom">Custom, {device.preset.name} safe area</option>
        ) : null}
      </select>
      <select
        className="select device-aspect"
        aria-label="Aspect ratio"
        value={aspect ?? 'other'}
        onChange={(e) => update((s) => withAspect(s, e.target.value as AspectId))}
      >
        {aspect ? null : (
          <option value="other" disabled>
            {device.aspect}
          </option>
        )}
        {ASPECT_RATIOS.map((a) => (
          <option key={a.id} value={a.id}>
            {a.id}
          </option>
        ))}
      </select>
      <button
        className="btn btn-sm icon-btn"
        aria-pressed={landscape}
        aria-label="Landscape"
        title={landscape ? 'Rotate to portrait' : 'Rotate to landscape'}
        onClick={() => update((s) => ({ ...s, orientation: landscape ? 'portrait' : 'landscape' }))}
      >
        <IconRotate />
      </button>
      <button
        className="btn btn-sm"
        aria-pressed={settings.safeArea}
        title={`Show the safe-area insets: top ${device.insets.top}, right ${device.insets.right}, bottom ${device.insets.bottom}, left ${device.insets.left}`}
        onClick={() => update((s) => ({ ...s, safeArea: !s.safeArea }))}
      >
        <IconSafeArea />
        Safe area
      </button>
    </div>
  )
}

function DeviceMeta({
  settings,
  device,
  update,
  scale,
}: {
  settings: DeviceSettings
  device: ResolvedDevice
  update: Update
  scale: number
}) {
  return (
    <div className="device-meta">
      <SizeInput
        label="Width in points"
        value={device.width}
        onCommit={(v) => update((s) => withSize(s, 'width', v))}
      />
      <span aria-hidden>×</span>
      <SizeInput
        label="Height in points"
        value={device.height}
        onCommit={(v) => update((s) => withSize(s, 'height', v))}
      />
      <span className="device-meta-text">pt · {device.aspect}</span>
      <span className="spacer" />
      <span className="device-meta-scale" title="Zoom">
        {Math.round(scale * 100)}%
      </span>
      <div className="segmented segmented-sm" role="group" aria-label="Zoom">
        <button
          aria-pressed={settings.zoom === 'fit'}
          onClick={() => update((s) => ({ ...s, zoom: 'fit' }))}
        >
          Fit
        </button>
        <button
          aria-pressed={settings.zoom === 'actual'}
          onClick={() => update((s) => ({ ...s, zoom: 'actual' }))}
        >
          100%
        </button>
      </div>
    </div>
  )
}

/** Commits on Enter or blur so typing "4" on the way to "412" does not clamp. */
function SizeInput({
  label,
  value,
  onCommit,
}: {
  label: string
  value: number
  onCommit: (v: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    if (draft !== null && draft.trim() !== '' && Number(draft) !== value) onCommit(Number(draft))
    setDraft(null)
  }
  return (
    <input
      className="input size-input"
      type="number"
      inputMode="numeric"
      aria-label={label}
      value={draft ?? value}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit()
        if (e.key === 'Escape') setDraft(null)
      }}
    />
  )
}

// ---------- The frame ----------

export function DeviceFrame({
  device,
  safeArea,
  label,
  overlay,
  children,
}: {
  device: ResolvedDevice
  safeArea: boolean
  label: string
  overlay?: ReactNode
  children: ReactNode
}) {
  const { preset, width, height, insets } = device
  const radius = preset.radius
  return (
    <div
      className="phone"
      role="region"
      aria-label={label}
      style={{
        width: width + BEZEL * 2,
        height: height + BEZEL * 2,
        padding: BEZEL,
        borderRadius: radius ? radius + BEZEL : 22,
      }}
    >
      <div className="phone-screen" style={{ borderRadius: radius }}>
        <div className="phone-content" style={insetStyle(insets)}>
          {children}
        </div>
        <Chrome device={device} />
        {safeArea ? <SafeAreaGuides insets={insets} /> : null}
        {overlay}
      </div>
    </div>
  )
}

const insetStyle = (i: Insets): CSSProperties => ({
  top: i.top,
  right: i.right,
  bottom: i.bottom,
  left: i.left,
})

/** Status bar, camera cutout and home indicator, drawn in the unsafe area. */
function Chrome({ device }: { device: ResolvedDevice }) {
  const { preset, insets, orientation, width } = device
  const landscape = orientation === 'landscape'
  const island = preset.cutout === 'island'
  const big = island && !landscape
  const homeWidth =
    preset.form === 'tablet' ? 320 : preset.group === 'iOS' ? (landscape ? 220 : 134) : 108
  return (
    <div aria-hidden>
      {insets.top >= 16 ? (
        <div
          className="phone-status"
          style={{
            height: insets.top,
            fontSize: big ? 16 : 12.5,
            padding: `0 ${Math.max(18, preset.radius * 0.6)}px`,
          }}
        >
          <span style={big ? { width: 54, textAlign: 'center' } : undefined}>9:41</span>
          <StatusIcons />
        </div>
      ) : null}
      {preset.cutout === 'island' ? (
        <div
          className="phone-island"
          style={
            landscape
              ? { left: 11, top: '50%', width: 37, height: 125, marginTop: -62.5 }
              : { top: 11, left: '50%', width: 125, height: 37, marginLeft: -62.5 }
          }
        />
      ) : null}
      {preset.cutout === 'punch' ? (
        <div
          className="phone-punch"
          style={
            landscape
              ? { left: Math.max(6, (insets.left - 12) / 2), top: '50%', marginTop: -6 }
              : { top: Math.max(6, (insets.top - 12) / 2), left: '50%', marginLeft: -6 }
          }
        />
      ) : null}
      {preset.homeIndicator && insets.bottom > 0 ? (
        <div
          className="phone-home"
          style={{
            width: Math.min(homeWidth, width * 0.6),
            height: preset.group === 'iOS' ? 5 : 4,
            bottom: preset.group === 'iOS' ? 8 : Math.max(4, (insets.bottom - 4) / 2),
          }}
        />
      ) : null}
    </div>
  )
}

function StatusIcons() {
  return (
    <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor">
        <rect x="0" y="7" width="3" height="4" rx="1" />
        <rect x="4.5" y="5" width="3" height="6" rx="1" />
        <rect x="9" y="2.5" width="3" height="8.5" rx="1" />
        <rect x="13.5" y="0" width="3" height="11" rx="1" />
      </svg>
      <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
        <rect x="0.5" y="0.5" width="21" height="11" rx="3.5" stroke="currentColor" opacity="0.4" />
        <rect x="2" y="2" width="16" height="8" rx="2" fill="currentColor" />
        <rect x="23" y="4" width="1.5" height="4" rx="0.75" fill="currentColor" opacity="0.4" />
      </svg>
    </span>
  )
}

/**
 * Hatched bands over the unsafe edges, each labelled with its inset in points.
 * Labels sit off-centre (CSS) so they never cover the cutout or the home bar.
 */
function SafeAreaGuides({ insets }: { insets: Insets }) {
  const { top, right, bottom, left } = insets
  return (
    <div className="safe-guides" aria-hidden>
      {top ? (
        <div className="safe-band" style={{ top: 0, left: 0, right: 0, height: top }}>
          <span>{top}</span>
        </div>
      ) : null}
      {bottom ? (
        <div className="safe-band" style={{ bottom: 0, left: 0, right: 0, height: bottom }}>
          <span>{bottom}</span>
        </div>
      ) : null}
      {left ? (
        <div className="safe-band safe-band-side" style={{ top, bottom, left: 0, width: left }}>
          <span>{left}</span>
        </div>
      ) : null}
      {right ? (
        <div className="safe-band safe-band-side" style={{ top, bottom, right: 0, width: right }}>
          <span>{right}</span>
        </div>
      ) : null}
      <div className="safe-rect" style={insetStyle(insets)} />
    </div>
  )
}
