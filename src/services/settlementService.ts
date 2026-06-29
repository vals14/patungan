import { supabase } from '../lib/supabase'

export type PayMethod = 'cash' | 'bank_transfer' | 'ewallet' | 'other'

// from_user / to_user are group_members.id (retargeted in migration 0005 to match
// the balance identity space used by expenses.paid_by and expense_splits.user_id).
export async function recordSettlement(
  groupId: string,
  fromMemberId: string,
  toMemberId: string,
  amount: number,
  method: PayMethod,
): Promise<void> {
  const { error } = await supabase.from('settlements').insert({
    group_id: groupId,
    from_user: fromMemberId,
    to_user: toMemberId,
    amount: Math.round(amount),
    method,
  })
  if (error) throw error
}

export async function undoSettlement(settlementId: string): Promise<void> {
  const { data, error } = await supabase
    .from('settlements')
    .delete()
    .eq('id', settlementId)
    .select('id')
  if (error) throw error
  // A blocked delete returns no error but removes 0 rows — surface that clearly.
  if (!data || data.length === 0) {
    throw new Error('Undo failed — no rows removed. Check the settlements DELETE policy/GRANT.')
  }
}

export async function getSettlements(groupId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('settlements')
    .select(`
      id, amount, method, settled_at,
      from_member:group_members!settlements_from_user_fkey (id, name, user:users(display_name)),
      to_member:group_members!settlements_to_user_fkey (id, name, user:users(display_name))
    `)
    .eq('group_id', groupId)
    .order('settled_at', { ascending: false })
  if (error) throw error
  return data ?? []
}
