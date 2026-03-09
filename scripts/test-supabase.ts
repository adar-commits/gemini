import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'fs'
import * as path from 'path'

// Load .env.local manually (Next.js doesn't load it outside the app)
const envPath = path.resolve(process.cwd(), '.env.local')
const envFile = require('fs').readFileSync(envPath, 'utf-8')
for (const line of envFile.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const [key, ...rest] = trimmed.split('=')
  if (key && rest.length) process.env[key.trim()] = rest.join('=').trim()
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(url, anonKey)

async function main() {
  console.log('Connecting to Supabase:', url)

  // List all tables via information_schema
  const { data: tables, error: tablesError } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .limit(10)

  if (tablesError) {
    // Fallback: try a direct query on a known common table name
    console.warn('Could not list tables:', tablesError.message)
    console.log('Trying a direct query...')

    const { data, error } = await supabase.from('users').select('*').limit(1)
    if (error) {
      console.error('Query failed:', error.message)
      console.log('\nConnection reached Supabase, but no accessible table found.')
      console.log('Try replacing "users" with an actual table name from your schema.')
    } else {
      console.log('Success! First row from "users":', data)
    }
    return
  }

  if (!tables || tables.length === 0) {
    console.log('Connected successfully, but no public tables found.')
    return
  }

  const firstTable = (tables[0] as { table_name: string }).table_name
  console.log(`Found tables: ${tables.map((t: { table_name: string }) => t.table_name).join(', ')}`)
  console.log(`\nFetching first row from "${firstTable}"...`)

  const { data, error } = await supabase.from(firstTable).select('*').limit(1)
  if (error) {
    console.error('Query failed:', error.message)
  } else {
    console.log('Success! First row:', JSON.stringify(data, null, 2))
  }
}

main()
