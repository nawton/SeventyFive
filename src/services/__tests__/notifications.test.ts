import * as Notifications from 'expo-notifications'
import {
  scheduleDailyReminders, cancelDailyReminders, areRemindersActive,
} from '../notifications'

jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { DAILY: 'daily' },
  cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(undefined),
  scheduleNotificationAsync: jest.fn().mockResolvedValue('id'),
  getPermissionsAsync: jest.fn(),
  getAllScheduledNotificationsAsync: jest.fn(),
}))

const schedule = Notifications.scheduleNotificationAsync as jest.Mock
const cancelAll = Notifications.cancelAllScheduledNotificationsAsync as jest.Mock
const permissions = Notifications.getPermissionsAsync as jest.Mock
const getScheduled = Notifications.getAllScheduledNotificationsAsync as jest.Mock

beforeEach(() => jest.clearAllMocks())

describe('scheduleDailyReminders', () => {
  it('rensar gamla och lägger morgonpepp plus kvällens streak-vakt', async () => {
    await scheduleDailyReminders()
    expect(cancelAll).toHaveBeenCalled()
    expect(schedule).toHaveBeenCalledTimes(2)

    const triggers = schedule.mock.calls.map(c => c[0].trigger)
    expect(triggers[0]).toEqual({ type: 'daily', hour: 9, minute: 0 })
    expect(triggers[1]).toEqual({ type: 'daily', hour: 20, minute: 30 })
    expect(schedule.mock.calls[1][0].content.title).toContain('streak')
  })
})

describe('cancelDailyReminders', () => {
  it('stänger av allt schemalagt', async () => {
    await cancelDailyReminders()
    expect(cancelAll).toHaveBeenCalled()
    expect(schedule).not.toHaveBeenCalled()
  })
})

describe('areRemindersActive', () => {
  it('kräver både tillstånd och schemalagda notiser', async () => {
    permissions.mockResolvedValue({ status: 'granted' })
    getScheduled.mockResolvedValue([{ identifier: 'a' }])
    expect(await areRemindersActive()).toBe(true)

    getScheduled.mockResolvedValue([])
    expect(await areRemindersActive()).toBe(false)

    permissions.mockResolvedValue({ status: 'denied' })
    expect(await areRemindersActive()).toBe(false)
    // Nekad behörighet ska inte ens fråga efter schemat
    expect(getScheduled).toHaveBeenCalledTimes(2)
  })
})
