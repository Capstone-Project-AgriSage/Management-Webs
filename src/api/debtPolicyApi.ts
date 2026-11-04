import { api } from './client'

// Debt policy and debt reminders (FE_GUIDE_FLOW_3 §4.2, §10). Dates are Vietnam days (yyyy-MM-dd).

export interface DebtPolicy {
  defaultGraceDays: number
  /** n2 is negative (days before the due date); n4 and n5 are days after it. */
  reminderOffsets: { n2: number; n4: number; n5: number }
  staffRolloverLimit: number
  ownerReviewAfterRollovers: number
  onTimeSeasonsForLimitRaise: number
  maxCreditTermDays: number | null
  maxTotalExtensionDays: number
  /** 0 and isDefault when the store never saved a policy; required on every save (409 = someone else saved first). */
  version: number
  isDefault: boolean
  /** null = reminders have not started: the server sends none until the owner starts them. Set once, never changes. */
  remindersStartDate: string | null
}

export type DebtPolicyWriteRequest = Omit<DebtPolicy, 'isDefault' | 'remindersStartDate'> & { reason?: string }

export interface ReminderInitializeResult {
  dryRun: boolean
  alreadyStarted: boolean
  startDate: string
  farmers: number
  activeGroups: number
  skipped: { N1: number; N2: number; N3: number; N4: number; N5: number }
  skippedTotal: number
  groupsWithLaterMilestones: number
}

export const debtPolicyApi = {
  get: () => api<DebtPolicy>('/api/debt-policy'),
  update: (data: DebtPolicyWriteRequest) => api<DebtPolicy>('/api/debt-policy', { method: 'PUT', body: JSON.stringify(data) }),
  /** Owner only. dryRun counts what would be skipped and writes nothing; dryRun false starts the reminders for real. */
  initializeReminders: (dryRun: boolean, reason?: string) =>
    api<ReminderInitializeResult>('/api/debt-reminders/initialize', { method: 'POST', body: JSON.stringify(dryRun ? { dryRun: true } : { dryRun: false, reason: reason || null }) }),
}
