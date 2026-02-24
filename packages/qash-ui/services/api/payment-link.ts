import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiServerWithAuth } from "./index";
import {
  CreatePaymentLinkDto,
  UpdatePaymentLinkDto,
  PaymentLinkRecordDto,
  PaymentLink,
  PaymentLinkOrderDto,
  PaymentRecordDto,
} from "@qash/types/dto/payment-link";

// *************************************************
// **************** API CLIENT SETUP ***************
// *************************************************

// *************************************************
// **************** GET METHODS *******************
// *************************************************

/**
 * Hook to get all payment links for authenticated user
 */
const useGetPaymentLinks = () => {
  return useQuery({
    queryKey: ["payment-links"],
    queryFn: async () => {
      return apiServerWithAuth.getData<PaymentLink[]>("/payment-link");
    },
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
};

/**
 * Hook to get a payment link by code (public endpoint)
 */
const useGetPaymentLinkByCode = (code: string) => {
  return useQuery({
    queryKey: ["payment-link", code],
    queryFn: async () => {
      return apiServerWithAuth.getData<PaymentLink>(`/payment-link/${code}`);
    },
    enabled: !!code,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
};

/**
 * Hook to get a payment link by code for the owner (with ownership check)
 */
const useGetPaymentLinkByCodeForOwner = (code: string) => {
  return useQuery({
    queryKey: ["payment-link-owner", code],
    queryFn: async () => {
      return apiServerWithAuth.getData<PaymentLink>(`/payment-link/${code}/owner`);
    },
    enabled: !!code,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
};

// *************************************************
// **************** POST METHODS *******************
// *************************************************

/**
 * Hook to create a new payment link
 */
const useCreatePaymentLink = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePaymentLinkDto) => {
      return apiServerWithAuth.postData<PaymentLink>("/payment-link", data);
    },
    onSuccess: (newPaymentLink: PaymentLink) => {
      // Invalidate and refetch payment links list
      queryClient.invalidateQueries({ queryKey: ["payment-links"] });
    },
  });
};

/**
 * Hook to record a payment to a payment link (public endpoint)
 */
const useRecordPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ code, data }: { code: string; data: PaymentRecordDto }) => {
      return apiServerWithAuth.postData<PaymentLink>(`/payment-link/${code}/pay`, data);
    },
    onSuccess: (updatedPaymentLink: PaymentLink) => {
      // Update the specific payment link in cache
      queryClient.setQueryData(["payment-link", updatedPaymentLink.code], updatedPaymentLink);
      // Invalidate and refetch payment links list
      queryClient.invalidateQueries({ queryKey: ["payment-links"] });
    },
  });
};

// *************************************************
// **************** PUT METHODS *******************
// *************************************************

/**
 * Hook to update a payment link
 */
const useUpdatePaymentLink = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ code, data }: { code: string; data: UpdatePaymentLinkDto }) => {
      return apiServerWithAuth.putData<PaymentLink>(`/payment-link/${code}`, data);
    },
    onSuccess: (updatedPaymentLink: PaymentLink) => {
      // Update the specific payment link in cache
      queryClient.setQueryData(["payment-link", updatedPaymentLink.code], updatedPaymentLink);
      // Invalidate and refetch payment links list
      queryClient.invalidateQueries({ queryKey: ["payment-links"] });
    },
  });
};

/**
 * Hook to deactivate a payment link
 */
const useDeactivatePaymentLink = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (code: string) => {
      return apiServerWithAuth.putData<PaymentLink>(`/payment-link/${code}/deactivate`);
    },
    onSuccess: (updatedPaymentLink: PaymentLink) => {
      // Update the specific payment link in cache
      queryClient.setQueryData(["payment-link", updatedPaymentLink.code], updatedPaymentLink);
      // Invalidate and refetch payment links list
      queryClient.invalidateQueries({ queryKey: ["payment-links"] });
    },
  });
};

/**
 * Hook to activate a payment link
 */
const useActivatePaymentLink = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (code: string) => {
      return apiServerWithAuth.putData<PaymentLink>(`/payment-link/${code}/activate`);
    },
    onSuccess: (updatedPaymentLink: PaymentLink) => {
      // Update the specific payment link in cache
      queryClient.setQueryData(["payment-link", updatedPaymentLink.code], updatedPaymentLink);
      // Invalidate and refetch payment links list
      queryClient.invalidateQueries({ queryKey: ["payment-links"] });
    },
  });
};

/**
 * Hook to update payment record with transaction ID
 */
const useUpdatePaymentTxid = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ paymentId, txid }: { paymentId: number; txid: string }) => {
      return apiServerWithAuth.putData<PaymentLink>(`/payment-link/payment/${paymentId}/txid`, { txid });
    },
    onSuccess: () => {
      // Invalidate and refetch payment links list
      queryClient.invalidateQueries({ queryKey: ["payment-links"] });
    },
  });
};

// *************************************************
// **************** PATCH METHODS *****************
// *************************************************

/**
 * Hook to update payment link order
 */
const useUpdatePaymentLinkOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: PaymentLinkOrderDto) => {
      return apiServerWithAuth.patchData<PaymentLink[]>(`/payment-link/update-order`, data);
    },
    onSuccess: () => {
      // Invalidate and refetch payment links list to get updated order
      queryClient.invalidateQueries({ queryKey: ["payment-links"] });
    },
  });
};

// *************************************************
// **************** DELETE METHODS ****************
// *************************************************

/**
 * Hook to delete payment links (supports single or bulk deletion)
 */
const useDeletePaymentLinks = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (codes: string[]) => {
      return apiServerWithAuth.deleteData<{
        message: string;
        deletedCount: number;
        deletedCodes: string[];
      }>("/payment-link", { codes });
    },
    onSuccess: response => {
      // Remove specific payment links from cache
      response.deletedCodes.forEach(code => {
        queryClient.removeQueries({ queryKey: ["payment-link", code] });
      });
      // Invalidate and refetch payment links list
      queryClient.invalidateQueries({ queryKey: ["payment-links"] });
    },
  });
};

export {
  useGetPaymentLinks,
  useGetPaymentLinkByCode,
  useGetPaymentLinkByCodeForOwner,
  useCreatePaymentLink,
  useRecordPayment,
  useUpdatePaymentLink,
  useDeactivatePaymentLink,
  useActivatePaymentLink,
  useUpdatePaymentTxid,
  useUpdatePaymentLinkOrder,
  useDeletePaymentLinks,
};
