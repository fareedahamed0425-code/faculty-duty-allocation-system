from datetime import date, datetime, timedelta
import random
from sqlalchemy.orm import Session
from app.db.session import engine, Base, SessionLocal
from app.core.security import get_password_hash
from app.models.entities import (
    Role, User, Department, Subject, ClassSection, Faculty,
    TimetableVersion, TimetableEntry, Absence, SubstitutionRequirement,
    SubstitutionDuty, SystemRule, AuditLog, Notification
)

def seed_database(db: Session = None):
    close_db_at_end = False
    if db is None:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        close_db_at_end = True

    try:
        # Check if already seeded
        if db.query(Role).count() > 0:
            print("Database already initialized with roles.")
            return

        print("Initializing clean institutional structure...")

        # 1. ROLES
        roles_data = [
            {"name": "ADMIN", "description": "System Administrator with full access", "is_default_exempt": True, "is_default_eligible": False, "permissions": ["all"]},
            {"name": "DEAN", "description": "Dean of Academic Affairs (Read-only overview, Exempt)", "is_default_exempt": True, "is_default_eligible": False, "permissions": ["view_dashboard", "view_reports", "view_timetables"]},
            {"name": "HOD", "description": "Head of Department (Department oversight, Exempt)", "is_default_exempt": True, "is_default_eligible": False, "permissions": ["view_dashboard", "view_department", "view_reports"]},
            {"name": "FACULTY", "description": "Standard Teaching Faculty (Substitution Eligible)", "is_default_exempt": False, "is_default_eligible": True, "permissions": ["view_my_schedule", "view_my_duties"]},
            {"name": "PC", "description": "Program Coordinator", "is_default_exempt": True, "is_default_eligible": False, "permissions": ["view_dashboard", "view_classes"]},
            {"name": "COMMITTEE_MEMBER", "description": "Internal Committee Member (Exempt)", "is_default_exempt": True, "is_default_eligible": False, "permissions": ["view_dashboard"]}
        ]
        roles_map = {}
        for r_dict in roles_data:
            role = Role(**r_dict)
            db.add(role)
            db.flush()
            roles_map[role.name] = role

        # 2. DEPARTMENTS
        departments_data = [
            {"code": "CSE", "name": "Computer Science & Engineering", "description": "Department of CSE"},
            {"code": "ECE", "name": "Electronics & Communication", "description": "Department of ECE"},
            {"code": "MECH", "name": "Mechanical Engineering", "description": "Department of Mechanical Engineering"},
            {"code": "MATH", "name": "Mathematics & Basic Sciences", "description": "Department of Mathematics"}
        ]
        dept_map = {}
        for d_dict in departments_data:
            dept = Department(**d_dict)
            db.add(dept)
            db.flush()
            dept_map[dept.code] = dept

        # 3. SUBJECTS
        subjects_data = [
            {"code": "CS101", "name": "Data Structures & Algorithms", "department_id": dept_map["CSE"].id, "credits": 4},
            {"code": "CS102", "name": "Operating Systems", "department_id": dept_map["CSE"].id, "credits": 3},
            {"code": "CS103", "name": "Database Management Systems", "department_id": dept_map["CSE"].id, "credits": 4},
            {"code": "CS104", "name": "Computer Networks", "department_id": dept_map["CSE"].id, "credits": 3},
            {"code": "CS105", "name": "Software Engineering", "department_id": dept_map["CSE"].id, "credits": 3},
            {"code": "EC201", "name": "Digital Signal Processing", "department_id": dept_map["ECE"].id, "credits": 4},
            {"code": "EC202", "name": "VLSI Design & Technology", "department_id": dept_map["ECE"].id, "credits": 4},
            {"code": "EC203", "name": "Microprocessors & Microcontrollers", "department_id": dept_map["ECE"].id, "credits": 3},
            {"code": "EC204", "name": "Communication Systems", "department_id": dept_map["ECE"].id, "credits": 3},
            {"code": "ME301", "name": "Engineering Thermodynamics", "department_id": dept_map["MECH"].id, "credits": 4},
            {"code": "ME302", "name": "Fluid Mechanics", "department_id": dept_map["MECH"].id, "credits": 4},
            {"code": "ME303", "name": "Manufacturing Processes", "department_id": dept_map["MECH"].id, "credits": 3},
            {"code": "MA101", "name": "Calculus & Linear Algebra", "department_id": dept_map["MATH"].id, "credits": 4},
            {"code": "MA102", "name": "Probability & Statistics", "department_id": dept_map["MATH"].id, "credits": 3}
        ]
        for s_dict in subjects_data:
            subj = Subject(**s_dict)
            db.add(subj)
            db.flush()

        # 4. CLASSES / SECTIONS
        classes_data = [
            {"name": "CSE-A", "department_id": dept_map["CSE"].id, "academic_year": "2026", "semester": 4},
            {"name": "CSE-B", "department_id": dept_map["CSE"].id, "academic_year": "2026", "semester": 4},
            {"name": "CSE-C", "department_id": dept_map["CSE"].id, "academic_year": "2026", "semester": 6},
            {"name": "ECE-A", "department_id": dept_map["ECE"].id, "academic_year": "2026", "semester": 4},
            {"name": "ECE-B", "department_id": dept_map["ECE"].id, "academic_year": "2026", "semester": 6},
            {"name": "MECH-A", "department_id": dept_map["MECH"].id, "academic_year": "2026", "semester": 4},
            {"name": "MECH-B", "department_id": dept_map["MECH"].id, "academic_year": "2026", "semester": 6}
        ]
        for c_dict in classes_data:
            cls = ClassSection(**c_dict)
            db.add(cls)
            db.flush()

        # 5. INITIAL PRIMARY ADMIN ACCOUNT
        admin_user = User(
            email="admin@apollouniversity.edu.in",
            hashed_password=get_password_hash("Admin@123"),
            full_name="Apollo Administrator",
            role_id=roles_map["ADMIN"].id,
            is_active=True
        )
        db.add(admin_user)
        db.flush()

        admin_faculty = Faculty(
            faculty_id="ADMIN-APOLLO",
            user_id=admin_user.id,
            name="Apollo Administrator",
            email="admin@apollouniversity.edu.in",
            phone="+91 98765 43210",
            department_id=dept_map["CSE"].id,
            designation="System Administrator",
            role_id=roles_map["ADMIN"].id,
            is_substitution_eligible=False,
            is_exempt=True,
            max_weekly_substitutions=0,
            status="ACTIVE"
        )
        db.add(admin_faculty)
        db.flush()

        # 6. SYSTEM RULES (Rules 1 to 7)
        rules_data = [
            {
                "rule_number": 1,
                "name": "Slot Conflict Rule",
                "description": "Faculty already engaged in a scheduled class or approved duty during the specified time slot is strictly disqualified.",
                "rule_type": "HARD",
                "parameters_json": {},
                "is_active": True
            },
            {
                "rule_number": 2,
                "name": "Daily Regular Load Limit",
                "description": "Faculty having maximum permissible regular classes on the target day cannot be assigned duty (default: <= 2 classes).",
                "rule_type": "HARD",
                "parameters_json": {"max_daily_classes": 2},
                "is_active": True
            },
            {
                "rule_number": 3,
                "name": "Weekly Substitution Cap",
                "description": "Faculty who have reached the weekly maximum substitution duty quota are disqualified (default: <= 4 duties/week).",
                "rule_type": "HARD",
                "parameters_json": {"max_weekly_substitutions": 4},
                "is_active": True
            },
            {
                "rule_number": 4,
                "name": "Institutional Exemption Rule",
                "description": "Exempt positions (Dean, HOD, Program Coordinator, Committee Member) are disqualified from substitution allocation.",
                "rule_type": "HARD",
                "parameters_json": {"exempt_roles": ["DEAN", "HOD", "PC", "COMMITTEE_MEMBER", "ADMIN"]},
                "is_active": True
            },
            {
                "rule_number": 5,
                "name": "Department Affinity & Expertise",
                "description": "Prioritize substitutes from the same department (+50 pts) and subject domain expertise (+30 pts).",
                "rule_type": "SOFT",
                "parameters_json": {"same_dept_score": 50, "subject_expertise_score": 30},
                "is_active": True
            },
            {
                "rule_number": 6,
                "name": "Daily Workload Spacing",
                "description": "Prefer faculty with fewer total duties on the given day (+20 pts for 0 duties).",
                "rule_type": "SOFT",
                "parameters_json": {"zero_daily_duties_score": 20},
                "is_active": True
            },
            {
                "rule_number": 7,
                "name": "Workload Fairness / Equal Distribution",
                "description": "Deterministically prioritize faculty with lowest weekly cumulative substitutions (0 duties > 1 duty > 2 duties).",
                "rule_type": "SOFT",
                "parameters_json": {"weight_per_duty_delta": 40},
                "is_active": True
            }
        ]

        for r_dict in rules_data:
            rule = SystemRule(**r_dict, updated_by="Administrator")
            db.add(rule)

        db.commit()
        print("Clean institutional database structure initialized successfully!")

    except Exception as e:
        db.rollback()
        print("Error during database initialization:", e)
        raise e
    finally:
        if close_db_at_end:
            db.close()

if __name__ == "__main__":
    seed_database()
