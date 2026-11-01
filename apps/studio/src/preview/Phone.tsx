import {
  createDispatcher,
  createStaticClient,
  describeAction,
  FreshedProvider,
  ScreenRenderer,
  type ActionEvent,
  type ActionHandlers,
  type FallbackProps,
  type ResolveWarning,
} from '@freshed/react-native'
import { components as brewComponents } from '@freshed/example-expo-app/registry'
import type { ComponentDefinition, Screen } from '@freshed/schema'
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Text, View } from 'react-native'
import { aiComponents } from './ai-components'

/**
 * The phone frame renders screens with the app's own components and the
 * same renderer package the Expo app uses (react-native aliased to
 * react-native-web). Components the bundle does not have render the
 * development fallback, exactly as an old build would.
 */

const registryComponents = [...brewComponents, ...aiComponents]

export type LogEntry = { id: number; screen: string; label: string; handled: boolean }

function PreviewFallback({ node }: FallbackProps) {
  return (
    <View
      accessibilityRole="alert"
      style={{
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#c4323a',
        backgroundColor: '#fcebec',
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '600', color: '#9c1f27' }}>
        Unknown component “{node.type}”
      </Text>
      <Text style={{ fontSize: 11, color: '#9c1f27', marginTop: 2 }}>
        Old app builds skip this node. Add it to the registry to render it.
      </Text>
    </View>
  )
}

export function usePreviewLog() {
  const [log, setLog] = useState<LogEntry[]>([])
  const push = useCallback((screen: string, event: ActionEvent) => {
    setLog((l) =>
      [
        {
          id: Date.now() + Math.random(),
          screen,
          label: describeAction(event.action),
          handled: event.handled,
        },
        ...l,
      ].slice(0, 30),
    )
  }, [])
  const clear = useCallback(() => setLog([]), [])
  return { log, push, clear }
}

export function PhoneFrame({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div className="phone" role="region" aria-label={label ?? 'App preview'}>
      <div className="phone-screen">
        <div className="phone-island" aria-hidden />
        <div className="phone-status" aria-hidden>
          <span>9:41</span>
          <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
            <svg width="17" height="11" viewBox="0 0 17 11" fill="currentColor">
              <rect x="0" y="7" width="3" height="4" rx="1" />
              <rect x="4.5" y="5" width="3" height="6" rx="1" />
              <rect x="9" y="2.5" width="3" height="8.5" rx="1" />
              <rect x="13.5" y="0" width="3" height="11" rx="1" />
            </svg>
            <svg width="25" height="12" viewBox="0 0 25 12" fill="none">
              <rect
                x="0.5"
                y="0.5"
                width="21"
                height="11"
                rx="3.5"
                stroke="currentColor"
                opacity="0.4"
              />
              <rect x="2" y="2" width="16" height="8" rx="2" fill="currentColor" />
              <rect
                x="23"
                y="4"
                width="1.5"
                height="4"
                rx="0.75"
                fill="currentColor"
                opacity="0.4"
              />
            </svg>
          </span>
        </div>
        {children}
        <div className="phone-home" aria-hidden />
      </div>
    </div>
  )
}

export function ScreenPreview({
  screen,
  handlers,
  onAction,
  onWarning,
  extraComponents,
}: {
  screen: Screen
  handlers?: ActionHandlers
  onAction?: (e: ActionEvent) => void
  onWarning?: (w: ResolveWarning) => void
  /** Definitions the CMS knows but the bundle may not (e.g. AI-proposed); used only to show they exist. */
  extraComponents?: ComponentDefinition[]
}) {
  const client = useMemo(
    () => createStaticClient({ screens: () => [screen], flows: () => [] }),
    [screen],
  )
  // Swallow app-level actions in the preview; they are logged instead.
  const actions = useMemo<ActionHandlers>(
    () => ({
      openUrl: () => {},
      copy: () => {},
      share: () => {},
      dismiss: () => {},
      submit: () => {},
    }),
    [],
  )
  void extraComponents
  return (
    <FreshedProvider
      client={client}
      registry={registryComponents}
      actions={actions}
      fallback={PreviewFallback}
      onAction={onAction}
      onWarning={onWarning}
    >
      <div className="phone-body">
        <ScreenRenderer screen={screen} handlers={handlers} />
      </div>
    </FreshedProvider>
  )
}

/** For tests and the flow page: a dispatcher wired like the preview. */
export const previewDispatcher = createDispatcher
export const registeredNames: string[] = registryComponents.map((c) => c.name)
