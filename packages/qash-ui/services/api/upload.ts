import { useMutation } from '@tanstack/react-query';
import { apiServerWithAuth } from "./index";

export interface UploadResponseDto {
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  uploadedAt: string;
}

export const useUploadCompanyLogo = () => {
  return useMutation({
    mutationFn: async (file: File): Promise<UploadResponseDto> => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiServerWithAuth.post<UploadResponseDto>(
        '/upload/company-logo',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response.data;
    },
  });
};

export const useUploadAvatar = () => {
  return useMutation({
    mutationFn: async (file: File): Promise<UploadResponseDto> => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiServerWithAuth.post<UploadResponseDto>(
        '/upload/avatar',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response.data;
    },
  });
};

export const useUploadMultisigLogo = () => {
  return useMutation({
    mutationFn: async (file: File): Promise<UploadResponseDto> => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiServerWithAuth.post<UploadResponseDto>(
        '/upload/multisig-logo',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      return response.data;
    },
  });
};
