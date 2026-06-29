export type ExpenseCategory =
  | 'Food'
  | 'Transport'
  | 'Accommodation'
  | 'Activity'
  | 'Shopping'
  | 'Other'

export interface User {
  id: string
  email: string | null
  phone: string | null
  display_name: string
  avatar_url: string | null
  created_at: string
}

export interface Group {
  id: string
  name: string
  currency: string
  invite_code: string
  created_by: string | null
  created_at: string
}

export interface GroupMember {
  id: string
  group_id: string
  user_id: string
  joined_at: string
}

export interface Expense {
  id: string
  group_id: string
  paid_by: string | null
  title: string
  total_amount: number
  currency: string
  exchange_rate_to_group_currency: number | null
  category: ExpenseCategory
  receipt_image_url: string | null
  amount_in_group_currency: number
  date: string
  created_at: string
}

export interface ExpenseSplit {
  id: string
  expense_id: string
  user_id: string
  amount_owed: number
  is_settled: boolean
}

export interface Settlement {
  id: string
  group_id: string
  from_user: string | null
  to_user: string | null
  amount: number
  method: string
  settled_at: string
}

export interface UserGroupBalance {
  user_id: string
  group_id: string
  total_owed: number
  total_paid_for_others: number
}
