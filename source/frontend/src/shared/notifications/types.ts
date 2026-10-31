import type { components, operations } from '../api/schema';

export type Notification = components['schemas']['NotificationDto'];
export type NotificationPage = components['schemas']['NotificationPageDto'];
export type NotificationPreference =
  components['schemas']['NotificationPreferenceDto'];
export type NotificationEmailStatus =
  components['schemas']['NotificationEmailStatus'];
export type UnreadCount = components['schemas']['UnreadCountDto'];
export type NotificationQuery = NonNullable<
  operations['NotificationsController_list']['parameters']['query']
>;
