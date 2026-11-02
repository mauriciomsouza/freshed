export * from './ai-recording.js'
export * from './components.js'
export * from './content.js'

import type { Workspace } from '@freshed-cms/schema'
import { brewComponents } from './components.js'
import { brewFlows, brewScreens } from './content.js'

/** The full Brew workspace, as drafts. */
export function brewWorkspace(): Workspace {
  return structuredClone({ components: brewComponents, screens: brewScreens, flows: brewFlows })
}
