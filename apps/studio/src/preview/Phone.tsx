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
} from '@freshed-cms/react-native'
import { components as brewComponents } from '@freshed-cms/example-expo-app/registry'
import type { ComponentDefinition, Screen } from '@freshed-cms/schema'
import { useCallback, useMemo, useState } from 'react'
import { Text, View } from 'react-native'
import { aiComponents } from './ai-components'

/**
 * The preview renders screens with the app's own components and the same
 * renderer package the Expo app uses (react-native aliased to
 * react-native-web). Components the bundle does not have render the
 * development fallback, exactly as an old build would. The device frame
 * around it lives in ./Device.tsx.
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
