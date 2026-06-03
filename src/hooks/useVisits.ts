import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { Visit } from '../types';

export function useVisits() {
  const fetchVisits = async () => {
    const { data, error } = await supabase
      .from('visits')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return data.map(d => ({
       id: d.id,
       location: d.location,
       notes: d.notes,
       employeeId: d.employee_id,
       companyId: d.company_id,
       createdAt: d.created_at
     })) as Visit[];
  };

  const visitsQuery = useQuery({
    queryKey: ['visits'],
    queryFn: fetchVisits,
  });

  return {
    visits: visitsQuery.data || [],
    isLoading: visitsQuery.isLoading,
    isError: visitsQuery.isError,
    error: visitsQuery.error,
  };
}
