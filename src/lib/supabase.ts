import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseMode = Boolean(url && anon)

let client: SupabaseClient | null = null

export function getSupabase() {
  if (!isSupabaseMode) return null
  if (!client) client = createClient(url!, anon!)
  return client
}
