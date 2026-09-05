from datetime import datetime, date
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

# --- Auth & User ---
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: "UserOut"

class LoginRequest(BaseModel):
    email: str
    password: str

class RoleOut(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_default_exempt: bool = False
    is_default_eligible: bool = True
    permissions: List[str] = []

    class Config:
        from_attributes = True

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: RoleOut
    is_active: bool
    faculty_id: Optional[int] = None
    faculty_code: Optional[str] = None
    department_name: Optional[str] = None

    class Config:
        from_attributes = True

class UserRoleUpdate(BaseModel):
    role_name: str
    department_id: Optional[int] = None

class UserStatusUpdate(BaseModel):
    is_active: bool

class FirebaseSyncRequest(BaseModel):
    email: str
    full_name: Optional[str] = None
    role_name: Optional[str] = None

# --- Departments, Subjects & Classes ---
class DepartmentOut(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True

class SubjectOut(BaseModel):
    id: int
    code: str
    name: str
    department_id: int
    credits: int
    is_active: bool

    class Config:
        from_attributes = True

class ClassSectionOut(BaseModel):
    id: int
    name: str
    department_id: int
    academic_year: str
    semester: int
    capacity: int

    class Config:
        from_attributes = True

# --- Faculty ---
class FacultyCreate(BaseModel):
    faculty_id: str
    name: str
    email: str
    department_id: int
    designation: str = "Assistant Professor"
    role_id: Optional[int] = None
    is_substitution_eligible: bool = True
    is_exempt: bool = False
    max_weekly_substitutions: int = 4
    subject_expertise: List[str] = []
    phone: Optional[str] = None

class FacultyUpdate(BaseModel):
    name: Optional[str] = None
    department_id: Optional[int] = None
    designation: Optional[str] = None
    role_id: Optional[int] = None
    is_substitution_eligible: Optional[bool] = None
    is_exempt: Optional[bool] = None
    max_weekly_substitutions: Optional[int] = None
    subject_expertise: Optional[List[str]] = None
    phone: Optional[str] = None
    status: Optional[str] = None

class FacultyOut(BaseModel):
    id: int
    faculty_id: str
    user_id: Optional[int] = None
    name: str
    email: str
    phone: Optional[str] = None
    department_id: int
    department_code: Optional[str] = None
    department_name: Optional[str] = None
    designation: str
    role_id: Optional[int] = None
    role_name: Optional[str] = None
    is_substitution_eligible: bool
    is_exempt: bool
    max_weekly_substitutions: int
    subject_expertise: List[str] = []
    status: str
    weekly_substitution_count: int = 0
    today_regular_classes_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True

# --- Timetables ---
class TimetableEntryCreate(BaseModel):
    faculty_id: int
    class_section_id: int
    subject_id: int
    day_of_week: int = Field(..., ge=0, le=6)
    start_time: str
    end_time: str
    room_number: str = "Room-101"

class TimetableEntryOut(BaseModel):
    id: int
    timetable_version_id: int
    faculty_id: int
    faculty_name: Optional[str] = None
    class_section_id: int
    class_name: Optional[str] = None
    subject_id: int
    subject_code: Optional[str] = None
    subject_name: Optional[str] = None
    day_of_week: int
    start_time: str
    end_time: str
    room_number: str

    class Config:
        from_attributes = True

class TimetableVersionOut(BaseModel):
    id: int
    name: str
    academic_year: str
    semester: int
    is_active: bool
    created_by: str
    created_at: datetime
    total_entries: int = 0

    class Config:
        from_attributes = True

class TimetableImportPreview(BaseModel):
    filename: str
    total_rows: int
    valid_rows_count: int
    error_count: int
    warning_count: int
    conflict_count: int
    errors: List[str] = []
    warnings: List[str] = []
    conflicts: List[Dict[str, Any]] = []
    preview_entries: List[Dict[str, Any]] = []

class TimetableImportConfirm(BaseModel):
    version_name: str
    academic_year: str = "2026"
    semester: int = 1
    activate_immediately: bool = True
    entries: List[Dict[str, Any]]

# --- Absences ---
class AbsenceCreate(BaseModel):
    faculty_id: int
    date: date
    start_time: str = "00:00"
    end_time: str = "23:59"
    is_full_day: bool = True
    reason: Optional[str] = None
    auto_allocate: bool = True

class AbsenceOut(BaseModel):
    id: int
    faculty_id: int
    faculty_name: str
    faculty_code: str
    department_name: str
    date: date
    start_time: str
    end_time: str
    is_full_day: bool
    reason: Optional[str] = None
    status: str
    reported_by: str
    affected_classes_count: int = 0
    allocated_count: int = 0
    unallocated_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True

# --- Substitution Requirements & Duties ---
class SubstitutionRequirementOut(BaseModel):
    id: int
    absence_id: int
    date: date
    day_of_week: int
    period_start: str
    period_end: str
    class_section_id: int
    class_name: str
    subject_id: int
    subject_code: str
    subject_name: str
    original_faculty_id: int
    original_faculty_name: str
    status: str
    unallocated_reason: Optional[str] = None
    duty_id: Optional[int] = None
    assigned_faculty_id: Optional[int] = None
    assigned_faculty_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class CandidateEvaluation(BaseModel):
    faculty_id: int
    faculty_name: str
    faculty_code: str
    department_name: str
    is_eligible: bool
    rejection_reasons: List[str] = []
    weekly_substitutions: int
    daily_regular_classes: int
    is_exempt: bool
    is_absent: bool
    has_timetable_conflict: bool
    has_duty_conflict: bool
    subject_match: bool = False
    department_match: bool = False
    rank_score: float = 0.0

class AllocationResult(BaseModel):
    requirement_id: int
    class_name: str
    subject_name: str
    period: str
    date: date
    original_faculty_name: str
    status: str  # ALLOCATED, UNALLOCATED
    selected_faculty: Optional[Dict[str, Any]] = None
    eligible_candidates: List[CandidateEvaluation] = []
    rejected_candidates: List[CandidateEvaluation] = []
    explanation: str
    unallocated_reason: Optional[str] = None

class SubstitutionDutyOut(BaseModel):
    id: int
    requirement_id: int
    date: date
    day_of_week: int
    period_start: str
    period_end: str
    class_section_id: int
    class_name: str
    subject_id: int
    subject_code: str
    subject_name: str
    original_faculty_id: int
    original_faculty_name: str
    assigned_faculty_id: int
    assigned_faculty_name: str
    assigned_faculty_code: str
    allocation_method: str
    status: str
    weekly_count_at_assignment: int
    daily_classes_at_assignment: int
    is_manual_override: bool
    override_reason: Optional[str] = None
    overridden_by: Optional[str] = None
    allocation_reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ManualOverrideRequest(BaseModel):
    assigned_faculty_id: int
    reason: str
    force_ignore_rules: bool = False  # If true, allows override with explicit warning log

# --- Reports & Stats ---
class DashboardStats(BaseModel):
    today_date: str
    total_faculty: int
    active_faculty: int
    today_absences_count: int
    today_affected_classes_count: int
    today_allocated_count: int
    today_unallocated_count: int
    weekly_total_substitutions: int
    faculty_at_limit_count: int  # 4 substitutions
    faculty_near_limit_count: int  # 3 substitutions
    duty_distribution: Dict[str, int]  # {"0": 15, "1": 5, "2": 3, "3": 1, "4": 1}
    recent_activities: List[Dict[str, Any]] = []
    system_alerts: List[Dict[str, Any]] = []

class WorkloadReportItem(BaseModel):
    faculty_id: int
    faculty_code: str
    name: str
    department: str
    regular_classes_per_week: int
    substitutions_this_week: int
    max_weekly_limit: int
    utilization_rate: float
    status: str  # SAFE, NEAR_LIMIT, AT_LIMIT

# --- System Rules & Audit ---
class SystemRuleOut(BaseModel):
    id: int
    rule_key: str
    rule_name: str
    rule_value: str
    data_type: str
    description: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True

class SystemRuleUpdate(BaseModel):
    rule_value: str
    is_active: Optional[bool] = None

class AuditLogOut(BaseModel):
    id: int
    event_type: str
    actor_name: str
    target_type: Optional[str] = None
    target_id: Optional[int] = None
    requirement_id: Optional[int] = None
    details: Dict[str, Any] = {}
    created_at: datetime

    class Config:
        from_attributes = True

class NotificationOut(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    notification_type: str
    is_read: bool
    metadata_json: Dict[str, Any] = {}
    created_at: datetime

    class Config:
        from_attributes = True

# --- AI Integration ---
class AIChatRequest(BaseModel):
    message: str
    context: Optional[Dict[str, Any]] = None

class AIChatResponse(BaseModel):
    reply: str
    tool_calls: List[Dict[str, Any]] = []
    facts_grounded: bool = True
    actions_taken: List[Dict[str, Any]] = []
