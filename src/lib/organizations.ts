import { supabase } from './supabase'
import type { Organization } from '@/types/organization'

export async function listOrganizations(): Promise<Organization[]> {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, slug, plan')
    .order('name', { ascending: true })

  if (error) {
    throw error
  }
  return data ?? []
}
