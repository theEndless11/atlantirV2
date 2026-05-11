import { cookies } from 'next/headers'
import { supabaseServer } from '@/lib/supabase'

export async function getAuthUser() {
  const db = await supabaseServer()
  const { data: { user }, error } = await db.auth.getUser()
  if (error || !user) return null
  return user
}
