import { createClient } from 'npm:@supabase/supabase-js@2.119.1'
import { crearTelegramHandler } from './handler.js'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})
Deno.serve(crearTelegramHandler({ db, env: (key: string) => Deno.env.get(key) }))
