import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  NOTIFICATION_POLL_MS,
  NOTIFICATION_QUERY_ROOT,
} from './notificationConstants';
import {
  getNotificationPreferences,
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  updateNotificationPreferences,
} from './notificationsApi';
import type { NotificationQuery } from './types';

export const NOTIFICATION_QUERY_KEYS = {
  all: NOTIFICATION_QUERY_ROOT,
  unreadCount: [...NOTIFICATION_QUERY_ROOT, 'unread-count'] as const,
  preferences: [...NOTIFICATION_QUERY_ROOT, 'preferences'] as const,
  list: (query: NotificationQuery) =>
    [...NOTIFICATION_QUERY_ROOT, 'list', query] as const,
};

// refetchIntervalInBackground stays off: a hidden tab stops polling, so a tab left for an hour ends on the login page.
export function useUnreadCount() {
  return useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.unreadCount,
    queryFn: getUnreadCount,
    refetchInterval: NOTIFICATION_POLL_MS,
  });
}

export function useNotifications(query: NotificationQuery, enabled = true) {
  return useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.list(query),
    queryFn: () => listNotifications(query),
    enabled,
    placeholderData: keepPreviousData,
  });
}

function useNotificationMutation<TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_QUERY_ROOT }),
  });
}

export const useMarkNotificationRead = () =>
  useNotificationMutation(markNotificationRead);
// F-25 US-115 AC3: the personal email switch; in-app notifications are never turned off.
export function useNotificationPreferences() {
  return useQuery({
    queryKey: NOTIFICATION_QUERY_KEYS.preferences,
    queryFn: getNotificationPreferences,
  });
}

export const useUpdateNotificationPreferences = () =>
  useNotificationMutation(updateNotificationPreferences);
export const useMarkAllNotificationsRead = () =>
  useNotificationMutation(markAllNotificationsRead);
