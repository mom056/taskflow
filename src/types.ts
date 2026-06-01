export type TaskStatus = 'new' | 'in_progress' | 'completed' | 'pending';

export interface User {
  id: string; // from auth
  name: string;
  email: string;
  role: 'manager' | 'employee';
  createdAt: number;
  avatarUrl?: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  employeeId: string;
  location?: string;
  dueDate?: number;
  notes?: string;
  imageUrl?: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  latitude?: number;
  longitude?: number;
  locationVerifiedAt?: number;
}

export interface Visit {
  id: string;
  location: string;
  notes?: string;
  employeeId: string;
  createdAt: number;
}

export const statusLabels: Record<TaskStatus, string> = {
  new: 'جديدة',
  in_progress: 'جاري العمل',
  completed: 'مكتملة',
  pending: 'معلقة'
};

export const statusColors: Record<TaskStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-amber-100 text-amber-900',
  completed: 'bg-green-100 text-green-800',
  pending: 'bg-red-100 text-red-800'
};
