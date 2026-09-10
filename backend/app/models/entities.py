from datetime import datetime, date, time
from typing import Optional, List
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Date, Time, ForeignKey, Text, JSON, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from app.db.session import Base

class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)  # ADMIN, FACULTY, DEAN, HOD, PC, COMMITTEE_MEMBER
    description = Column(String(255), nullable=True)
    is_default_exempt = Column(Boolean, default=False)
    is_default_eligible = Column(Boolean, default=True)
    permissions = Column(JSON, default=list)  # list of permission strings: ["view_dashboard", "manage_faculty", ...]
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="role")
    faculty_members = relationship("Faculty", back_populates="role")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    role = relationship("Role", back_populates="users")
    faculty_profile = relationship("Faculty", back_populates="user", uselist=False)
    notifications = relationship("Notification", back_populates="user", cascade="all, delete-orphan")

    @property
    def faculty_id(self):
        return self.faculty_profile.id if self.faculty_profile else None



class Department(Base):
    __tablename__ = "departments"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=False, index=True)  # CSE, ECE, MECH, MATH
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    faculty_members = relationship("Faculty", back_populates="department")
    classes = relationship("ClassSection", back_populates="department")
    subjects = relationship("Subject", back_populates="department")


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(20), unique=True, nullable=False, index=True)  # CS101, EC201, MA301
    name = Column(String(100), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    credits = Column(Integer, default=3)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    department = relationship("Department", back_populates="subjects")


class ClassSection(Base):
    __tablename__ = "class_sections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, nullable=False, index=True)  # CSE-A, CSE-B, ECE-A, MECH-A
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    academic_year = Column(String(20), default="2026")
    semester = Column(Integer, default=1)
    year_level = Column(Integer, default=1)  # 1 = 1st Year, 2 = 2nd Year, 3 = 3rd Year, 4 = 4th Year
    capacity = Column(Integer, default=60)
    created_at = Column(DateTime, default=datetime.utcnow)

    department = relationship("Department", back_populates="classes")

    @property
    def effective_year(self) -> int:
        if self.year_level and 1 <= self.year_level <= 4:
            return self.year_level
        if self.semester:
            return max(1, min(4, (self.semester + 1) // 2))
        name_upper = (self.name or "").upper()
        if name_upper.startswith("IV") or "4TH" in name_upper or "YEAR 4" in name_upper:
            return 4
        if name_upper.startswith("III") or "3RD" in name_upper or "YEAR 3" in name_upper:
            return 3
        if name_upper.startswith("II") or "2ND" in name_upper or "YEAR 2" in name_upper:
            return 2
        return 1


class TimetablePeriod(Base):
    __tablename__ = "timetable_periods"

    id = Column(Integer, primary_key=True, index=True)
    period_number = Column(Integer, unique=True, nullable=False, index=True)  # 1, 2, 3, 4, 5, 6
    name = Column(String(50), nullable=False)  # "Period 1"
    start_time = Column(String(10), nullable=False)  # "09:00"
    end_time = Column(String(10), nullable=False)    # "10:00"
    is_break = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Faculty(Base):
    __tablename__ = "faculty"

    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(String(30), unique=True, nullable=False, index=True)  # FAC-001
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    name = Column(String(100), nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    phone = Column(String(20), nullable=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    designation = Column(String(50), default="Assistant Professor")  # Professor, Assoc Prof, Asst Prof, Dean, HOD
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    
    # Non-negotiable Eligibility Flags (Rule 4)
    is_substitution_eligible = Column(Boolean, default=True)
    is_exempt = Column(Boolean, default=False)
    max_weekly_substitutions = Column(Integer, default=4)
    
    subject_expertise = Column(JSON, default=list)  # list of subject codes or tags
    status = Column(String(20), default="ACTIVE")  # ACTIVE, INACTIVE, ON_LEAVE
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="faculty_profile")
    department = relationship("Department", back_populates="faculty_members")
    role = relationship("Role", back_populates="faculty_members")
    timetable_entries = relationship("TimetableEntry", back_populates="faculty", cascade="all, delete-orphan")
    absences = relationship("Absence", back_populates="faculty", cascade="all, delete-orphan")
    assigned_duties = relationship("SubstitutionDuty", foreign_keys="SubstitutionDuty.assigned_faculty_id", back_populates="assigned_faculty")
    original_duties = relationship("SubstitutionDuty", foreign_keys="SubstitutionDuty.original_faculty_id", back_populates="original_faculty")


class TimetableVersion(Base):
    __tablename__ = "timetable_versions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)  # 2026 Semester 1 - Active
    academic_year = Column(String(20), default="2026")
    semester = Column(Integer, default=1)
    is_active = Column(Boolean, default=False, index=True)
    created_by = Column(String(100), default="Admin")
    created_at = Column(DateTime, default=datetime.utcnow)

    entries = relationship("TimetableEntry", back_populates="version", cascade="all, delete-orphan")


class TimetableEntry(Base):
    __tablename__ = "timetable_entries"

    id = Column(Integer, primary_key=True, index=True)
    timetable_version_id = Column(Integer, ForeignKey("timetable_versions.id"), nullable=False, index=True)
    faculty_id = Column(Integer, ForeignKey("faculty.id"), nullable=False, index=True)
    class_section_id = Column(Integer, ForeignKey("class_sections.id"), nullable=False, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    
    day_of_week = Column(Integer, nullable=False, index=True)  # 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday
    start_time = Column(String(10), nullable=False)  # "09:00"
    end_time = Column(String(10), nullable=False)    # "10:00"
    room_number = Column(String(30), default="Room-101")
    created_at = Column(DateTime, default=datetime.utcnow)

    version = relationship("TimetableVersion", back_populates="entries")
    faculty = relationship("Faculty", back_populates="timetable_entries")
    class_section = relationship("ClassSection")
    subject = relationship("Subject")

    __table_args__ = (
        Index("idx_tt_fac_day", "timetable_version_id", "faculty_id", "day_of_week"),
        Index("idx_tt_class_day", "timetable_version_id", "class_section_id", "day_of_week"),
    )


class Absence(Base):
    __tablename__ = "absences"

    id = Column(Integer, primary_key=True, index=True)
    faculty_id = Column(Integer, ForeignKey("faculty.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=True)  # for multi-day / long leave ranges
    leave_type = Column(String(50), default="CASUAL")  # CASUAL, MEDICAL, ON_DUTY, LONG_LEAVE, EMERGENCY, OTHER
    applied_by_role = Column(String(50), default="FACULTY")  # FACULTY, DEAN, HOD, PC, ADMIN
    start_time = Column(String(10), default="00:00")
    end_time = Column(String(10), default="23:59")
    is_full_day = Column(Boolean, default=True)
    reason = Column(String(255), nullable=True)
    status = Column(String(20), default="CONFIRMED")  # REPORTED, CONFIRMED, CANCELLED
    reported_by = Column(String(100), default="Admin")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    faculty = relationship("Faculty", back_populates="absences")
    requirements = relationship("SubstitutionRequirement", back_populates="absence", cascade="all, delete-orphan")


class SubstitutionRequirement(Base):
    __tablename__ = "substitution_requirements"

    id = Column(Integer, primary_key=True, index=True)
    absence_id = Column(Integer, ForeignKey("absences.id"), nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    day_of_week = Column(Integer, nullable=False)  # 0=Monday..6=Sunday
    period_start = Column(String(10), nullable=False)  # "09:00"
    period_end = Column(String(10), nullable=False)    # "10:00"
    class_section_id = Column(Integer, ForeignKey("class_sections.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    original_faculty_id = Column(Integer, ForeignKey("faculty.id"), nullable=False)
    
    status = Column(String(20), default="PENDING", index=True)  # PENDING, ALLOCATED, UNALLOCATED, CANCELLED
    unallocated_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    absence = relationship("Absence", back_populates="requirements")
    class_section = relationship("ClassSection")
    subject = relationship("Subject")
    original_faculty = relationship("Faculty", foreign_keys=[original_faculty_id])
    duty = relationship("SubstitutionDuty", back_populates="requirement", uselist=False, cascade="all, delete-orphan")


class SubstitutionDuty(Base):
    __tablename__ = "substitution_duties"

    id = Column(Integer, primary_key=True, index=True)
    requirement_id = Column(Integer, ForeignKey("substitution_requirements.id"), nullable=False, unique=True, index=True)
    date = Column(Date, nullable=False, index=True)
    day_of_week = Column(Integer, nullable=False)
    period_start = Column(String(10), nullable=False)
    period_end = Column(String(10), nullable=False)
    class_section_id = Column(Integer, ForeignKey("class_sections.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    original_faculty_id = Column(Integer, ForeignKey("faculty.id"), nullable=False)
    assigned_faculty_id = Column(Integer, ForeignKey("faculty.id"), nullable=False, index=True)
    
    allocation_method = Column(String(30), default="AUTOMATIC")  # AUTOMATIC, MANUAL_OVERRIDE, AI_ORCHESTRATED
    status = Column(String(20), default="SCHEDULED")  # SCHEDULED, COMPLETED, CANCELLED
    
    # Audit snapshots for historical traceability (Rules 2 & 3 snapshots)
    weekly_count_at_assignment = Column(Integer, default=0)
    daily_classes_at_assignment = Column(Integer, default=0)
    
    is_manual_override = Column(Boolean, default=False)
    override_reason = Column(String(255), nullable=True)
    overridden_by = Column(String(100), nullable=True)
    original_candidate_id = Column(Integer, ForeignKey("faculty.id"), nullable=True)
    
    allocation_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    requirement = relationship("SubstitutionRequirement", back_populates="duty")
    class_section = relationship("ClassSection")
    subject = relationship("Subject")
    original_faculty = relationship("Faculty", foreign_keys=[original_faculty_id], back_populates="original_duties")
    assigned_faculty = relationship("Faculty", foreign_keys=[assigned_faculty_id], back_populates="assigned_duties")
    original_candidate = relationship("Faculty", foreign_keys=[original_candidate_id])

    __table_args__ = (
        Index("idx_duty_fac_date", "assigned_faculty_id", "date"),
    )


class AcademicHoliday(Base):
    __tablename__ = "academic_holidays"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    date = Column(Date, nullable=False, unique=True, index=True)
    holiday_type = Column(String(50), default="NATIONAL_HOLIDAY")  # NATIONAL_HOLIDAY, FESTIVAL, SECOND_SATURDAY, SEMESTER_BREAK, INSTITUTIONAL
    academic_year = Column(String(20), default="2026")
    description = Column(String(255), nullable=True)
    is_recurring = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class ExamDuty(Base):
    __tablename__ = "exam_duties"

    id = Column(Integer, primary_key=True, index=True)
    exam_name = Column(String(150), nullable=False)  # e.g., Mid-Term Examination Spring 2026
    course_code = Column(String(30), nullable=True)  # e.g., CS301
    course_name = Column(String(150), nullable=False)  # e.g., Operating Systems & System Programming
    date = Column(Date, nullable=False, index=True)
    reporting_time = Column(String(20), nullable=False)  # e.g., "08:30 AM"
    exam_start_time = Column(String(20), nullable=False)  # e.g., "09:00 AM"
    exam_end_time = Column(String(20), nullable=False)  # e.g., "12:00 PM"
    venue = Column(String(100), nullable=False)  # e.g., Exam Hall B-204, Block-3
    assigned_faculty_id = Column(Integer, ForeignKey("faculty.id"), nullable=False, index=True)
    role_type = Column(String(50), default="Room Invigilator")  # Room Invigilator, Chief Superintendent, Hall Supervisor, Flying Squad, Reliever
    allotted_by = Column(String(100), default="Admin / Exam Cell")
    target_roles = Column(JSON, default=lambda: ["FACULTY", "DEAN", "PC"])
    status = Column(String(30), default="SCHEDULED")  # SCHEDULED, ACKNOWLEDGED, COMPLETED, CANCELLED
    instructions = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    assigned_faculty = relationship("Faculty", foreign_keys=[assigned_faculty_id])


class SystemRule(Base):
    __tablename__ = "system_rules"

    id = Column(Integer, primary_key=True, index=True)
    rule_key = Column(String(50), unique=True, nullable=False, index=True)
    rule_name = Column(String(100), nullable=False)
    rule_value = Column(String(255), nullable=False)
    data_type = Column(String(20), default="integer")  # integer, boolean, string, json
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    updated_by = Column(String(100), default="System")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(50), nullable=False, index=True)  # ALLOCATION_GENERATED, MANUAL_OVERRIDE, ABSENCE_CREATED, EXAM_DUTY_ALLOCATED, etc.
    actor_id = Column(Integer, nullable=True)
    actor_name = Column(String(100), default="System")
    target_type = Column(String(50), nullable=True)  # SUBSTITUTION_DUTY, ABSENCE, TIMETABLE, EXAM_DUTY
    target_id = Column(Integer, nullable=True)
    requirement_id = Column(Integer, nullable=True, index=True)
    details = Column(JSON, default=dict)  # structured record
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(150), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50), default="SUBSTITUTION_ASSIGNED")  # SUBSTITUTION_ASSIGNED, EXAM_DUTY_ALLOCATED, LEAVE_APPLIED, ATTENDANCE_UPDATE, SYSTEM
    is_read = Column(Boolean, default=False, index=True)
    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="notifications")

