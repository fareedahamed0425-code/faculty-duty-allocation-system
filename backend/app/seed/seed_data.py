import json
from datetime import datetime
from sqlalchemy.orm import Session
from app.db.session import engine, Base, SessionLocal
from app.core.security import get_password_hash
from app.models.entities import Role, User, Department, SystemRule

ROLES_METADATA = [
    {"name": "ADMIN", "description": "System Administrator with full access", "is_default_exempt": True, "is_default_eligible": False, "permissions": ["all"]},
    {"name": "FACULTY", "description": "Standard Teaching Faculty (Substitution Eligible)", "is_default_exempt": False, "is_default_eligible": True, "permissions": ["view_my_schedule", "view_my_duties", "request_leaves"]},
    {"name": "DEAN", "description": "Dean of Academic Affairs (Academic governance & reports, Exempt)", "is_default_exempt": True, "is_default_eligible": False, "permissions": ["view_dashboard", "view_reports", "view_timetables", "view_compliance"]},
    {"name": "HOD", "description": "Head of Department (Department management & workload, Exempt)", "is_default_exempt": True, "is_default_eligible": False, "permissions": ["view_dashboard", "view_department", "view_reports", "manage_substitutions"]},
    {"name": "PC", "description": "Program Coordinator (Curriculum & Class Monitoring, Exempt)", "is_default_exempt": True, "is_default_eligible": False, "permissions": ["view_dashboard", "view_classes", "view_timetables"]},
    {"name": "COMMITTEE_MEMBER", "description": "Examination & Academic Committee Member (Exempt)", "is_default_exempt": True, "is_default_eligible": False, "permissions": ["view_dashboard", "view_reports", "manage_exams"]},
    {"name": "INTERNAL_MEMBERS", "description": "Internal Members (Institutional Committee & Department Core, Exempt)", "is_default_exempt": True, "is_default_eligible": False, "permissions": ["view_dashboard", "view_reports"]},
    {"name": "ADDITIONAL_MEMBERS", "description": "Additional Members (Adjunct / Extended Academic Staff, Eligible)", "is_default_exempt": False, "is_default_eligible": True, "permissions": ["view_my_schedule", "view_my_duties", "request_leaves"]}
]

RULES_METADATA = [
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
        "rule_value": json.dumps(["ADMIN", "DEAN", "HOD", "PC", "COMMITTEE_MEMBER", "INTERNAL_MEMBERS"]),
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

DEPARTMENTS_METADATA = [
    {"code": "AIDS", "name": "Artificial Intelligence and Data Science", "description": "Department of Artificial Intelligence and Data Science"},
    {"code": "AIML", "name": "Artificial Intelligence and Machine Learning", "description": "Department of Artificial Intelligence and Machine Learning"},
    {"code": "CSE", "name": "Computer Science Engineering", "description": "Department of Computer Science Engineering"},
    {"code": "CS", "name": "Cyber Security", "description": "Department of Cyber Security"},
    {"code": "CC", "name": "Cloud Computing", "description": "Department of Cloud Computing"},
    {"code": "AIHC", "name": "Artificial Intelligence and Healthcare", "description": "Department of Artificial Intelligence and Healthcare"}
]

def seed_database(db: Session = None, include_demo_data: bool = False, close_db_at_end: bool = False):
    """
    Initializes standard production foundation (Roles, Rules, 6 Approved University Departments, Primary Admin).
    Does NOT seed mock faculty or mock timetables.
    """
    if db is None:
        db = SessionLocal()
        close_db_at_end = True

    try:
        # 1. Base Roles
        roles_map = {}
        for r_dict in ROLES_METADATA:
            role = db.query(Role).filter(Role.name == r_dict["name"]).first()
            if not role:
                role = Role(**r_dict)
                db.add(role)
                db.flush()
            roles_map[role.name] = role

        # 2. System Rules
        for r_dict in RULES_METADATA:
            rule = db.query(SystemRule).filter(SystemRule.rule_key == r_dict["rule_key"]).first()
            if not rule:
                rule = SystemRule(**r_dict, updated_by="Administrator")
                db.add(rule)

        # 3. Exclusively the 6 Approved University Departments
        dept_map = {}
        for d_dict in DEPARTMENTS_METADATA:
            dept = db.query(Department).filter(Department.code == d_dict["code"]).first()
            if not dept:
                dept = Department(**d_dict)
                db.add(dept)
                db.flush()
            dept_map[dept.code] = dept

        # 4. Primary Admin User
        admin_user = db.query(User).filter(User.email == "admin@apollouniversity.edu.in").first()
        if not admin_user:
            admin_user = User(
                email="admin@apollouniversity.edu.in",
                hashed_password=get_password_hash("Apollo@2026"),
                full_name="Apollo Administrator",
                role_id=roles_map["ADMIN"].id,
                is_active=True
            )
            db.add(admin_user)
            db.flush()

        db.commit()
        print("Apollo University Institutional Database Foundation Initialized (Zero Mock Data)!")

    except Exception as e:
        db.rollback()
        print("Error during database initialization:", e)
        raise e
    finally:
        if close_db_at_end:
            db.close()

if __name__ == "__main__":
    seed_database()
