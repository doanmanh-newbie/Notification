import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config'

/** Single Supabase client; null until the anon key is configured, in which case the app runs local-only. */
export const supabase: SupabaseClient | null = SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null
