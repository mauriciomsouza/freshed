import { componentSpec, prop, type ComponentDefinition } from '@freshed-cms/schema'

/**
 * Component specs for the fictional Brew app. These are plain data: the
 * Expo app pairs each one with a React Native implementation via
 * `defineComponent`, and the server seeds them as ComponentDefinitions.
 */

export const Stack = componentSpec({
  name: 'Stack',
  category: 'Layout',
  description: 'Vertical or horizontal stack with consistent spacing.',
  children: true,
  props: {
    direction: prop.enum(['vertical', 'horizontal'], { default: 'vertical' }),
    gap: prop.enum(['none', 'xs', 'sm', 'md', 'lg', 'xl'], { default: 'md' }),
    padding: prop.enum(['none', 'sm', 'md', 'lg'], { default: 'none' }),
    align: prop.enum(['start', 'center', 'end', 'stretch'], { default: 'stretch' }),
    grow: prop.boolean({
      description: 'Fill remaining space; pushes later siblings to the bottom.',
    }),
  },
})

export const Hero = componentSpec({
  name: 'Hero',
  category: 'Content',
  description: 'Large illustration with an eyebrow, title and supporting copy.',
  props: {
    eyebrow: prop.string({ maxLength: 40 }),
    title: prop.string({ required: true, maxLength: 80 }),
    subtitle: prop.string({ maxLength: 200, multiline: true }),
    image: prop.image({ description: 'https URL or asset:<name> bundled in the app.' }),
    tone: prop.enum(['cream', 'roast', 'sage', 'berry'], { default: 'cream' }),
  },
})

export const Text = componentSpec({
  name: 'Text',
  category: 'Content',
  description: 'Body copy, headings and captions from the type scale.',
  props: {
    text: prop.string({ required: true, multiline: true, maxLength: 600 }),
    variant: prop.enum(['title', 'heading', 'body', 'caption'], { default: 'body' }),
    align: prop.enum(['start', 'center'], { default: 'start' }),
    tone: prop.enum(['default', 'muted', 'accent'], { default: 'default' }),
  },
})

export const Button = componentSpec({
  name: 'Button',
  category: 'Input',
  description: 'Primary, secondary or text button that triggers an action.',
  props: {
    label: prop.string({ required: true, maxLength: 32 }),
    variant: prop.enum(['primary', 'secondary', 'ghost'], { default: 'primary' }),
    action: prop.action({ required: true }),
    accessibilityHint: prop.string({
      maxLength: 120,
      description: 'Read by screen readers after the label.',
    }),
  },
})

export const Image = componentSpec({
  name: 'Image',
  category: 'Content',
  description: 'Image or illustration with required alt text.',
  props: {
    src: prop.image({ required: true }),
    alt: prop.string({
      required: true,
      maxLength: 160,
      description: 'Describes the image for screen readers.',
    }),
    aspect: prop.enum(['square', 'wide', 'tall'], { default: 'wide' }),
    rounded: prop.boolean({ default: true }),
  },
})

export const Card = componentSpec({
  name: 'Card',
  category: 'Layout',
  description: 'Surface that groups related content; optionally selectable.',
  children: true,
  props: {
    title: prop.string({ maxLength: 60 }),
    caption: prop.string({ maxLength: 120 }),
    badge: prop.string({ maxLength: 20 }),
    selected: prop.boolean(),
    action: prop.action({ description: 'Makes the whole card pressable.' }),
  },
})

export const List = componentSpec({
  name: 'List',
  category: 'Content',
  description: 'Bulleted, numbered or checked list of short items.',
  props: {
    items: prop.stringList({ required: true, maxItems: 8 }),
    style: prop.enum(['bullet', 'number', 'check'], { default: 'check' }),
  },
})

export const Spacer = componentSpec({
  name: 'Spacer',
  category: 'Layout',
  description: 'Fixed vertical space, or flexible space that fills the screen.',
  props: {
    size: prop.enum(['xs', 'sm', 'md', 'lg', 'xl', 'flex'], { default: 'md' }),
  },
})

export const brewComponents: ComponentDefinition[] = [
  Stack,
  Hero,
  Text,
  Button,
  Image,
  Card,
  List,
  Spacer,
]
