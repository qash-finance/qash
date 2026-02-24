import { useMutation, useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { apiServerWithAuth } from "./index";
import type {
  NotificationWithPaginationDto,
  NotificationResponseDto,
  UnreadCountResponseDto,
  MarkAllReadResponseDto,
} from "@qash/types/dto/notification";
import type { NotificationsStatusEnum, NotificationsTypeEnum } from "@qash/types/enums";

// *************************************************
// **************** GET METHODS *******************
// *************************************************

/**
 * Get paginated notifications for the authenticated user
 */
const useGetNotifications = (page: number = 1, limit: number = 20, type?: NotificationsTypeEnum, status?: NotificationsStatusEnum) => {
  return useQuery({
    queryKey: ["notifications", page, limit, type, status],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());
      if (type) params.append('type', type);
      if (status) params.append('status', status);
      return apiServerWithAuth.getData<NotificationWithPaginationDto>(`/notifications?${params.toString()}`);
    },
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
};

/**
 * Get infinite scroll notifications for the authenticated user
 */
const useGetNotificationsInfinite = (limit: number = 20, type?: NotificationsTypeEnum, status?: NotificationsStatusEnum) => {
  return useInfiniteQuery({
    queryKey: ["notifications-infinite", limit, type, status],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams();
      params.append('page', pageParam.toString());
      params.append('limit', limit.toString());
      if (type) params.append('type', type);
      if (status) params.append('status', status);
      return apiServerWithAuth.getData<NotificationWithPaginationDto>(`/notifications?${params.toString()}`);
    },
    getNextPageParam: (lastPage: NotificationWithPaginationDto) => {
      if (lastPage.meta.page < lastPage.meta.totalPages) {
        return lastPage.meta.page + 1;
      }
      return undefined;
    },
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
};

// *************************************************
// **************** QUERY METHODS ******************
// *************************************************

/**
 * Get unread notification count for the authenticated user
 */
const useGetUnreadCount = () => {
  return useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: async () => {
      return apiServerWithAuth.getData<UnreadCountResponseDto>(`/notifications/unread-count`);
    },
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
};

/**
 * Get a specific notification by ID
 */
const useGetNotification = (notificationId: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: ["notification", notificationId],
    queryFn: async () => {
      return apiServerWithAuth.getData<NotificationResponseDto>(`/notifications/${notificationId}`);
    },
    enabled,
  });
};

// *************************************************
// **************** MUTATION METHODS ***************
// *************************************************

/**
 * Mark a notification as read
 */
const useMarkNotificationAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: number) => {
      return apiServerWithAuth.patchData<NotificationResponseDto>(`/notifications/${notificationId}/read`, {});
    },
    onSuccess: (_, notificationId) => {
      // Invalidate all notification queries
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-infinite"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["notification", notificationId] });
    },
  });
};

/**
 * Mark a notification as unread
 */
const useMarkNotificationAsUnread = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: number) => {
      return apiServerWithAuth.patchData<NotificationResponseDto>(`/notifications/${notificationId}/unread`, {});
    },
    onSuccess: (_, notificationId) => {
      // Invalidate all notification queries
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-infinite"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["notification", notificationId] });
    },
  });
};

/**
 * Mark all notifications as read
 */
const useMarkAllNotificationsAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      return apiServerWithAuth.patchData<MarkAllReadResponseDto>(`/notifications/mark-all-read`, {});
    },
    onSuccess: () => {
      // Invalidate all notification queries to refetch fresh data
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-infinite"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });
};

/**
 * Delete a notification
 */
const useDeleteNotification = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationId: number) => {
      return apiServerWithAuth.deleteData(`/notifications/${notificationId}`);
    },
    onSuccess: (_, notificationId) => {
      // Invalidate all notification queries
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-infinite"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      queryClient.removeQueries({ queryKey: ["notification", notificationId] });
    },
  });
};

export {
  useGetNotifications,
  useGetNotificationsInfinite,
  useGetUnreadCount,
  useGetNotification,
  useMarkNotificationAsRead,
  useMarkNotificationAsUnread,
  useMarkAllNotificationsAsRead,
  useDeleteNotification,
};
