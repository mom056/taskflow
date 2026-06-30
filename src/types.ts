export type TaskStatus = 'new' | 'in_progress' | 'completed' | 'pending';

export interface User {
  id: string; // from auth
  name: string;
  email: string;
  role: 'manager' | 'employee' | 'super_admin';
  createdAt: number;
  avatarUrl?: string;
  companyId: string;
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string;
  plan: 'free' | 'basic' | 'premium';
  maxEmployees: number;
  createdAt: number;
  isActive: boolean;
  hqLatitude?: number;
  hqLongitude?: number;
  hqRadiusMeters?: number;
  workStartTime?: string;
  workEndTime?: string;
  workDays?: string[];
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
  companyId: string;
  createdAt: number;
  updatedAt: number;
  latitude?: number;
  longitude?: number;
  locationVerifiedAt?: number;
  startLatitude?: number;
  startLongitude?: number;
  startLocationVerifiedAt?: number;
  targetLatitude?: number;
  targetLongitude?: number;
}

export interface Visit {
  id: string;
  location: string;
  notes?: string;
  employeeId: string;
  companyId: string;
  createdAt: number;
  latitude?: number;
  longitude?: number;
  clientName?: string;
  visitType?: string;
  imageUrl?: string;
  durationMinutes?: number;
  checkInTime?: number;
  checkOutTime?: number;
}

export interface Attendance {
  id: string;
  employeeId: string;
  companyId: string;
  checkInTime: number;
  checkInLat?: number;
  checkInLng?: number;
  checkInType: 'office' | 'field';
  checkOutTime?: number;
  checkOutLat?: number;
  checkOutLng?: number;
  totalHours?: number;
  notes?: string;
  isLate: boolean;
  createdAt: number;
  employeeName?: string;
  employeeEmail?: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  companyId: string;
  type: 'excuse' | 'sick' | 'annual' | 'emergency';
  reason: string;
  startDate: number;
  endDate?: number;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: number;
  reviewNote?: string;
  createdAt: number;
  employeeName?: string;
  employeeEmail?: string;
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

export function mapCompanyFromDB(dbCompany: any): Company | null {
  if (!dbCompany) return null;
  return {
    id: dbCompany.id,
    name: dbCompany.name,
    slug: dbCompany.slug,
    logoUrl: dbCompany.logo_url,
    plan: dbCompany.plan,
    maxEmployees: dbCompany.max_employees,
    createdAt: dbCompany.created_at,
    isActive: dbCompany.is_active,
    hqLatitude: dbCompany.hq_latitude ? Number(dbCompany.hq_latitude) : undefined,
    hqLongitude: dbCompany.hq_longitude ? Number(dbCompany.hq_longitude) : undefined,
    hqRadiusMeters: dbCompany.hq_radius_meters,
    workStartTime: dbCompany.work_start_time,
    workEndTime: dbCompany.work_end_time,
    workDays: dbCompany.work_days
  };
}
