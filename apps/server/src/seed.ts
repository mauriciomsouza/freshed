import { brewComponents, brewFlows, brewScreens, seedHistory } from '@freshed/example-brew'
import type { Db } from './db.js'
import { createStore } from './store.js'

/**
 * Seeds the fictional Brew project: components, three published versions
 * with a real history, and drafts equal to the latest version.
 * Safe to run twice: it does nothing if any version exists.
 */
export async function seed(db: Db): Promise<{ seeded: boolean }> {
  const existing = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM versions')
  if ((existing[0]?.n ?? 0) > 0) return { seeded: false }
  const store = createStore(db)
  for (const c of brewComponents) await store.upsertComponent(c)
  for (const step of seedHistory) {
    await store.replaceDrafts({
      components: brewComponents,
      screens: step.screens,
      flows: step.flows,
    })
    await store.publish({ message: step.message, createdBy: 'seed' })
  }
  await store.replaceDrafts({ components: brewComponents, screens: brewScreens, flows: brewFlows })
  return { seeded: true }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { connectPg, migrate } = await import('./db.js')
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  const db = await connectPg(url)
  await migrate(db)
  console.log((await seed(db)).seeded ? 'Seeded Brew demo project' : 'Already seeded')
  await db.close()
}
