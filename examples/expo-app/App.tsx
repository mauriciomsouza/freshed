import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  createClient,
  FreshedProvider,
  FreshedScreen,
  ScreenRenderer,
  useFlow,
  type ActionHandlers,
} from '@freshed/react-native'
import * as Clipboard from 'expo-clipboard'
import { StatusBar } from 'expo-status-bar'
import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  Text,
  View,
} from 'react-native'
import { registry } from './src/freshed/registry'
import { color } from './src/freshed/theme'

const client = createClient({
  baseUrl: process.env.EXPO_PUBLIC_FRESHED_URL ?? 'http://localhost:8787',
  apiKey: process.env.EXPO_PUBLIC_FRESHED_KEY ?? '',
  // Last good copy survives restarts, so onboarding works offline after the first launch.
  storage: AsyncStorage,
})

/** The app decides what each action means. The CMS only sends data. */
function useActionHandlers(onDismiss: () => void): ActionHandlers {
  return useMemo(
    () => ({
      openUrl: async ({ url }) => {
        if (await Linking.canOpenURL(url)) await Linking.openURL(url)
      },
      copy: async ({ text }) => {
        await Clipboard.setStringAsync(text)
      },
      share: async ({ message, url }) => {
        await Share.share({ message: url ? `${message} ${url}` : message })
      },
      dismiss: onDismiss,
      submit: ({ name }, { values }) => {
        // Route submissions to your own API here.
        console.warn('submit', name, values)
      },
    }),
    [onDismiss],
  )
}

function Onboarding({ onDone }: { onDone: () => void }) {
  const flow = useFlow('onboarding', { onEnd: onDone })
  if (flow.status === 'loading')
    return (
      <Centered>
        <ActivityIndicator color={color.ink} />
      </Centered>
    )
  if (flow.status === 'error' || !flow.screen) {
    return (
      <Centered>
        <Text style={{ color: color.inkSoft, textAlign: 'center' }}>
          Could not load onboarding. Check your connection and try again.
        </Text>
      </Centered>
    )
  }
  return (
    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <ScreenRenderer screen={flow.screen} handlers={flow.handlers} />
    </ScrollView>
  )
}

function Home({ onPromo }: { onPromo: () => void }) {
  return (
    <Centered>
      <Text style={{ fontSize: 24, fontWeight: '700', color: color.ink }}>Your plan</Text>
      <Text style={{ color: color.inkSoft, marginTop: 8 }}>Balanced & sweet, every two weeks.</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onPromo}
        style={{
          marginTop: 24,
          paddingVertical: 14,
          paddingHorizontal: 20,
          borderRadius: 999,
          backgroundColor: color.ink,
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>See this season’s blend</Text>
      </Pressable>
    </Centered>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {children}
    </View>
  )
}

export default function App() {
  const [route, setRoute] = useState<'onboarding' | 'home' | 'promo'>('onboarding')
  const actions = useActionHandlers(() => setRoute('home'))
  return (
    <FreshedProvider client={client} registry={registry} actions={actions}>
      <SafeAreaView style={{ flex: 1, backgroundColor: color.paper }}>
        <StatusBar style="dark" />
        {route === 'onboarding' && <Onboarding onDone={() => setRoute('home')} />}
        {route === 'home' && <Home onPromo={() => setRoute('promo')} />}
        {route === 'promo' && (
          <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
            <FreshedScreen slug="promo-holiday" loading={<ActivityIndicator color={color.ink} />} />
          </ScrollView>
        )}
      </SafeAreaView>
    </FreshedProvider>
  )
}
