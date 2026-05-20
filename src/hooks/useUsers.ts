import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { User } from '../types';

export function useUsers(role?: 'manager' | 'employee') {
  const fetchUsers = async () => {
    let query = supabase.from('users').select('*');
    if (role) {
      query = query.eq('role', role);
    }
    const { data, error } = await query;
    if (error) throw error;
    
    return data.map(d => ({
      id: d.id,
      name: d.name,
      email: d.email,
      role: d.role,
      createdAt: d.created_at
    })) as User[];
  };

  const usersQuery = useQuery({
    queryKey: ['users', role],
    queryFn: fetchUsers,
  });

  return {
    users: usersQuery.data || [],
    isLoading: usersQuery.isLoading,
    isError: usersQuery.isError,
    error: usersQuery.error,
  };
}
