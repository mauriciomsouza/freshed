/**
 * A pre-recorded freshed ai generation for the Brew workspace. The Studio
 * shows it when no API key is set, and tests replay it through the mock
 * provider. It is the raw tool input a model returned, before validation.
 */
export const recordedPrompt =
  'Add a referral screen at the end of onboarding with a code to copy and a share button'

export const recordedPlan = {
  summary: 'Add a referral step at the end of onboarding',
  slug: 'referral-step',
  newComponents: [
    {
      definition: {
        name: 'ReferralCode',
        category: 'Content',
        description: 'Shows a short code in a dashed ticket with a copy button.',
        props: {
          label: { type: 'string', maxLength: 40, default: 'Your code' },
          code: { type: 'string', required: true, maxLength: 16 },
          copy: {
            type: 'action',
            required: true,
            description: 'Usually a copy action with the code.',
          },
        },
      },
      purpose:
        'No registered component shows a copyable code; Card + Text cannot express the copy affordance.',
    },
  ],
  screens: [
    {
      slug: 'referral',
      title: 'Give a bag, get a bag',
      description: 'Referral offer shown after onboarding.',
      root: {
        id: 'root',
        type: 'Stack',
        props: { gap: 'lg', padding: 'lg', grow: true },
        children: [
          {
            id: 'hero',
            type: 'Hero',
            props: {
              eyebrow: 'One more thing',
              title: 'Give a bag, get a bag',
              subtitle: 'Friends get their first bag free. You get a free bag when theirs ships.',
              image: 'asset:gift',
              tone: 'roast',
            },
          },
          {
            id: 'code',
            type: 'ReferralCode',
            props: {
              label: 'Your code',
              code: 'BREW-ANA5',
              copy: { type: 'copy', text: 'BREW-ANA5' },
            },
          },
          { id: 'space', type: 'Spacer', props: { size: 'flex' } },
          {
            id: 'share',
            type: 'Button',
            props: {
              label: 'Share invite',
              action: {
                type: 'share',
                message: 'Your first bag of Brew is on me: use BREW-ANA5',
                url: 'https://brew.example/r/BREW-ANA5',
              },
            },
          },
          {
            id: 'skip',
            type: 'Button',
            props: {
              label: 'Maybe later',
              variant: 'ghost',
              action: { type: 'emit', event: 'done' },
            },
          },
        ],
      },
    },
  ],
  flowEdges: [
    { flow: 'onboarding', from: 'ready', event: 'finish', to: 'referral' },
    { flow: 'onboarding', from: 'referral', event: 'done', to: '@end' },
  ],
  notes: [
    'The referral code is a placeholder; the app should replace it per user before this goes live.',
    'Sharing uses the app share handler; copy uses the app clipboard handler.',
  ],
}

/** A deliberately broken first answer, used to exercise the repair turn in tests. */
export const recordedInvalidPlan = {
  ...recordedPlan,
  screens: [
    {
      ...recordedPlan.screens[0],
      root: {
        ...recordedPlan.screens[0]!.root,
        children: [
          ...recordedPlan.screens[0]!.root.children.slice(0, 1),
          { id: 'cta', type: 'Button', props: { label: 'Share', variant: 'loud' } },
        ],
      },
    },
  ],
}
