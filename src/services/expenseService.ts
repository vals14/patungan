import { supabase } from '../lib/supabase'
import { Expense, ExpenseCategory } from '../types/database'

export interface CreateSimpleExpenseInput {
  groupId: string
  paidBy: string
  title: string
  totalAmount: number
  currency: string
  exchangeRateToGroupCurrency: number | null
  amountInGroupCurrency: number
  category: ExpenseCategory
  date: string
  splitBetweenMemberIds: string[]
  receiptImageUrl?: string
}

export async function createSimpleExpense(input: CreateSimpleExpenseInput): Promise<Expense> {
  const { data: expense, error } = await supabase
    .from('expenses')
    .insert({
      group_id: input.groupId,
      paid_by: input.paidBy,
      title: input.title,
      total_amount: input.totalAmount,
      currency: input.currency,
      exchange_rate_to_group_currency: input.exchangeRateToGroupCurrency,
      amount_in_group_currency: input.amountInGroupCurrency,
      category: input.category,
      date: input.date,
      receipt_image_url: input.receiptImageUrl ?? null,
    })
    .select()
    .single()

  if (error) throw error

  if (input.splitBetweenMemberIds.length > 0) {
    // Splits are stored in the group's currency so balances are directly summable.
    const amountEach = input.amountInGroupCurrency / input.splitBetweenMemberIds.length
    const splitRows = input.splitBetweenMemberIds.map(memberId => ({
      expense_id: expense.id,
      user_id: memberId,
      amount_owed: Math.round(amountEach * 100) / 100,
      is_settled: false,
    }))
    const { error: splitError } = await supabase.from('expense_splits').insert(splitRows)
    if (splitError) throw splitError
  }

  return expense
}

export interface CreateItemizedExpenseInput {
  groupId: string
  paidBy: string
  title: string
  totalAmount: number
  currency: string
  exchangeRateToGroupCurrency: number | null
  amountInGroupCurrency: number
  category: ExpenseCategory
  date: string
  receiptImageUrl?: string
  // The full itemization (items + assignees + charges), so the expense can be
  // re-edited in the itemized editor. Its presence marks the expense as a scan.
  itemization: any
}

// Like createSimpleExpense, but with explicit per-member split amounts (already in
// the group's currency) for the itemized receipt-split flow. Splits are the
// computed shares — items + proportional tax/service − discount, converted by rate.
export async function createExpenseWithSplits(
  input: CreateItemizedExpenseInput,
  splits: { memberId: string; amount: number }[],
): Promise<Expense> {
  const { data: expense, error } = await supabase
    .from('expenses')
    .insert({
      group_id: input.groupId,
      paid_by: input.paidBy,
      title: input.title,
      total_amount: input.totalAmount,
      currency: input.currency,
      exchange_rate_to_group_currency: input.exchangeRateToGroupCurrency,
      amount_in_group_currency: input.amountInGroupCurrency,
      category: input.category,
      date: input.date,
      receipt_image_url: input.receiptImageUrl ?? null,
      itemization: input.itemization ?? null,
    })
    .select()
    .single()

  if (error) throw error

  const rows = splits
    .filter((s) => s.amount > 0)
    .map((s) => ({
      expense_id: expense.id,
      user_id: s.memberId,
      amount_owed: Math.round(s.amount * 100) / 100,
      is_settled: false,
    }))
  if (rows.length > 0) {
    const { error: splitError } = await supabase.from('expense_splits').insert(rows)
    if (splitError) throw splitError
  }

  return expense
}

// Edit an itemized (scan) expense: update the row, replace its splits, and
// re-store the itemization so the editor round-trips.
export async function updateExpenseWithSplits(
  expenseId: string,
  input: CreateItemizedExpenseInput,
  splits: { memberId: string; amount: number }[],
): Promise<Expense> {
  const { data: expense, error } = await supabase
    .from('expenses')
    .update({
      paid_by: input.paidBy,
      title: input.title,
      total_amount: input.totalAmount,
      currency: input.currency,
      exchange_rate_to_group_currency: input.exchangeRateToGroupCurrency,
      amount_in_group_currency: input.amountInGroupCurrency,
      category: input.category,
      date: input.date,
      itemization: input.itemization ?? null,
    })
    .eq('id', expenseId)
    .select()
    .single()

  if (error) throw error

  const { error: delError } = await supabase
    .from('expense_splits')
    .delete()
    .eq('expense_id', expenseId)
  if (delError) throw delError

  const rows = splits
    .filter((s) => s.amount > 0)
    .map((s) => ({
      expense_id: expenseId,
      user_id: s.memberId,
      amount_owed: Math.round(s.amount * 100) / 100,
      is_settled: false,
    }))
  if (rows.length > 0) {
    const { error: splitError } = await supabase.from('expense_splits').insert(rows)
    if (splitError) throw splitError
  }

  return expense
}

export async function getGroupExpenses(groupId: string): Promise<any[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select(`
      *,
      paid_by_member:group_members!expenses_paid_by_fkey (
        id, name,
        user:users (id, display_name)
      ),
      expense_splits (
        user_id, amount_owed, is_settled,
        member:group_members!expense_splits_user_id_fkey (
          id, name,
          user:users (id, display_name)
        )
      )
    `)
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data ?? []
}

export async function getExpenseById(expenseId: string): Promise<any> {
  const { data, error } = await supabase
    .from('expenses')
    .select(`
      *,
      expense_splits ( user_id )
    `)
    .eq('id', expenseId)
    .single()

  if (error) throw error
  return data
}

export async function updateSimpleExpense(
  expenseId: string,
  input: CreateSimpleExpenseInput
): Promise<Expense> {
  const { data: expense, error } = await supabase
    .from('expenses')
    .update({
      paid_by: input.paidBy,
      title: input.title,
      total_amount: input.totalAmount,
      currency: input.currency,
      exchange_rate_to_group_currency: input.exchangeRateToGroupCurrency,
      amount_in_group_currency: input.amountInGroupCurrency,
      category: input.category,
      date: input.date,
    })
    .eq('id', expenseId)
    .select()
    .single()

  if (error) throw error

  // Replace splits wholesale — simplest way to keep them consistent with edits.
  const { error: delError } = await supabase
    .from('expense_splits')
    .delete()
    .eq('expense_id', expenseId)
  if (delError) throw delError

  if (input.splitBetweenMemberIds.length > 0) {
    const amountEach = input.amountInGroupCurrency / input.splitBetweenMemberIds.length
    const splitRows = input.splitBetweenMemberIds.map(memberId => ({
      expense_id: expenseId,
      user_id: memberId,
      amount_owed: Math.round(amountEach * 100) / 100,
      is_settled: false,
    }))
    const { error: splitError } = await supabase.from('expense_splits').insert(splitRows)
    if (splitError) throw splitError
  }

  return expense
}

export async function deleteExpense(expenseId: string): Promise<void> {
  // Remove child splits first to satisfy the FK, then the expense itself.
  const { error: splitError } = await supabase
    .from('expense_splits')
    .delete()
    .eq('expense_id', expenseId)
  if (splitError) throw splitError

  const { data, error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId)
    .select('id')
  if (error) throw error
  // A blocked delete returns no error but removes 0 rows — surface that clearly.
  if (!data || data.length === 0) {
    throw new Error('Delete failed — no rows removed. Check the expenses DELETE policy.')
  }
}
