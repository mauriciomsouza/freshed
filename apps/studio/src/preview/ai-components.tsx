import { defineComponent, prop } from '@freshed/react-native'
import { Pressable, Text, View } from 'react-native'

/**
 * Preview implementations for components proposed by freshed ai in the
 * demo. In a real project these come from the app bundle after the
 * generated branch is reviewed and merged; the Studio preview mirrors
 * that bundle. Kept separate so it is obvious they are not part of Brew v1.
 */
export const ReferralCode = defineComponent(
  {
    name: 'ReferralCode',
    category: 'Content',
    description: 'Shows a short code in a dashed ticket with a copy button.',
    props: {
      label: prop.string({ maxLength: 40, default: 'Your code' }),
      code: prop.string({ required: true, maxLength: 16 }),
      copy: prop.action({ required: true }),
    },
  },
  ({ label, code, copy }) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderColor: '#C27A47',
        backgroundColor: '#FFF8F1',
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontSize: 13, fontWeight: '500', color: '#8C7E74' }}>{label}</Text>
        <Text style={{ fontSize: 22, fontWeight: '700', letterSpacing: 1.5, color: '#22170F' }}>
          {code}
        </Text>
      </View>
      <Pressable
        onPress={copy}
        accessibilityRole="button"
        accessibilityLabel={`Copy code ${code}`}
        style={{
          minHeight: 40,
          paddingHorizontal: 14,
          borderRadius: 999,
          justifyContent: 'center',
          backgroundColor: '#3A2518',
        }}
      >
        <Text style={{ color: '#FBF3EA', fontWeight: '600', fontSize: 14 }}>Copy</Text>
      </Pressable>
    </View>
  ),
)

export const aiComponents = [ReferralCode]
