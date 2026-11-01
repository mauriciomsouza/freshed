import { connectPg, migrate } from './db.js'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required')
const db = await connectPg(url)
const ran = await migrate(db)
console.warn(ran.length ? `Applied: ${ran.join(', ')}` : 'Up to date')
await db.close()
