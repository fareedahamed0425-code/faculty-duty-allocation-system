export type UserRole = 'ADMIN' | 'FACULTY' | 'DEAN' | 'HOD' | 'PC' | 'COMMITTEE_MEMBER' | 'COORDINATOR';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: {
    id: number;
    name: UserRole;
    description?: string;
    is_default_exempt: boolean;
    is_default_eligible: boolean;
    permissions: string[];
  };
  is_active: boolean;
  faculty_id?: number | null;
  faculty_code?: string | null;
  department_name?: string | null;
}

export interface Department {
  id: number;
  code: string;
  name: string;
  description?: string;
}

export interface Faculty {
  id: number;
  faculty_id: string;
  user_id?: number | null;
  name: string;
  email: string;
  phone?: string | null;
  department_id: number;
  department_code?: string | null;
  department_name?: string | null;
  designation: string;
  role_id?: number | null;
  role_name?: string | null;
  is_substitution_eligible: boolean;
  is_exempt: boolean;
  max_weekly_substitutions: number;
  subject_expertise: string[];
  status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
  weekly_substitution_count: number;
  today_regular_classes_count: number;
  created_at: string;
}

export interface TimetableEntry {
  id: number;
  timetable_version_id: number;
  faculty_id: number;
  faculty_name?: string;
  class_section_id: number;
  class_name?: string;
  subject_id: number;
  subject_code?: string;
  subject_name?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room_number: string;
}

export interface TimetableVersion {
  id: number;
  name: string;
  academic_year: string;
  semester: number;
  is_active: boolean;
  created_by: string;
  created_at: string;
  total_entries: number;
}

export interface Absence {
  id: number;
  faculty_id: number;
  faculty_name: string;
  faculty_code: string;
  department_name: string;
  date: string;
  start_time: string;
  end_time: string;
  is_full_day: boolean;
  reason?: string | null;
  status: 'REPORTED' | 'CONFIRMED' | 'CANCELLED';
  reported_by: string;
  affected_classes_count: number;
  allocated_count: number;
  unallocated_count: number;
  created_at: string;
}

export interface SubstitutionRequirement {
  id: number;
  absence_id: number;
  date: string;
  day_of_week: number;
  period_start: string;
  period_end: string;
  class_section_id: number;
  class_name: string;
  subject_id: number;
  subject_code: string;
  subject_name: string;
  original_faculty_id: number;
  original_faculty_name: string;
  status: 'PENDING' | 'ALLOCATED' | 'UNALLOCATED' | 'CANCELLED';
  unallocated_reason?: string | null;
  duty_id?: number | null;
  assigned_faculty_id?: number | null;
  assigned_faculty_name?: string | null;
  created_at: string;
}

export interface SubstitutionDuty {
  id: number;
  requirement_id: number;
  date: string;
  day_of_week: number;
  period_start: string;
  period_end: string;
  class_section_id: number;
  class_name: string;
  subject_id: number;
  subject_code: string;
  subject_name: string;
  original_faculty_id: number;
  original_faculty_name: string;
  assigned_faculty_id: number;
  assigned_faculty_name: string;
  assigned_faculty_code: string;
  allocation_method: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  weekly_count_at_assignment: number;
  daily_classes_at_assignment: number;
  is_manual_override: boolean;
  override_reason?: string | null;
  overridden_by?: string | null;
  allocation_reason?: string | null;
  created_at: string;
}

export interface CandidateEvaluation {
  faculty_id: number;
  faculty_name: string;
  faculty_code: string;
  department_name: string;
  is_eligible: boolean;
  rejection_reasons: string[];
  weekly_substitutions: number;
  daily_regular_classes: number;
  is_exempt: boolean;
  is_absent: boolean;
  has_timetable_conflict: boolean;
  has_duty_conflict: boolean;
}

export interface DashboardStats {
  today_date: string;
  total_faculty: number;
  active_faculty: number;
  today_absences_count: number;
  today_affected_classes_count: number;
  today_allocated_count: number;
  today_unallocated_count: number;
  weekly_total_substitutions: number;
  faculty_at_limit_count: number;
  faculty_near_limit_count: number;
  duty_distribution: Record<string, number>;
  recent_activities: Array<{
    id: number;
    event_type: string;
    actor_name: string;
    created_at: string;
    details: any;
  }>;
  system_alerts: Array<{
    type: 'WARNING' | 'ERROR' | 'INFO';
    title: string;
    message: string;
  }>;
}

export interface WorkloadItem {
  faculty_id: number;
  faculty_code: string;
  name: string;
  department: string;
  designation: string;
  is_exempt: boolean;
  is_eligible: boolean;
  regular_classes_per_week: number;
  substitutions_this_week: number;
  max_weekly_limit: number;
  utilization_rate: number;
  status: 'SAFE' | 'NEAR_LIMIT' | 'AT_LIMIT';
}

export interface NotificationItem {
  id: number;
  user_id: number;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  metadata_json: Record<string, any>;
  created_at: string;
}

export interface SystemRuleItem {
  id: number;
  rule_key: string;
  rule_name: string;
  rule_value: string;
  data_type: string;
  description?: string;
  is_active: boolean;
}

export interface AuditLogItem {
  id: number;
  event_type: string;
  actor_name: string;
  target_type?: string;
  target_id?: number;
  requirement_id?: number;
  details: Record<string, any>;
  created_at: string;
}
