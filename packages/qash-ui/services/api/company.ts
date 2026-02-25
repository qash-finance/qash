import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiServerWithAuth, AuthenticatedApiClient } from "./index";
import {
  Company,
  CreateCompanyDto,
  UpdateCompanyDto,
} from "@qash/types/dto/company";


// *************************************************
// **************** API CLIENT SETUP ***************
// *************************************************

import { AuthStorage } from "../auth/storage";
// *************************************************
// **************** GET METHODS *******************
// *************************************************

export function useGetMyCompany(options?: { enabled?: boolean }) {
  return useQuery<Company>({
    queryKey: ["company", "my"],
    queryFn: async () => {
      return apiServerWithAuth.getData<Company>("/companies");
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    enabled: options?.enabled !== false, // Default to true
  });
}

// *************************************************
// **************** POST METHODS ******************
// *************************************************

export function useCreateCompany() {
  const queryClient = useQueryClient();

  return useMutation<Company, Error, CreateCompanyDto>({
    mutationFn: async (data: CreateCompanyDto) => {
      return apiServerWithAuth.postData<Company>("/companies", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company"] });
    },
  });
}

// *************************************************
// **************** PUT METHODS ********************
// *************************************************

export function useUpdateCompany() {
  const queryClient = useQueryClient();

  return useMutation<Company, Error, UpdateCompanyDto>({
    mutationFn: async (data: UpdateCompanyDto) => {
      return apiServerWithAuth.putData<Company>("/companies", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company"] });
    },
  });
}

