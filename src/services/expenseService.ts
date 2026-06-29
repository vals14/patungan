import { supabase } from '../lib/supabase'
import { Expense, ExpenseCategory } from '../types/database'

export interface LineItemInput {
  name: string
  amount: number
}

export interface LineItemAssignment {
  lineItemIndex: number
  userIds: string[]
  customShares?: Record<string, number>
}

export interface CreateExpenseInput {
  groupId: string
  paidBy: string
  title: string
  totalAmount: number
  currency: string
  exchangeRateToGroupCurrency: number | null
  category: ExpenseCategory
  receiptImageUrl?: string
  lineItems: LineItemInput[]
  assignments: LineItemAssignment[]
}

export function computeSplits(
  lineItems: LineItemInput[],
  assignments: LineItemAssignment[],
  exchangeRate: number
): Record<string, number> {
  const owedMap: Record<string, number> = {}

  assignments.forEach((assignment) => {
    const item = lineItems[assignment.lineItemIndex]
    if (!item) return

    const itemAmountInGroupCurrency = item.amount * exchangeRate

    if (assignment.customShares) {
      Object.entries(assignment.customShares).forEach(([userId, share]) => {
        owedMap[userId] = (owedMap[userId] ?? 0) + itemAmountInGroupCurrency * share
      })
    } else {
      const share = itemAmountInGroupCurrency / assignment.userIds.length
      assignment.userIds.forEach((userId) => {
        owedMap[userId] = (owedMap[userId] ?? 0) + share
      })
    }
  })

  return owedMap
}

export async function createExpense(input: CreateExpenseInput): Promise<Expense> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const exchangeRate = input.exchangeRateToGroupCurrency ?? 1.0

  const { data: expense, error: expenseError } = await supabase
    .from('expenses')
    .insert({
      group_id: input.groupId,
      paid_by: input.paidBy,
      title: input.title,
      total_amount: input.totalAmount,
      currency: input.currency,
      exchange_rate_to_group_currency: input.exchangeRateToGroupCurrency,
      category: input.category,
      receipt_image_url: input.receiptImageUrl ?? null,
    })
    .select()
    .single()

  if (expenseError) throw expenseError

  const lineItemRows = input.lineItems.map((item) => ({
    expense_id: expense.id,
    name: item.name,
    amount: item.amount,
  }))

  const { data: insertedItems, error: itemsError } = await supabase
    .from('expense_line_items')
    .insert(lineItemRows)
    .select()

  if (itemsError) throw itemsError

  const assignmentRows: any[] = []
  input.assignments.forEach((assignment) => {
    const lineItem = insertedItems[assignment.lineItemIndex]
    if (!lineItem) return

    if (assignment.customShares) {
      Object.entries(assignment.customShares).forEach(([userId, share]) => {
        assignmentRows.push({ line_item_id: lineItem.id, user_id: userId, share })
      })
    } else {
      const share = 1.0 / assignment.userIds.length
      assignment.userIds.forEach((userId) => {
        assignmentRows.push({ line_item_id: lineItem.id, user_id: userId, share })
      })
    }
  })

  if (assignmentRows.length > 0) {
    const { error: assignError } = await supabase
      .from('line_item_assignments')
      .insert(assignmentRows)
    if (assignError) throw assignError
  }

  const owedMap = computeSplits(input.lineItems, input.assignments, exchangeRate)

  const splitRows = Object.entries(owedMap).map(([userId, amountOwed]) => ({
    expense_id: expense.id,
    user_id: userId,
    amount_owed: Math.round(amountOwed),
    is_settled: false,
  }))

  if (splitRows.length > 0) {
    const { error: splitError } = await supabase
      .from('expense_splits')
      .insert(splitRows)
    if (splitError) throw splitError
  }

  return expense
}

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
