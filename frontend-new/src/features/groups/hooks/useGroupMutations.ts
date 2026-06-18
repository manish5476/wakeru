import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../../services/api-client';

interface CreateGroupPayload {
  name: string;
  type: string;
  description?: string;
  avatar?: string;
}

export const useCreateGroupMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateGroupPayload) => {
      const response = await apiClient.post('/groups', payload);
      return response.data;
    },
    onSuccess: () => {
      // Invalidate user groups to trigger a refetch on the home screen
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
};
