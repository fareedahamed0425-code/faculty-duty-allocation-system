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
            print("Database already seeded.")
            return

        print("Seeding database with institutional data...")

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
            # CSE
            {"code": "CS101", "name": "Data Structures & Algorithms", "department_id": dept_map["CSE"].id, "credits": 4},
            {"code": "CS102", "name": "Operating Systems", "department_id": dept_map["CSE"].id, "credits": 3},
            {"code": "CS103", "name": "Database Management Systems", "department_id": dept_map["CSE"].id, "credits": 4},
            {"code": "CS104", "name": "Computer Networks", "department_id": dept_map["CSE"].id, "credits": 3},
            {"code": "CS105", "name": "Software Engineering", "department_id": dept_map["CSE"].id, "credits": 3},
            # ECE
            {"code": "EC201", "name": "Digital Signal Processing", "department_id": dept_map["ECE"].id, "credits": 4},
            {"code": "EC202", "name": "VLSI Design & Technology", "department_id": dept_map["ECE"].id, "credits": 4},
            {"code": "EC203", "name": "Microprocessors & Microcontrollers", "department_id": dept_map["ECE"].id, "credits": 3},
            {"code": "EC204", "name": "Communication Systems", "department_id": dept_map["ECE"].id, "credits": 3},
            # MECH
            {"code": "ME301", "name": "Engineering Thermodynamics", "department_id": dept_map["MECH"].id, "credits": 4},
            {"code": "ME302", "name": "Fluid Mechanics", "department_id": dept_map["MECH"].id, "credits": 4},
            {"code": "ME303", "name": "Manufacturing Processes", "department_id": dept_map["MECH"].id, "credits": 3},
            # MATH
            {"code": "MA101", "name": "Calculus & Linear Algebra", "department_id": dept_map["MATH"].id, "credits": 4},
            {"code": "MA102", "name": "Probability & Statistics", "department_id": dept_map["MATH"].id, "credits": 3}
        ]
        subject_map = {}
        for s_dict in subjects_data:
            subj = Subject(**s_dict)
            db.add(subj)
            db.flush()
            subject_map[subj.code] = subj

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
        class_map = {}
        for c_dict in classes_data:
            cls = ClassSection(**c_dict)
            db.add(cls)
            db.flush()
            class_map[cls.name] = cls

        # 5. FACULTY & USERS (25+ Faculty Members)
        faculty_definitions = [
            # Admin
            {"id": "ADMIN-01", "name": "System Administrator", "email": "admin@institution.edu", "role": "ADMIN", "dept": "CSE", "desig": "Administrator", "exempt": True, "eligible": False, "exp": []},
            # Dean & Leadership (Exempt)
            {"id": "FAC-001", "name": "Dr. Vikram Malhotra", "email": "dean@institution.edu", "role": "DEAN", "dept": "CSE", "desig": "Dean of Academics", "exempt": True, "eligible": False, "exp": ["CS101", "CS105"]},
            {"id": "FAC-002", "name": "Dr. Sunita Rao", "email": "hod.cse@institution.edu", "role": "HOD", "dept": "CSE", "desig": "Professor & HOD", "exempt": True, "eligible": False, "exp": ["CS102", "CS103"]},
            {"id": "FAC-003", "name": "Dr. Anand Verma", "email": "hod.ece@institution.edu", "role": "HOD", "dept": "ECE", "desig": "Professor & HOD", "exempt": True, "eligible": False, "exp": ["EC201", "EC202"]},
            {"id": "FAC-004", "name": "Dr. Ramesh Gupta", "email": "committee@institution.edu", "role": "COMMITTEE_MEMBER", "dept": "MECH", "desig": "Professor", "exempt": True, "eligible": False, "exp": ["ME301"]},
            # CSE Faculty
            {"id": "FAC-101", "name": "Prof. Kumar Sanjeev", "email": "kumar@institution.edu", "role": "FACULTY", "dept": "CSE", "desig": "Associate Professor", "exempt": False, "eligible": True, "exp": ["CS101", "CS103"]},
            {"id": "FAC-102", "name": "Prof. Ravi Shankar", "email": "ravi@institution.edu", "role": "FACULTY", "dept": "CSE", "desig": "Assistant Professor", "exempt": False, "eligible": True, "exp": ["CS101", "CS104"]},
            {"id": "FAC-103", "name": "Prof. Ahmed Khan", "email": "ahmed@institution.edu", "role": "FACULTY", "dept": "CSE", "desig": "Assistant Professor", "exempt": False, "eligible": True, "exp": ["CS102", "CS103"]},
            {"id": "FAC-104", "name": "Prof. Priya Nair", "email": "priya@institution.edu", "role": "FACULTY", "dept": "CSE", "desig": "Assistant Professor", "exempt": False, "eligible": True, "exp": ["CS104", "CS105"]},
            {"id": "FAC-105", "name": "Prof. Sneha Reddy", "email": "sneha@institution.edu", "role": "FACULTY", "dept": "CSE", "desig": "Assistant Professor", "exempt": False, "eligible": True, "exp": ["CS101", "CS102"]},
            {"id": "FAC-106", "name": "Prof. Deepak Joshi", "email": "deepak@institution.edu", "role": "FACULTY", "dept": "CSE", "desig": "Assistant Professor", "exempt": False, "eligible": True, "exp": ["CS103", "CS104"]},
            # ECE Faculty
            {"id": "FAC-201", "name": "Prof. Karthik Iyer", "email": "karthik@institution.edu", "role": "FACULTY", "dept": "ECE", "desig": "Associate Professor", "exempt": False, "eligible": True, "exp": ["EC201", "EC203"]},
            {"id": "FAC-202", "name": "Prof. Neha Deshmukh", "email": "neha@institution.edu", "role": "FACULTY", "dept": "ECE", "desig": "Assistant Professor", "exempt": False, "eligible": True, "exp": ["EC202", "EC204"]},
            {"id": "FAC-203", "name": "Prof. Manoj Pandey", "email": "manoj@institution.edu", "role": "FACULTY", "dept": "ECE", "desig": "Assistant Professor", "exempt": False, "eligible": True, "exp": ["EC201", "EC202"]},
            {"id": "FAC-204", "name": "Prof. Divya Menon", "email": "divya@institution.edu", "role": "FACULTY", "dept": "ECE", "desig": "Assistant Professor", "exempt": False, "eligible": True, "exp": ["EC203", "EC204"]},
            {"id": "FAC-205", "name": "Prof. Vivek Roy", "email": "vivek@institution.edu", "role": "FACULTY", "dept": "ECE", "desig": "Assistant Professor", "exempt": False, "eligible": True, "exp": ["EC201", "EC204"]},
            # MECH Faculty
            {"id": "FAC-301", "name": "Prof. Rohan Patil", "email": "rohan@institution.edu", "role": "FACULTY", "dept": "MECH", "desig": "Associate Professor", "exempt": False, "eligible": True, "exp": ["ME301", "ME302"]},
            {"id": "FAC-302", "name": "Prof. Ananya Sen", "email": "ananya@institution.edu", "role": "FACULTY", "dept": "MECH", "desig": "Assistant Professor", "exempt": False, "eligible": True, "exp": ["ME302", "ME303"]},
            {"id": "FAC-303", "name": "Prof. Amit Saxena", "email": "amit@institution.edu", "role": "FACULTY", "dept": "MECH", "desig": "Assistant Professor", "exempt": False, "eligible": True, "exp": ["ME301", "ME303"]},
            {"id": "FAC-304", "name": "Prof. Kavita Rao", "email": "kavita@institution.edu", "role": "FACULTY", "dept": "MECH", "desig": "Assistant Professor", "exempt": False, "eligible": True, "exp": ["ME302", "ME303"]},
            # MATH Faculty
            {"id": "FAC-401", "name": "Prof. Pooja Agarwal", "email": "pooja@institution.edu", "role": "FACULTY", "dept": "MATH", "desig": "Professor", "exempt": False, "eligible": True, "exp": ["MA101", "MA102"]},
            {"id": "FAC-402", "name": "Prof. Suresh Nambiar", "email": "suresh@institution.edu", "role": "FACULTY", "dept": "MATH", "desig": "Associate Professor", "exempt": False, "eligible": True, "exp": ["MA101"]},
            {"id": "FAC-403", "name": "Prof. Geeta Trivedi", "email": "geeta@institution.edu", "role": "FACULTY", "dept": "MATH", "desig": "Assistant Professor", "exempt": False, "eligible": True, "exp": ["MA102"]},
            {"id": "FAC-404", "name": "Prof. Tarun Chawla", "email": "tarun@institution.edu", "role": "FACULTY", "dept": "MATH", "desig": "Assistant Professor", "exempt": False, "eligible": True, "exp": ["MA101", "MA102"]}
        ]

        default_pw_hash = get_password_hash("password123")
        faculty_obj_map = {}

        for f_dict in faculty_definitions:
            user = User(
                email=f_dict["email"],
                hashed_password=default_pw_hash,
                full_name=f_dict["name"],
                role_id=roles_map[f_dict["role"]].id,
                is_active=True
            )
            db.add(user)
            db.flush()

            faculty = Faculty(
                faculty_id=f_dict["id"],
                user_id=user.id,
                name=f_dict["name"],
                email=f_dict["email"],
                phone="+91 98765 43210",
                department_id=dept_map[f_dict["dept"]].id,
                designation=f_dict["desig"],
                role_id=roles_map[f_dict["role"]].id,
                is_substitution_eligible=f_dict["eligible"],
                is_exempt=f_dict["exempt"],
                max_weekly_substitutions=4,
                subject_expertise=f_dict["exp"],
                status="ACTIVE"
            )
            db.add(faculty)
            db.flush()
            faculty_obj_map[f_dict["id"]] = faculty

        # 6. TIMETABLE VERSION
        version = TimetableVersion(
            name="2026 Semester 1 - Active",
            academic_year="2026",
            semester=1,
            is_active=True,
            created_by="Administrator"
        )
        db.add(version)
        db.flush()

        # 7. REGULAR TIMETABLE ENTRIES (Mon-Fri, days 0-4)
        # Timeslots:
        # P1: 09:00 - 10:00
        # P2: 10:00 - 11:00
        # P3: 11:15 - 12:15
        # P4: 12:15 - 13:15
        # P5: 14:00 - 15:00
        # P6: 15:00 - 16:00

        # We configure regular schedules intentionally to support all rule test scenarios:
        # E.g.
        # Mon P2 (10:00-11:00): Prof. Kumar (FAC-101) teaches CSE-A (CS101) in Room-101
        # Mon P2: Prof. Ravi (FAC-102) is FREE (has 1 class on Monday)
        # Mon P2: Prof. Ahmed (FAC-103) is FREE (has 2 classes on Monday)
        # Mon P2: Prof. Sneha (FAC-105) has 3 classes on Monday (P1, P3, P5) -> tests Rule 2 rejection!
        # Prof. Priya (FAC-104) has 4 substitutions pre-seeded this week -> tests Rule 3 rejection!
        # Dr. Sunita Rao (FAC-002) is HOD/Exempt -> tests Rule 4 rejection!

        timetable_records = [
            # MONDAY (day 0)
            # CSE-A
            {"day": 0, "start": "09:00", "end": "10:00", "fac": "FAC-401", "class": "CSE-A", "sub": "MA101", "room": "R-101"},
            {"day": 0, "start": "10:00", "end": "11:00", "fac": "FAC-101", "class": "CSE-A", "sub": "CS101", "room": "R-101"}, # Kumar's class
            {"day": 0, "start": "11:15", "end": "12:15", "fac": "FAC-103", "class": "CSE-A", "sub": "CS102", "room": "R-101"},
            {"day": 0, "start": "14:00", "end": "15:00", "fac": "FAC-104", "class": "CSE-A", "sub": "CS104", "room": "R-101"},
            # CSE-B
            {"day": 0, "start": "09:00", "end": "10:00", "fac": "FAC-105", "class": "CSE-B", "sub": "CS101", "room": "R-102"},
            {"day": 0, "start": "10:00", "end": "11:00", "fac": "FAC-106", "class": "CSE-B", "sub": "CS103", "room": "R-102"},
            {"day": 0, "start": "11:15", "end": "12:15", "fac": "FAC-105", "class": "CSE-B", "sub": "CS102", "room": "R-102"},
            {"day": 0, "start": "14:00", "end": "15:00", "fac": "FAC-103", "class": "CSE-B", "sub": "CS103", "room": "R-102"},
            {"day": 0, "start": "15:00", "end": "16:00", "fac": "FAC-105", "class": "CSE-B", "sub": "CS105", "room": "R-102"}, # Sneha's 3rd class on Monday!
            # ECE-A
            {"day": 0, "start": "09:00", "end": "10:00", "fac": "FAC-201", "class": "ECE-A", "sub": "EC201", "room": "R-201"},
            {"day": 0, "start": "10:00", "end": "11:00", "fac": "FAC-202", "class": "ECE-A", "sub": "EC202", "room": "R-201"},
            {"day": 0, "start": "11:15", "end": "12:15", "fac": "FAC-203", "class": "ECE-A", "sub": "EC201", "room": "R-201"},
            {"day": 0, "start": "14:00", "end": "15:00", "fac": "FAC-204", "class": "ECE-A", "sub": "EC203", "room": "R-201"},
            # MECH-A
            {"day": 0, "start": "09:00", "end": "10:00", "fac": "FAC-301", "class": "MECH-A", "sub": "ME301", "room": "R-301"},
            {"day": 0, "start": "10:00", "end": "11:00", "fac": "FAC-302", "class": "MECH-A", "sub": "ME302", "room": "R-301"},
            {"day": 0, "start": "11:15", "end": "12:15", "fac": "FAC-303", "class": "MECH-A", "sub": "ME303", "room": "R-301"},
            # TUESDAY (day 1)
            {"day": 1, "start": "09:00", "end": "10:00", "fac": "FAC-101", "class": "CSE-A", "sub": "CS101", "room": "R-101"},
            {"day": 1, "start": "10:00", "end": "11:00", "fac": "FAC-102", "class": "CSE-A", "sub": "CS104", "room": "R-101"},
            {"day": 1, "start": "11:15", "end": "12:15", "fac": "FAC-103", "class": "CSE-A", "sub": "CS103", "room": "R-101"},
            {"day": 1, "start": "14:00", "end": "15:00", "fac": "FAC-402", "class": "CSE-A", "sub": "MA102", "room": "R-101"},
            # WEDNESDAY (day 2)
            {"day": 2, "start": "09:00", "end": "10:00", "fac": "FAC-101", "class": "CSE-A", "sub": "CS101", "room": "R-101"},
            {"day": 2, "start": "10:00", "end": "11:00", "fac": "FAC-104", "class": "CSE-A", "sub": "CS105", "room": "R-101"},
            {"day": 2, "start": "11:15", "end": "12:15", "fac": "FAC-102", "class": "CSE-B", "sub": "CS104", "room": "R-102"},
            {"day": 2, "start": "14:00", "end": "15:00", "fac": "FAC-106", "class": "CSE-B", "sub": "CS103", "room": "R-102"},
            # THURSDAY (day 3)
            {"day": 3, "start": "09:00", "end": "10:00", "fac": "FAC-101", "class": "CSE-B", "sub": "CS101", "room": "R-102"},
            {"day": 3, "start": "10:00", "end": "11:00", "fac": "FAC-103", "class": "CSE-B", "sub": "CS102", "room": "R-102"},
            {"day": 3, "start": "11:15", "end": "12:15", "fac": "FAC-105", "class": "CSE-A", "sub": "CS102", "room": "R-101"},
            {"day": 3, "start": "14:00", "end": "15:00", "fac": "FAC-102", "class": "CSE-A", "sub": "CS104", "room": "R-101"},
            # FRIDAY (day 4)
            {"day": 4, "start": "09:00", "end": "10:00", "fac": "FAC-101", "class": "CSE-A", "sub": "CS101", "room": "R-101"},
            {"day": 4, "start": "10:00", "end": "11:00", "fac": "FAC-102", "class": "CSE-B", "sub": "CS104", "room": "R-102"},
            {"day": 4, "start": "11:15", "end": "12:15", "fac": "FAC-106", "class": "CSE-A", "sub": "CS103", "room": "R-101"},
            {"day": 4, "start": "14:00", "end": "15:00", "fac": "FAC-401", "class": "CSE-B", "sub": "MA101", "room": "R-102"}
        ]

        for tr in timetable_records:
            entry = TimetableEntry(
                timetable_version_id=version.id,
                faculty_id=faculty_obj_map[tr["fac"]].id,
                class_section_id=class_map[tr["class"]].id,
                subject_id=subject_map[tr["sub"]].id,
                day_of_week=tr["day"],
                start_time=tr["start"],
                end_time=tr["end"],
                room_number=tr["room"]
            )
            db.add(entry)

        # 8. SYSTEM RULES (Configurable non-negotiable defaults)
        system_rules = [
            {"rule_key": "MAX_WEEKLY_SUBSTITUTIONS", "rule_name": "Maximum Weekly Substitution Limit", "rule_value": "4", "data_type": "integer", "description": "Maximum automatic substitutions a faculty member can receive per week (Mon-Sun)."},
            {"rule_key": "MAX_DAILY_REGULAR_CLASSES", "rule_name": "Daily Regular Class Threshold for Eligibility", "rule_value": "2", "data_type": "integer", "description": "If a faculty member has 3 or more regular classes on a day, they must not be assigned a substitution (Max eligible regular classes = 2)."},
            {"rule_key": "WEEK_START_DAY", "rule_name": "Week Start Day", "rule_value": "0", "data_type": "integer", "description": "0 = Monday, 6 = Sunday."},
            {"rule_key": "INSTITUTION_NAME", "rule_name": "Institution Name", "rule_value": "Apex Institute of Engineering & Technology", "data_type": "string", "description": "Display name of the academic institution."}
        ]
        for sr in system_rules:
            db.add(SystemRule(**sr))

        # 9. PRE-SEED TEST SUBSTITUTION DUTIES
        # Give Prof. Priya (FAC-104) 4 prior substitutions this week to test Rule 3 limit!
        # Give Prof. Deepak (FAC-106) 2 substitutions this week
        today = date.today()
        # Find Monday of this week
        mon_this_week = today - timedelta(days=today.weekday())

        priya_fac = faculty_obj_map["FAC-104"]
        deepak_fac = faculty_obj_map["FAC-106"]

        # Create 4 dummy past duties for Priya
        for i in range(4):
            past_date = mon_this_week + timedelta(days=i % 5)
            # Create a dummy requirement
            req = SubstitutionRequirement(
                absence_id=1,  # dummy reference
                date=past_date,
                day_of_week=past_date.weekday(),
                period_start="15:00",
                period_end="16:00",
                class_section_id=class_map["CSE-C"].id,
                subject_id=subject_map["CS105"].id,
                original_faculty_id=faculty_obj_map["FAC-101"].id,
                status="ALLOCATED"
            )
            # Don't add to DB without actual absence, or add dummy absence first
        
        # Create an initial confirmed Absence for Prof. Kumar on Monday to show immediate active data
        dummy_absence = Absence(
            faculty_id=faculty_obj_map["FAC-101"].id,
            date=mon_this_week,
            start_time="00:00",
            end_time="23:59",
            is_full_day=True,
            reason="Attending National Academic Conference on AI",
            status="CONFIRMED",
            reported_by="Admin"
        )
        db.add(dummy_absence)
        db.flush()

        # Add Priya's 4 pre-seeded duties linked to this or prior absences
        for i in range(4):
            p_date = mon_this_week + timedelta(days=min(i, 4))
            p_req = SubstitutionRequirement(
                absence_id=dummy_absence.id,
                date=p_date,
                day_of_week=p_date.weekday(),
                period_start="16:00",
                period_end="17:00",
                class_section_id=class_map["CSE-C"].id,
                subject_id=subject_map["CS105"].id,
                original_faculty_id=faculty_obj_map["FAC-101"].id,
                status="ALLOCATED"
            )
            db.add(p_req)
            db.flush()

            duty = SubstitutionDuty(
                requirement_id=p_req.id,
                date=p_date,
                day_of_week=p_date.weekday(),
                period_start="16:00",
                period_end="17:00",
                class_section_id=class_map["CSE-C"].id,
                subject_id=subject_map["CS105"].id,
                original_faculty_id=faculty_obj_map["FAC-101"].id,
                assigned_faculty_id=priya_fac.id,
                allocation_method="AUTOMATIC",
                status="COMPLETED",
                weekly_count_at_assignment=i,
                daily_classes_at_assignment=1,
                allocation_reason="Lowest eligible weekly duty count."
            )
            db.add(duty)

        # Pre-seed 1 duty for Deepak
        d_req = SubstitutionRequirement(
            absence_id=dummy_absence.id,
            date=mon_this_week,
            day_of_week=0,
            period_start="12:15",
            period_end="13:15",
            class_section_id=class_map["CSE-B"].id,
            subject_id=subject_map["CS103"].id,
            original_faculty_id=faculty_obj_map["FAC-101"].id,
            status="ALLOCATED"
        )
        db.add(d_req)
        db.flush()

        d_duty = SubstitutionDuty(
            requirement_id=d_req.id,
            date=mon_this_week,
            day_of_week=0,
            period_start="12:15",
            period_end="13:15",
            class_section_id=class_map["CSE-B"].id,
            subject_id=subject_map["CS103"].id,
            original_faculty_id=faculty_obj_map["FAC-101"].id,
            assigned_faculty_id=deepak_fac.id,
            allocation_method="AUTOMATIC",
            status="SCHEDULED",
            weekly_count_at_assignment=0,
            daily_classes_at_assignment=1,
            allocation_reason="Free during period, lowest weekly substitution count."
        )
        db.add(d_duty)

        # Audit record
        audit = AuditLog(
            event_type="SYSTEM_INITIALIZED",
            actor_name="System Seeder",
            target_type="SYSTEM",
            details={"message": "Initial institutional seed data loaded successfully."}
        )
        db.add(audit)

        db.commit()
        print("Database seeded successfully with 25+ faculty, roles, subjects, and timetables!")

    except Exception as e:
        db.rollback()
        print(f"Error seeding database: {e}")
        raise e
    finally:
        if close_db_at_end:
            db.close()

if __name__ == "__main__":
    seed_database()
