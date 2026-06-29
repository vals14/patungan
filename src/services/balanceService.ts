import { supabase } from '../lib/supabase'

// All balance identities are group_members.id (NOT users.id) — expenses.paid_by and
// expense_splits.user_id were retargeted to group_members so manual members work too.

export interface MemberLite {
  id: string        // group_members.id
  name: string      // resolved display name
}

export interface MemberBalance {
  memberId: string
  name: string
  paidTotal: number   // total this member paid across expenses (group currency)
  net: number         // + = owed to them, − = they owe
}

export interface BalancesResult {
  members: MemberBalance[]
  totalGroupSpend: number
}

export interface SettlementTransfer {
  fromMemberId: string
  fromName: string
  toMemberId: string
  toName: string
  amount: number
}

interface ExpenseLite {
  paid_by: string
  expense_splits: { user_id: string; amount_owed: number }[]
}
interface SettlementLite {
  from_user: string
  to_user: string
  amount: number
}

// Pure net-balance computation, in group base currency:
//   net[u] = paidForOthers[u] − owedByU[u] + settlementsPaid[u] − settlementsReceived[u]
// Works off already-loaded data so the group screen needs no extra round trip.
export function computeMemberBalances(
  members: MemberLite[],
  expenses: ExpenseLite[],
  settlements: SettlementLite[],
): BalancesResult {
  const paidForOthers: Record<string, number> = {}
  const owedByU: Record<string, number> = {}
  const paidTotal: Record<string, number> = {}
  let totalGroupSpend = 0

  expenses.forEach((e) => {
    const splits = e.expense_splits ?? []
    const expenseTotal = splits.reduce((s, sp) => s + Number(sp.amount_owed), 0)
    totalGroupSpend += expenseTotal
    paidTotal[e.paid_by] = (paidTotal[e.paid_by] ?? 0) + expenseTotal

    splits.forEach((sp) => {
      if (sp.user_id === e.paid_by) return // payer's own share — not owed to anyone
      owedByU[sp.user_id] = (owedByU[sp.user_id] ?? 0) + Number(sp.amount_owed)
      paidForOthers[e.paid_by] = (paidForOthers[e.paid_by] ?? 0) + Number(sp.amount_owed)
    })
  })

  const settledPaid: Record<string, number> = {}
  const settledReceived: Record<string, number> = {}
  settlements.forEach((s) => {
    settledPaid[s.from_user] = (settledPaid[s.from_user] ?? 0) + Number(s.amount)
    settledReceived[s.to_user] = (settledReceived[s.to_user] ?? 0) + Number(s.amount)
  })

  const memberBalances: MemberBalance[] = members.map((m) => {
    const net =
      (paidForOthers[m.id] ?? 0) -
      (owedByU[m.id] ?? 0) +
      (settledPaid[m.id] ?? 0) -
      (settledReceived[m.id] ?? 0)
    return { memberId: m.id, name: m.name, paidTotal: paidTotal[m.id] ?? 0, net: Math.round(net) }
  })

  return { members: memberBalances, totalGroupSpend: Math.round(totalGroupSpend) }
}

// Fetches + computes balances for a group. Used by the home screen so its per-group
// balance comes from the exact same formula as the group screen (numbers never disagree).
export async function getGroupBalances(
  groupId: string,
): Promise<{ members: MemberBalance[]; totalGroupSpend: number; currency: string }> {
  const { data: group } = await supabase.from('groups').select('currency').eq('id', groupId).single()
  const currency = group?.currency ?? 'IDR'

  const { data: memberRows } = await supabase
    .from('group_members')
    .select('id, name, user:users(display_name)')
    .eq('group_id', groupId)
  const members: MemberLite[] = (memberRows ?? []).map((m: any) => ({
    id: m.id,
    name: m.user?.display_name ?? m.name ?? 'Unknown',
  }))

  const { data: expenses } = await supabase
    .from('expenses')
    .select('paid_by, expense_splits(user_id, amount_owed)')
    .eq('group_id', groupId)

  const { data: settlements } = await supabase
    .from('settlements')
    .select('from_user, to_user, amount')
    .eq('group_id', groupId)

  const { members: memberBalances, totalGroupSpend } = computeMemberBalances(
    members,
    (expenses ?? []) as any,
    (settlements ?? []) as any,
  )
  return { members: memberBalances, totalGroupSpend, currency }
}

// Greedy settle-up: match biggest debtor to biggest creditor until everyone is ~zero.
// Not provably minimal, but nets everyone out with few transfers.
export function computeSettlementPlan(balances: MemberBalance[]): SettlementTransfer[] {
  const EPS = 1
  const debtors = balances
    .filter((b) => b.net < -EPS)
    .map((b) => ({ ...b, remaining: -b.net }))
    .sort((a, b) => b.remaining - a.remaining)
  const creditors = balances
    .filter((b) => b.net > EPS)
    .map((b) => ({ ...b, remaining: b.net }))
    .sort((a, b) => b.remaining - a.remaining)

  const transfers: SettlementTransfer[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i]
    const c = creditors[j]
    const amount = Math.min(d.remaining, c.remaining)
    if (amount > EPS) {
      transfers.push({
        fromMemberId: d.memberId,
        fromName: d.name,
        toMemberId: c.memberId,
        toName: c.name,
        amount: Math.round(amount),
      })
    }
    d.remaining -= amount
    c.remaining -= amount
    if (d.remaining <= EPS) i++
    if (c.remaining <= EPS) j++
  }
  return transfers
}
