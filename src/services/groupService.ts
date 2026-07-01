import { supabase } from '../lib/supabase'
import { Group, GroupMember } from '../types/database'
import { getGroupBalances } from './balanceService'

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase()
}

export interface GroupWithBalance {
  group: Group
  memberCount: number
  expenseCount: number
  myBalance: number // positive = I am owed, negative = I owe
}

export async function getMyGroups(): Promise<GroupWithBalance[]> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: memberships, error } = await supabase
    .from('group_members')
    .select(`
      id,
      group:groups (
        id, name, currency, invite_code, created_by, created_at
      )
    `)
    .eq('user_id', user.id)

  if (error) throw error
  if (!memberships) return []

  const results: GroupWithBalance[] = await Promise.all(
    memberships.map(async (m: any) => {
      const group = m.group as Group
      // My identity in this group is the group_members row id, since expenses
      // and splits reference group_members (not users) — manual members included.
      const myMemberId = m.id as string

      const { count: memberCount } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', group.id)

      const { count: expenseCount } = await supabase
        .from('expenses')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', group.id)

      // Use the shared net formula (expenses − splits + settlements) so the home
      // balance always matches the group screen's Balances tab.
      const bal = await getGroupBalances(group.id)
      const myBalance = bal.members.find(b => b.memberId === myMemberId)?.net ?? 0

      return {
        group,
        memberCount: memberCount ?? 0,
        expenseCount: expenseCount ?? 0,
        myBalance,
      }
    })
  )

  return results
}

export async function createGroup(name: string, currency: string): Promise<Group> {
  const invite_code = generateInviteCode()

  const { data: groupId, error: rpcError } = await supabase
    .rpc('create_group', { p_name: name, p_currency: currency, p_invite_code: invite_code })

  if (rpcError) throw rpcError

  const { data: group, error: fetchError } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single()

  if (fetchError) throw fetchError

  return group
}

export async function joinGroupByCode(invite_code: string): Promise<Group> {
  // Look up + join via a SECURITY DEFINER RPC. A non-member can't SELECT the
  // group by code directly (members-only RLS), so the function does it safely.
  const { data: groupId, error } = await supabase
    .rpc('join_group_by_code', { p_code: invite_code.toUpperCase() })

  if (error) {
    const msg = (error.message || '').includes('Group not found')
      ? 'Group not found. Check the invite code and try again.'
      : error.message
    throw new Error(msg)
  }

  // Now a member, so the group is visible under RLS.
  const { data: group, error: fetchError } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single()

  if (fetchError) throw fetchError
  return group
}

export async function getGroupById(groupId: string): Promise<Group> {
  const { data, error } = await supabase
    .from('groups')
    .select('*')
    .eq('id', groupId)
    .single()

  if (error) throw error
  return data
}

export async function getGroupMembers(groupId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('group_members')
    .select(`
      id,
      name,
      joined_at,
      user:users (id, display_name, avatar_url)
    `)
    .eq('group_id', groupId)

  if (error) throw error
  return data ?? []
}

export function getMemberDisplayName(member: any): string {
  return member.user?.display_name ?? member.name ?? 'Unknown'
}

export async function addManualMember(groupId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .insert({ group_id: groupId, name: name.trim() })
  if (error) throw error
}

export async function updateMemberName(memberId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .update({ name: name.trim() })
    .eq('id', memberId)
  if (error) throw error
}

export async function removeMember(memberId: string): Promise<void> {
  const { data, error } = await supabase
    .from('group_members')
    .delete()
    .eq('id', memberId)
    .select('id')
  if (error) throw error
  // A blocked delete returns no error but removes 0 rows — surface that clearly.
  if (!data || data.length === 0) {
    throw new Error('Remove failed — no rows removed. Check the group_members DELETE policy/GRANT.')
  }
}

export async function deleteGroup(groupId: string): Promise<void> {
  // Delete child rows in FK order before deleting the group itself
  const { data: expenses } = await supabase
    .from('expenses')
    .select('id')
    .eq('group_id', groupId)

  if (expenses && expenses.length > 0) {
    const ids = expenses.map((e: any) => e.id)
    await supabase.from('expense_splits').delete().in('expense_id', ids)
    await supabase.from('expenses').delete().eq('group_id', groupId)
  }

  await supabase.from('settlements').delete().eq('group_id', groupId)
  await supabase.from('group_members').delete().eq('group_id', groupId)

  const { error } = await supabase.from('groups').delete().eq('id', groupId)
  if (error) throw error
}
