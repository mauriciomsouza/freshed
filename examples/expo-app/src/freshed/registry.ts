import { createRegistry } from '@freshed/react-native'
import { Button, Card, Hero, Image, List, Spacer, Stack, Text } from './components'
// freshed:imports

/**
 * Every component the CMS can use. `freshed ai` adds new entries between
 * the markers; keep them in place.
 */
export const components = [
  Stack,
  Hero,
  Text,
  Button,
  Image,
  Card,
  List,
  Spacer,
  // freshed:components
]

export const registry = createRegistry(components)
