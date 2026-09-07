import json
from app.db.session import SessionLocal, engine, Base
from app.core.security import get_password_hash
from app.models.entities import (
    Role, User, Department, Subject, ClassSection, Faculty,
    TimetableVersion, TimetableEntry, Absence, SubstitutionRequirement,
    SubstitutionDuty, AcademicHoliday, ExamDuty, SystemRule, AuditLog, Notification
)

def reset_to_clean_state():
    db = SessionLocal()
    try:
        print("Wiping all mock data from Neon PostgreSQL...")
        # Delete child tables first to respect foreign key constraints
        db.query(Notification).delete()
        db.query(AuditLog).delete()
        db.query(SubstitutionDuty).delete()
        db.query(SubstitutionRequirement).delete()
        db.query(Absence).delete()
        db.query(ExamDuty).delete()
        db.query(TimetableEntry).delete()
        db.query(TimetableVersion).delete()
        db.query(AcademicHoliday).delete()
        db.query(Faculty).delete()
        db.query(User).delete()
        db.query(ClassSection).delete()
        db.query(Subject).delete()
        db.query(Department).delete()
        db.query(SystemRule).delete()
        db.query(Role).delete()
        db.commit()

        print("Initializing essential foundation (Roles, Rules, Primary Admin)...")

        # 1. Base Roles
        roles_meta = [
            {"name": "ADMIN", "description": "System Administrator with full access", "is_default_exempt": True, "is_default_eligible": False, "permissions": ["all"]},
            {"name": "DEAN", "description": "Dean of Academic Affairs (Academic governance & reports, Exempt)", "is_default_exempt": True, "is_default_eligible": False, "permissions": ["view_dashboard", "view_reports", "view_timetables", "view_compliance"]},
            {"name": "HOD", "description": "Head of Department (Department oversight & approvals, Exempt)", "is_default_exempt": True, "is_default_eligible": False, "permissions": ["view_dashboard", "view_department", "view_reports", "manage_substitutions"]},
            {"name": "FACULTY", "description": "Standard Teaching Faculty (Substitution Eligible)", "is_default_exempt": False, "is_default_eligible": True, "permissions": ["view_my_schedule", "view_my_duties", "request_leaves"]},
            {"name": "PC", "description": "Program Coordinator (Curriculum & Class Monitoring)", "is_default_exempt": True, "is_default_eligible": False, "permissions": ["view_dashboard", "view_classes", "view_timetables"]},
            {"name": "COMMITTEE_MEMBER", "description": "Internal Examination / Disciplinary Committee Member (Exempt)", "is_default_exempt": True, "is_default_eligible": False, "permissions": ["view_dashboard", "view_reports"]}
        ]

        roles_map = {}
        for r_dict in roles_meta:
            role = Role(**r_dict)
            db.add(role)
            db.flush()
            roles_map[role.name] = role

        # 2. System Rules
        rules_data = [
            {
                "rule_key": "rule_1_slot_conflict",
                "rule_name": "Slot Conflict Disqualification",
                "rule_value": "true",
                "data_type": "boolean",
                "description": "Faculty with scheduled classes or existing duties in target slot are disqualified",
                "is_active": True
            },
            {
                "rule_key": "rule_2_daily_limit",
                "rule_name": "Daily Regular Load Limit",
                "rule_value": "2",
                "data_type": "integer",
                "description": "Faculty having maximum permissible regular classes on target day cannot take duties",
                "is_active": True
            },
            {
                "rule_key": "rule_3_weekly_cap",
                "rule_name": "Weekly Substitution Quota Cap",
                "rule_value": "4",
                "data_type": "integer",
                "description": "Maximum weekly substitutions permitted per faculty member",
                "is_active": True
            },
            {
                "rule_key": "rule_4_exemption",
                "rule_name": "Institutional Exemption Filter",
                "rule_value": json.dumps(["ADMIN", "DEAN", "HOD", "PC", "COMMITTEE_MEMBER"]),
                "data_type": "json",
                "description": "Exempt leadership and administrative positions from substitutions",
                "is_active": True
            },
            {
                "rule_key": "rule_5_affinity",
                "rule_name": "Department & Domain Affinity Weight",
                "rule_value": "50",
                "data_type": "integer",
                "description": "Priority score bonus for same department and subject expertise",
                "is_active": True
            },
            {
                "rule_key": "rule_6_daily_spacing",
                "rule_name": "Daily Workload Spacing Score",
                "rule_value": "20",
                "data_type": "integer",
                "description": "Priority score bonus for faculty with 0 duties on target day",
                "is_active": True
            },
            {
                "rule_key": "rule_7_fairness",
                "rule_name": "Deterministic Fairness Distribution",
                "rule_value": "40",
                "data_type": "integer",
                "description": "Prioritize candidates with lowest weekly cumulative substitutions",
                "is_active": True
            }
        ]
        for r_dict in rules_data:
            db.add(SystemRule(**r_dict, updated_by="System Initializer"))

        # 3. Primary Admin User
        admin_user = User(
            email="admin@apollouniversity.edu.in",
            hashed_password=get_password_hash("Apollo@2026"),
            full_name="Apollo Administrator",
            role_id=roles_map["ADMIN"].id,
            is_active=True
        )
        db.add(admin_user)

        db.commit()
        print("Database successfully wiped of all mock data and reset to clean state!")

    except Exception as e:
        db.rollback()
        print("Error resetting database:", e)
        raise e
    finally:
        db.close()

if __name__ == "__main__":
    reset_to_clean_state()
