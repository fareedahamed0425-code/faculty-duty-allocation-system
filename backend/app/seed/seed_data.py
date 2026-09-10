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

INSTITUTIONAL_MEMBERS = [
    # Administrators
    {
        "name": "Apollo Administrator",
        "email": "admin@apollouniversity.edu.in",
        "role": "ADMIN",
        "dept": "CSE",
        "designation": "System Administrator",
        "phone": "+91 98765 43210",
        "is_exempt": True,
        "is_eligible": False
    },
    # Leadership: Deans & HODs
    {
        "name": "Dr. Vikramaditya Rao",
        "email": "dean.academics@apollouniversity.edu.in",
        "role": "DEAN",
        "dept": "CSE",
        "designation": "Dean of Academic Affairs",
        "phone": "+91 98765 11001",
        "is_exempt": True,
        "is_eligible": False
    },
    {
        "name": "Dr. Rajesh Sharma",
        "email": "hod.cse@apollouniversity.edu.in",
        "role": "HOD",
        "dept": "CSE",
        "designation": "Professor & Head of Department",
        "phone": "+91 98765 11002",
        "is_exempt": True,
        "is_eligible": False
    },
    {
        "name": "Dr. Ananya Sen",
        "email": "hod.ece@apollouniversity.edu.in",
        "role": "HOD",
        "dept": "ECE",
        "designation": "Professor & Head of Department",
        "phone": "+91 98765 11003",
        "is_exempt": True,
        "is_eligible": False
    },
    {
        "name": "Dr. Ramesh Babu",
        "email": "hod.mech@apollouniversity.edu.in",
        "role": "HOD",
        "dept": "MECH",
        "designation": "Professor & Head of Department",
        "phone": "+91 98765 11004",
        "is_exempt": True,
        "is_eligible": False
    },
    # Coordinators & Committee
    {
        "name": "Prof. Sneha Patel",
        "email": "sneha.patel@apollouniversity.edu.in",
        "role": "PC",
        "dept": "CSE",
        "designation": "Program Coordinator (B.Tech CSE)",
        "phone": "+91 98765 22001",
        "is_exempt": True,
        "is_eligible": False
    },
    {
        "name": "Dr. K. V. Prasad",
        "email": "kv.prasad@apollouniversity.edu.in",
        "role": "COMMITTEE_MEMBER",
        "dept": "ECE",
        "designation": "Examination Committee Convener",
        "phone": "+91 98765 22002",
        "is_exempt": True,
        "is_eligible": False
    },
    # Teaching Faculty Members (Eligible for substitutions)
    {
        "name": "Prof. Arun Kumar",
        "email": "arun.kumar@apollouniversity.edu.in",
        "role": "FACULTY",
        "dept": "CSE",
        "designation": "Assistant Professor",
        "phone": "+91 98765 33001",
        "is_exempt": False,
        "is_eligible": True,
        "expertise": ["CS101", "CS102"]
    },
    {
        "name": "Prof. Priya Nair",
        "email": "priya.nair@apollouniversity.edu.in",
        "role": "FACULTY",
        "dept": "CSE",
        "designation": "Associate Professor",
        "phone": "+91 98765 33002",
        "is_exempt": False,
        "is_eligible": True,
        "expertise": ["CS103", "CS104"]
    },
    {
        "name": "Prof. Mohammad Ahmed",
        "email": "m.ahmed@apollouniversity.edu.in",
        "role": "FACULTY",
        "dept": "CSE",
        "designation": "Assistant Professor",
        "phone": "+91 98765 33003",
        "is_exempt": False,
        "is_eligible": True,
        "expertise": ["CS102", "CS105"]
    },
    {
        "name": "Prof. Manoj Verma",
        "email": "manoj.verma@apollouniversity.edu.in",
        "role": "FACULTY",
        "dept": "ECE",
        "designation": "Assistant Professor",
        "phone": "+91 98765 44001",
        "is_exempt": False,
        "is_eligible": True,
        "expertise": ["EC201", "EC202"]
    },
    {
        "name": "Prof. Divya Krishnan",
        "email": "divya.k@apollouniversity.edu.in",
        "role": "FACULTY",
        "dept": "ECE",
        "designation": "Assistant Professor",
        "phone": "+91 98765 44002",
        "is_exempt": False,
        "is_eligible": True,
        "expertise": ["EC203", "EC204"]
    },
    {
        "name": "Prof. Sanjay Mehta",
        "email": "sanjay.mehta@apollouniversity.edu.in",
        "role": "FACULTY",
        "dept": "MECH",
        "designation": "Associate Professor",
        "phone": "+91 98765 55001",
        "is_exempt": False,
        "is_eligible": True,
        "expertise": ["ME301", "ME302"]
    },
    {
        "name": "Prof. Kavita Reddy",
        "email": "kavita.reddy@apollouniversity.edu.in",
        "role": "FACULTY",
        "dept": "MATH",
        "designation": "Assistant Professor",
        "phone": "+91 98765 66001",
        "is_exempt": False,
        "is_eligible": True,
        "expertise": ["MA101", "MA102"]
    }
]

def seed_database(db: Session = None, include_demo_data: bool = False):
    close_db_at_end = False
    if db is None:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        close_db_at_end = True

    try:
        # 1. Ensure Roles
        roles_map = {}
        for r_dict in ROLES_METADATA:
            role = db.query(Role).filter(Role.name == r_dict["name"]).first()
            if not role:
                role = Role(**r_dict)
                db.add(role)
                db.flush()
            roles_map[role.name] = role

        # 2. System Rules (Rules 1 to 7)
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
                "description": "Faculty having maximum permissible regular classes on the target day cannot take duties",
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
                "rule_value": '["ADMIN", "DEAN", "PC", "INTERNAL_MEMBERS"]',
                "data_type": "json",
                "description": "Exempt leadership and administrative positions from substitution allocations",
                "is_active": True
            },
            {
                "rule_key": "rule_5_affinity",
                "rule_name": "Department & Domain Affinity Weight",
                "rule_value": "50",
                "data_type": "integer",
                "description": "Priority score bonus for candidates from the same department and subject expertise",
                "is_active": True
            },
            {
                "rule_key": "rule_6_daily_spacing",
                "rule_name": "Daily Workload Spacing Score",
                "rule_value": "20",
                "data_type": "integer",
                "description": "Priority score bonus for candidates with zero duties scheduled on the target day",
                "is_active": True
            },
            {
                "rule_key": "rule_7_fairness",
                "rule_name": "Deterministic Fairness Distribution",
                "rule_value": "40",
                "data_type": "integer",
                "description": "Prioritize candidates with lowest weekly cumulative substitutions (0 duties > 1 duty > 2 duties)",
                "is_active": True
            }
        ]

        for r_dict in rules_data:
            existing_rule = db.query(SystemRule).filter(SystemRule.rule_key == r_dict["rule_key"]).first()
            if not existing_rule:
                rule = SystemRule(**r_dict, updated_by="Administrator")
                db.add(rule)

        # 3. Base Institutional Departments
        departments_data = [
            {"code": "AIDS", "name": "Artificial Intelligence and Data Science", "description": "Department of Artificial Intelligence and Data Science"},
            {"code": "AIML", "name": "Artificial Intelligence and Machine Learning", "description": "Department of Artificial Intelligence and Machine Learning"},
            {"code": "CSE", "name": "Computer Science Engineering", "description": "Department of Computer Science Engineering"},
            {"code": "CS", "name": "Cyber Security", "description": "Department of Cyber Security"},
            {"code": "CC", "name": "Cloud Computing", "description": "Department of Cloud Computing"},
            {"code": "AIHC", "name": "Artificial Intelligence and Healthcare", "description": "Department of Artificial Intelligence and Healthcare"},
            {"code": "ECE", "name": "Electronics & Communication Engineering", "description": "Department of Electronics and Communication"},
            {"code": "MECH", "name": "Mechanical Engineering", "description": "Department of Mechanical Engineering"},
            {"code": "MATH", "name": "Department of Mathematics & Sciences", "description": "Department of Mathematics and Foundational Sciences"}
        ]
        dept_map = {}
        for d_dict in departments_data:
            dept = db.query(Department).filter(Department.code == d_dict["code"]).first()
            if not dept:
                dept = Department(**d_dict)
                db.add(dept)
                db.flush()
            dept_map[dept.code] = dept

        # 4. Ensure Primary Admin User
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

        # 5. Optional Demo Mockup Data
        if include_demo_data:

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
            subj_map = {}
            for s_dict in subjects_data:
                subj = db.query(Subject).filter(Subject.code == s_dict["code"]).first()
                if not subj:
                    subj = Subject(**s_dict)
                    db.add(subj)
                    db.flush()
                subj_map[subj.code] = subj

            classes_data = [
                {"name": "CSE-A", "department_id": dept_map["CSE"].id, "academic_year": "2026", "semester": 4},
                {"name": "CSE-B", "department_id": dept_map["CSE"].id, "academic_year": "2026", "semester": 4},
                {"name": "CSE-C", "department_id": dept_map["CSE"].id, "academic_year": "2026", "semester": 6},
                {"name": "ECE-A", "department_id": dept_map["ECE"].id, "academic_year": "2026", "semester": 4},
                {"name": "ECE-B", "department_id": dept_map["ECE"].id, "academic_year": "2026", "semester": 6},
                {"name": "MECH-A", "department_id": dept_map["MECH"].id, "academic_year": "2026", "semester": 4},
                {"name": "MECH-B", "department_id": dept_map["MECH"].id, "academic_year": "2026", "semester": 6}
            ]
            class_map = {}
            for c_dict in classes_data:
                cls = db.query(ClassSection).filter(ClassSection.name == c_dict["name"]).first()
                if not cls:
                    cls = ClassSection(**c_dict)
                    db.add(cls)
                    db.flush()
                class_map[cls.name] = cls

            faculty_map = {}
            for idx, m in enumerate(INSTITUTIONAL_MEMBERS, start=1):
                clean_email = m["email"].strip().lower()
                role = roles_map[m["role"]]
                dept = dept_map[m["dept"]]

                user = db.query(User).filter(User.email == clean_email).first()
                if not user:
                    user = User(
                        email=clean_email,
                        hashed_password=get_password_hash("Apollo@2026"),
                        full_name=m["name"],
                        role_id=role.id,
                        is_active=True
                    )
                    db.add(user)
                    db.flush()

                fac_code = f"FAC-{idx:03d}" if m["role"] != "ADMIN" else "ADMIN-APOLLO"
                faculty = db.query(Faculty).filter(Faculty.email == clean_email).first()
                if not faculty:
                    faculty = Faculty(
                        faculty_id=fac_code,
                        user_id=user.id,
                        name=m["name"],
                        email=clean_email,
                        phone=m.get("phone", "+91 98765 00000"),
                        department_id=dept.id,
                        designation=m["designation"],
                        role_id=role.id,
                        is_substitution_eligible=m["is_eligible"],
                        is_exempt=m["is_exempt"],
                        max_weekly_substitutions=0 if m["is_exempt"] else 4,
                        subject_expertise=m.get("expertise", []),
                        status="ACTIVE"
                    )
                    db.add(faculty)
                    db.flush()

                faculty_map[clean_email] = faculty

            version = db.query(TimetableVersion).filter(TimetableVersion.is_active == True).first()
            if not version:
                version = TimetableVersion(name="2026 Academic Year - Semester Spring", academic_year="2026", is_active=True)
                db.add(version)
                db.flush()

            if db.query(TimetableEntry).filter(TimetableEntry.timetable_version_id == version.id).count() == 0:
                slots = [
                    ("09:00", "10:00"),
                    ("10:00", "11:00"),
                    ("11:15", "12:15"),
                    ("13:15", "14:15"),
                    ("14:15", "15:15"),
                ]
                teaching_emails = [
                    "arun.kumar@apollouniversity.edu.in",
                    "priya.nair@apollouniversity.edu.in",
                    "m.ahmed@apollouniversity.edu.in",
                    "manoj.verma@apollouniversity.edu.in",
                    "divya.k@apollouniversity.edu.in",
                    "sanjay.mehta@apollouniversity.edu.in",
                    "kavita.reddy@apollouniversity.edu.in"
                ]
                subject_codes = ["CS101", "CS102", "CS103", "EC201", "EC202", "ME301", "MA101"]
                class_names = ["CSE-A", "CSE-B", "CSE-C", "ECE-A", "ECE-B", "MECH-A", "MECH-B"]

                for day in range(6):
                    for i, email in enumerate(teaching_emails):
                        fac = faculty_map.get(email)
                        if not fac:
                            continue
                        slot = slots[(day + i) % len(slots)]
                        subj = subj_map[subject_codes[i % len(subject_codes)]]
                        cls = class_map[class_names[i % len(class_names)]]

                        entry = TimetableEntry(
                            timetable_version_id=version.id,
                            faculty_id=fac.id,
                            class_section_id=cls.id,
                            subject_id=subj.id,
                            day_of_week=day,
                            start_time=slot[0],
                            end_time=slot[1],
                            room_number=f"Hall {101 + (i % 5)}"
                        )
                        db.add(entry)

        db.commit()
        print("Apollo University Institutional Database initialized!")

    except Exception as e:
        db.rollback()
        print("Error during database initialization:", e)
        raise e
    finally:
        if close_db_at_end:
            db.close()

if __name__ == "__main__":
    seed_database()
