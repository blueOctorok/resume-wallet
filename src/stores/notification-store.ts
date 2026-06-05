import { create } from 'zustand'

export interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  data: Record<string, unknown>
  action_url: string | null
  read: boolean
  created_at: string
}

interface NotificationState {
  notifications: AppNotification[]
  unreadCount: number
  loading: boolean
}

interface NotificationActions {
  fetchNotifications: (sessionUserId: string) => Promise<void>
  markRead: (id: string, sessionUserId: string) => Promise<void>
  markAllRead: (sessionUserId: string) => Promise<void>
  /** Optimistically prepend a new notification (for real-time use cases) */
  addNotification: (notification: AppNotification) => void
  reset: () => void
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
}

export const useNotificationStore = create<NotificationState & NotificationActions>()(
  (set, get) => ({
    ...initialState,

    fetchNotifications: async (sessionUserId) => {
      set({ loading: true })
      try {
        const res = await fetch('/api/notifications')
        if (!res.ok) return
        const { notifications, unreadCount } = await res.json()
        set({ notifications: notifications ?? [], unreadCount: unreadCount ?? 0 })
      } catch (err) {
        console.error('[NOTIFICATION STORE] Fetch failed:', err)
      } finally {
        set({ loading: false })
      }
    },

    markRead: async (id, sessionUserId) => {
      // Optimistic update
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }))

      try {
        await fetch(`/api/notifications/${id}`, {
          method: 'PATCH',
        })
      } catch (err) {
        console.error('[NOTIFICATION STORE] Mark-read failed:', err)
        // Revert optimistic update on failure
        await get().fetchNotifications(sessionUserId)
      }
    },

    markAllRead: async (sessionUserId) => {
      // Optimistic update
      set((state) => ({
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
        unreadCount: 0,
      }))

      try {
        await fetch('/api/notifications', {
          method: 'PATCH',
        })
      } catch (err) {
        console.error('[NOTIFICATION STORE] Mark-all-read failed:', err)
        await get().fetchNotifications(sessionUserId)
      }
    },

    addNotification: (notification) => {
      set((state) => ({
        notifications: [notification, ...state.notifications],
        unreadCount: state.unreadCount + (notification.read ? 0 : 1),
      }))
    },

    reset: () => set(initialState),
  })
)
