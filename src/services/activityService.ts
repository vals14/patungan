import { supabase } from '../lib/supabase'

export interface ActivityItem {
  key: string
  kind: 'expense' | 'settlement'
  at: string
  groupId: string
  groupName: string
  currency: string
  amount: number
  // expense
  category?: string
  title?: string
  actor?: string
  expenseId?: string
  itemized?: boolean
  // settlement
  fromName?: string
  toName?: string
  method?: string
}

function memberName(member: any, myUserId?: string): string {
  const uid = member?.user?.id
  if (uid && myUserId && uid === myUserId) return 'You'
  return member?.user?.display_name ?? member?.name ?? 'Someone'
}

// A global feed of the money events (expenses added + settlements recorded)
// across every group you're a member of, newest first.
export async function getActivityFeed(limit = 60): Promise<ActivityItem[]> {
  const { data: { user } } = await supabase.auth.getUser()
  const myUserId = user?.id

  const { data: mems } = await supabase
    .from('group_members')
    .select('group:groups(id, name, currency)')
    .eq('user_id', myUserId)

  const groupMap: Record<string, { name: string; currency: string }> = {}
  const ids: string[] = []
  ;(mems ?? []).forEach((m: any) => {
    const g = m.group
    if (g && !groupMap[g.id]) { groupMap[g.id] = { name: g.name, currency: g.currency }; ids.push(g.id) }
  })
  if (ids.length === 0) return []

  const { data: expenses } = await supabase
    .from('expenses')
    .select('id, title, category, total_amount, currency, created_at, group_id, itemization, paid_by_member:group_members!expenses_paid_by_fkey(id, name, user:users(id, display_name))')
    .in('group_id', ids)
    .order('created_at', { ascending: false })
    .limit(limit)

  // Settlements depend on migration 0005's FK hint — keep non-fatal so the feed
  // still renders expenses if that migration hasn't been applied.
  let settlements: any[] = []
  try {
    const { data } = await supabase
      .from('settlements')
      .select('id, amount, method, settled_at, group_id, from_member:group_members!settlements_from_user_fkey(id, name, user:users(id, display_name)), to_member:group_members!settlements_to_user_fkey(id, name, user:users(id, display_name))')
      .in('group_id', ids)
      .order('settled_at', { ascending: false })
      .limit(limit)
    settlements = data ?? []
  } catch { settlements = [] }

  const items: ActivityItem[] = []

  ;(expenses ?? []).forEach((e: any) => {
    const g = groupMap[e.group_id]
    items.push({
      key: 'e_' + e.id,
      kind: 'expense',
      at: e.created_at,
      groupId: e.group_id,
      groupName: g?.name ?? '',
      currency: e.currency,
      amount: Number(e.total_amount),
      category: e.category,
      title: e.title,
      actor: memberName(e.paid_by_member, myUserId),
      expenseId: e.id,
      itemized: !!e.itemization,
    })
  })

  settlements.forEach((st: any) => {
    const g = groupMap[st.group_id]
    items.push({
      key: 's_' + st.id,
      kind: 'settlement',
      at: st.settled_at,
      groupId: st.group_id,
      groupName: g?.name ?? '',
      currency: g?.currency ?? 'IDR',
      amount: Number(st.amount),
      fromName: memberName(st.from_member, myUserId),
      toName: memberName(st.to_member, myUserId),
      method: st.method,
    })
  })

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  return items.slice(0, limit)
}
