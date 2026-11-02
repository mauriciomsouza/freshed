import type { Flow, Screen } from '@freshed-cms/schema'

/**
 * Seed content for the fictional Brew app. Images reference `asset:` names
 * bundled in the app (illustrations), never remote code.
 */

export const welcome: Screen = {
  slug: 'welcome',
  title: 'Welcome',
  description: 'First screen of onboarding.',
  root: {
    id: 'root',
    type: 'Stack',
    props: { gap: 'lg', padding: 'lg', grow: true },
    children: [
      {
        id: 'hero',
        type: 'Hero',
        props: {
          eyebrow: 'Brew',
          title: 'Fresh beans, on your schedule',
          subtitle: 'Specialty coffee roasted to order and delivered before it goes stale.',
          image: 'asset:beans',
          tone: 'cream',
        },
      },
      {
        id: 'perks',
        type: 'List',
        props: {
          items: [
            'Roasted within 48 hours of shipping',
            'Pause or skip any delivery',
            'Free shipping, always',
          ],
          style: 'check',
        },
      },
      { id: 'space', type: 'Spacer', props: { size: 'flex' } },
      {
        id: 'cta',
        type: 'Button',
        props: { label: 'Get started', action: { type: 'emit', event: 'next' } },
      },
      {
        id: 'signin',
        type: 'Button',
        props: {
          label: 'I already have an account',
          variant: 'ghost',
          action: { type: 'emit', event: 'signin' },
        },
      },
    ],
  },
}

export const taste: Screen = {
  slug: 'taste',
  title: 'Your taste',
  description: 'Pick a roast profile.',
  root: {
    id: 'root',
    type: 'Stack',
    props: { gap: 'md', padding: 'lg', grow: true },
    children: [
      {
        id: 'step',
        type: 'Text',
        props: { text: 'Step 1 of 3', variant: 'caption', tone: 'muted' },
      },
      {
        id: 'title',
        type: 'Text',
        props: { text: 'How do you take your coffee?', variant: 'title' },
      },
      {
        id: 'light',
        type: 'Card',
        props: {
          title: 'Bright & fruity',
          caption: 'Light roasts with notes of berries and citrus.',
          action: { type: 'emit', event: 'next' },
        },
      },
      {
        id: 'medium',
        type: 'Card',
        props: {
          title: 'Balanced & sweet',
          caption: 'Caramel, milk chocolate, a little nutty.',
          badge: 'Popular',
          selected: true,
          action: { type: 'emit', event: 'next' },
        },
      },
      {
        id: 'dark',
        type: 'Card',
        props: {
          title: 'Bold & rich',
          caption: 'Dark chocolate and toasted spice. Great with milk.',
          action: { type: 'emit', event: 'next' },
        },
      },
      { id: 'space', type: 'Spacer', props: { size: 'flex' } },
      {
        id: 'cta',
        type: 'Button',
        props: { label: 'Continue', action: { type: 'emit', event: 'next' } },
      },
    ],
  },
}

export const cadence: Screen = {
  slug: 'cadence',
  title: 'Delivery cadence',
  root: {
    id: 'root',
    type: 'Stack',
    props: { gap: 'md', padding: 'lg', grow: true },
    children: [
      {
        id: 'step',
        type: 'Text',
        props: { text: 'Step 2 of 3', variant: 'caption', tone: 'muted' },
      },
      {
        id: 'title',
        type: 'Text',
        props: { text: 'How often should we deliver?', variant: 'title' },
      },
      {
        id: 'image',
        type: 'Image',
        props: {
          src: 'asset:calendar',
          alt: 'A calendar with every other week marked',
          aspect: 'wide',
        },
      },
      {
        id: 'weekly',
        type: 'Card',
        props: {
          title: 'Every week',
          caption: '250 g · for daily drinkers',
          action: { type: 'emit', event: 'next' },
        },
      },
      {
        id: 'biweekly',
        type: 'Card',
        props: {
          title: 'Every two weeks',
          caption: '250 g · most people pick this',
          badge: 'Best value',
          selected: true,
          action: { type: 'emit', event: 'next' },
        },
      },
      { id: 'space', type: 'Spacer', props: { size: 'flex' } },
      {
        id: 'cta',
        type: 'Button',
        props: { label: 'Continue', action: { type: 'emit', event: 'next' } },
      },
      {
        id: 'back',
        type: 'Button',
        props: { label: 'Back', variant: 'ghost', action: { type: 'back' } },
      },
    ],
  },
}

export const ready: Screen = {
  slug: 'ready',
  title: 'All set',
  root: {
    id: 'root',
    type: 'Stack',
    props: { gap: 'lg', padding: 'lg', grow: true },
    children: [
      {
        id: 'hero',
        type: 'Hero',
        props: {
          eyebrow: 'Step 3 of 3',
          title: 'Your first bag ships Monday',
          subtitle: 'Balanced & sweet, every two weeks. Change it anytime from your plan.',
          image: 'asset:box',
          tone: 'sage',
        },
      },
      { id: 'space', type: 'Spacer', props: { size: 'flex' } },
      {
        id: 'cta',
        type: 'Button',
        props: { label: 'Start brewing', action: { type: 'emit', event: 'finish' } },
      },
      {
        id: 'terms',
        type: 'Text',
        props: {
          text: 'You can pause or cancel in two taps. No fees.',
          variant: 'caption',
          align: 'center',
          tone: 'muted',
        },
      },
    ],
  },
}

export const promoHoliday: Screen = {
  slug: 'promo-holiday',
  title: 'Holiday blend promo',
  description: 'Seasonal promo shown from the home screen.',
  root: {
    id: 'root',
    type: 'Stack',
    props: { gap: 'lg', padding: 'lg', grow: true },
    children: [
      {
        id: 'hero',
        type: 'Hero',
        props: {
          eyebrow: 'Limited release',
          title: 'Winter Ember blend',
          subtitle:
            'Cocoa, orange peel and a hint of clove. Roasted in small batches until January.',
          image: 'asset:ember',
          tone: 'berry',
        },
      },
      {
        id: 'offer',
        type: 'Card',
        props: {
          title: '20% off your next bag',
          caption: 'Applied automatically at checkout.',
          badge: 'Members',
        },
        children: [
          {
            id: 'details',
            type: 'List',
            props: {
              items: ['Whole bean or ground', 'Ships with your next delivery'],
              style: 'bullet',
            },
          },
        ],
      },
      { id: 'space', type: 'Spacer', props: { size: 'flex' } },
      {
        id: 'cta',
        type: 'Button',
        props: {
          label: 'Add to next delivery',
          action: { type: 'openUrl', url: 'brew://plan/add?sku=winter-ember' },
        },
      },
      {
        id: 'later',
        type: 'Button',
        props: { label: 'Not now', variant: 'ghost', action: { type: 'dismiss' } },
      },
    ],
  },
}

export const onboarding: Flow = {
  slug: 'onboarding',
  title: 'Onboarding',
  description: 'First-run flow: welcome, taste, cadence, confirmation.',
  start: 'welcome',
  screens: ['welcome', 'taste', 'cadence', 'ready'],
  edges: [
    { from: 'welcome', event: 'next', to: 'taste' },
    { from: 'welcome', event: 'signin', to: '@end' },
    { from: 'taste', event: 'next', to: 'cadence' },
    { from: 'cadence', event: 'next', to: 'ready' },
    { from: 'ready', event: 'finish', to: '@end' },
  ],
}

export const brewScreens: Screen[] = [welcome, taste, cadence, ready, promoHoliday]
export const brewFlows: Flow[] = [onboarding]

/**
 * Earlier published states, so the version history in the seed has a real
 * story: v1 shipped a 3-screen onboarding; v2 added the cadence step; v3
 * added the holiday promo.
 */
export const seedHistory = [
  {
    message: 'Initial onboarding',
    screens: [
      {
        ...welcome,
        root: {
          ...welcome.root,
          children: welcome.root.children?.filter((c) => c.id !== 'signin'),
        },
      },
      taste,
      ready,
    ],
    flows: [
      {
        ...onboarding,
        screens: ['welcome', 'taste', 'ready'],
        edges: [
          { from: 'welcome', event: 'next', to: 'taste' },
          { from: 'taste', event: 'next', to: 'ready' },
          { from: 'ready', event: 'finish', to: '@end' },
        ],
      },
    ],
  },
  {
    message: 'Add delivery cadence step',
    screens: [welcome, taste, cadence, ready],
    flows: [onboarding],
  },
  { message: 'Winter Ember promo', screens: brewScreens, flows: brewFlows },
] satisfies { message: string; screens: Screen[]; flows: Flow[] }[]
