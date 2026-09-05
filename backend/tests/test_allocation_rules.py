import pytest
from datetime import date, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.session import Base
from app.models.entities import (
    Role, User, Department, Subject, ClassSection, Faculty,
    TimetableVersion, TimetableEntry, Absence, SubstitutionRequirement,
    SubstitutionDuty, SystemRule, AuditLog
)
from app.allocation.constraints import (
    check_rule_1_free_period, check_rule_2_daily_class_limit,
    check_rule_3_weekly_substitution_limit, check_rule_4_exempt,
    check_rule_5_absent, check_rule_6_no_double_booking
)
from app.allocation.engine import (
    evaluate_candidates_for_requirement, generate_allocation
)
from app.allocation.multi_allocator import batch_allocate_requirements
from app.services.absence_service import create_faculty_absence

# In-memory test database for clean isolated runs
TEST_DATABASE_URL = "sqlite:///:memory:"
engine_test = create_engine(TEST_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine_test)

@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine_test)
    session = TestingSessionLocal()
    
    # Setup baseline data
    role_admin = Role(name="ADMIN", is_default_exempt=True, is_default_eligible=False)
    role_faculty = Role(name="FACULTY", is_default_exempt=False, is_default_eligible=True)
    role_dean = Role(name="DEAN", is_default_exempt=True, is_default_eligible=False)
    session.add_all([role_admin, role_faculty, role_dean])
    session.flush()

    dept = Department(code="CSE", name="Computer Science")
    session.add(dept)
    session.flush()

    subj1 = Subject(code="CS101", name="Data Structures", department_id=dept.id)
    subj2 = Subject(code="CS102", name="Operating Systems", department_id=dept.id)
    session.add_all([subj1, subj2])
    session.flush()

    sec_a = ClassSection(name="CSE-A", department_id=dept.id)
    sec_b = ClassSection(name="CSE-B", department_id=dept.id)
    session.add_all([sec_a, sec_b])
    session.flush()

    # Faculty definitions
    # Fac 1: Absent faculty
    f1 = Faculty(faculty_id="FAC-01", name="Prof. Kumar", email="kumar@test.edu", department_id=dept.id, role_id=role_faculty.id, is_substitution_eligible=True, is_exempt=False)
    # Fac 2: Eligible, 0 substitutions, 1 regular class
    f2 = Faculty(faculty_id="FAC-02", name="Prof. Ravi", email="ravi@test.edu", department_id=dept.id, role_id=role_faculty.id, is_substitution_eligible=True, is_exempt=False)
    # Fac 3: Eligible, 2 substitutions, 1 regular class
    f3 = Faculty(faculty_id="FAC-03", name="Prof. Ahmed", email="ahmed@test.edu", department_id=dept.id, role_id=role_faculty.id, is_substitution_eligible=True, is_exempt=False)
    # Fac 4: 3 regular classes today (Rule 2 check)
    f4 = Faculty(faculty_id="FAC-04", name="Prof. Sneha", email="sneha@test.edu", department_id=dept.id, role_id=role_faculty.id, is_substitution_eligible=True, is_exempt=False)
    # Fac 5: 4 substitutions this week (Rule 3 check)
    f5 = Faculty(faculty_id="FAC-05", name="Prof. Priya", email="priya@test.edu", department_id=dept.id, role_id=role_faculty.id, is_substitution_eligible=True, is_exempt=False)
    # Fac 6: Exempt faculty (Dean) (Rule 4 check)
    f6 = Faculty(faculty_id="FAC-06", name="Dr. Vikram (Dean)", email="dean@test.edu", department_id=dept.id, role_id=role_dean.id, is_substitution_eligible=False, is_exempt=True)
    # Fac 7: Has conflicting class during 10:00-11:00 (Rule 1 check)
    f7 = Faculty(faculty_id="FAC-07", name="Prof. Manoj", email="manoj@test.edu", department_id=dept.id, role_id=role_faculty.id, is_substitution_eligible=True, is_exempt=False)
    
    session.add_all([f1, f2, f3, f4, f5, f6, f7])
    session.flush()

    # Active Timetable Version
    v = TimetableVersion(name="2026 Test Version", is_active=True)
    session.add(v)
    session.flush()

    # Monday Timetables (day 0)
    # Target period: 10:00 - 11:00 (Kumar teaches CSE-A)
    session.add(TimetableEntry(timetable_version_id=v.id, faculty_id=f1.id, class_section_id=sec_a.id, subject_id=subj1.id, day_of_week=0, start_time="10:00", end_time="11:00"))
    # Ravi has 1 class on Monday at 09:00-10:00
    session.add(TimetableEntry(timetable_version_id=v.id, faculty_id=f2.id, class_section_id=sec_b.id, subject_id=subj2.id, day_of_week=0, start_time="09:00", end_time="10:00"))
    # Ahmed has 1 class on Monday at 14:00-15:00
    session.add(TimetableEntry(timetable_version_id=v.id, faculty_id=f3.id, class_section_id=sec_a.id, subject_id=subj1.id, day_of_week=0, start_time="14:00", end_time="15:00"))
    # Sneha has 3 classes on Monday (09:00-10:00, 11:15-12:15, 14:00-15:00)
    session.add(TimetableEntry(timetable_version_id=v.id, faculty_id=f4.id, class_section_id=sec_a.id, subject_id=subj1.id, day_of_week=0, start_time="09:00", end_time="10:00"))
    session.add(TimetableEntry(timetable_version_id=v.id, faculty_id=f4.id, class_section_id=sec_b.id, subject_id=subj2.id, day_of_week=0, start_time="11:15", end_time="12:15"))
    session.add(TimetableEntry(timetable_version_id=v.id, faculty_id=f4.id, class_section_id=sec_a.id, subject_id=subj1.id, day_of_week=0, start_time="14:00", end_time="15:00"))
    # Manoj has conflicting class at 10:00-11:00 on Monday
    session.add(TimetableEntry(timetable_version_id=v.id, faculty_id=f7.id, class_section_id=sec_b.id, subject_id=subj2.id, day_of_week=0, start_time="10:00", end_time="11:00"))

    session.commit()
    yield session
    session.close()
    Base.metadata.drop_all(bind=engine_test)

# Scenario 1: One absent faculty -> one valid substitute
def test_scenario_1_single_absence_allocation(db):
    f1 = db.query(Faculty).filter(Faculty.faculty_id == "FAC-01").first()
    target_date = date(2026, 9, 7) # Monday
    
    res = create_faculty_absence(db, f1.id, target_date, reason="Medical Leave", auto_allocate=True)
    assert res["success"] is True
    assert res["affected_classes_count"] == 1
    assert len(res["allocation_results"]) == 1
    alloc = res["allocation_results"][0]
    assert alloc["status"] == "ALLOCATED"
    assert alloc["selected_faculty"] is not None

# Scenario 2: Candidate with lowest weekly count selected (Rule 7)
def test_scenario_2_fairness_lowest_weekly_count(db):
    f1 = db.query(Faculty).filter(Faculty.faculty_id == "FAC-01").first() # Kumar (absent)
    f2 = db.query(Faculty).filter(Faculty.faculty_id == "FAC-02").first() # Ravi (0 duties)
    f3 = db.query(Faculty).filter(Faculty.faculty_id == "FAC-03").first() # Ahmed (2 duties)
    f5 = db.query(Faculty).filter(Faculty.faculty_id == "FAC-05").first() # Priya
    target_date = date(2026, 9, 7) # Monday

    # Seed 4 duties for f5 so f5 is disqualified
    for i in range(4):
        dummy_req5 = SubstitutionRequirement(
            absence_id=1, date=target_date, day_of_week=0, period_start=f"1{i}:00", period_end=f"1{i+1}:00",
            class_section_id=1, subject_id=1, original_faculty_id=f1.id, status="ALLOCATED"
        )
        db.add(dummy_req5)
        db.flush()
        db.add(SubstitutionDuty(
            requirement_id=dummy_req5.id, date=target_date, day_of_week=0, period_start=f"1{i}:00", period_end=f"1{i+1}:00",
            class_section_id=1, subject_id=1, original_faculty_id=f1.id, assigned_faculty_id=f5.id, status="COMPLETED"
        ))

    # Seed 2 duties for f3 this week
    for i in range(2):
        dummy_req = SubstitutionRequirement(
            absence_id=1, date=target_date, day_of_week=0, period_start=f"1{i}:00", period_end=f"1{i+1}:00",
            class_section_id=1, subject_id=1, original_faculty_id=f1.id, status="ALLOCATED"
        )
        db.add(dummy_req)
        db.flush()
        db.add(SubstitutionDuty(
            requirement_id=dummy_req.id, date=target_date, day_of_week=0, period_start=f"1{i}:00", period_end=f"1{i+1}:00",
            class_section_id=1, subject_id=1, original_faculty_id=f1.id, assigned_faculty_id=f3.id, status="COMPLETED"
        ))
    db.commit()

    # Now create absence for Kumar and allocate
    res = create_faculty_absence(db, f1.id, target_date, auto_allocate=True)
    alloc = res["allocation_results"][0]
    # Ravi (f2) has 0 duties, Ahmed (f3) has 2 duties, Priya (f5) has 4 duties -> Ravi must be selected!
    assert alloc["selected_faculty"]["id"] == f2.id
    assert alloc["selected_faculty"]["weekly_substitutions"] == 0


# Scenario 3: Candidate has 3 regular classes today -> Rejected (Rule 2)
def test_scenario_3_rule_2_daily_3_class_limit(db):
    f4 = db.query(Faculty).filter(Faculty.faculty_id == "FAC-04").first()
    ok, count, reason = check_rule_2_daily_class_limit(db, 1, f4.id, 0, max_daily_classes=2)
    assert ok is False
    assert count == 3
    assert "maximum allowed" in reason

# Scenario 4: Candidate has 4 substitutions this week -> Rejected (Rule 3)
def test_scenario_4_rule_3_weekly_4_substitution_limit(db):
    f5 = db.query(Faculty).filter(Faculty.faculty_id == "FAC-05").first()
    target_date = date(2026, 9, 7)
    # Seed 4 duties for f5
    for i in range(4):
        dummy_req = SubstitutionRequirement(
            absence_id=1, date=target_date, day_of_week=0, period_start=f"1{i}:00", period_end=f"1{i+1}:00",
            class_section_id=1, subject_id=1, original_faculty_id=1, status="ALLOCATED"
        )
        db.add(dummy_req)
        db.flush()
        db.add(SubstitutionDuty(
            requirement_id=dummy_req.id, date=target_date, day_of_week=0, period_start=f"1{i}:00", period_end=f"1{i+1}:00",
            class_section_id=1, subject_id=1, original_faculty_id=1, assigned_faculty_id=f5.id, status="COMPLETED"
        ))
    db.commit()

    ok, count, reason = check_rule_3_weekly_substitution_limit(db, f5.id, target_date, max_weekly_substitutions=4)
    assert ok is False
    assert count == 4
    assert "Reached weekly limit" in reason

# Scenario 5: Candidate has regular class during period -> Rejected (Rule 1)
def test_scenario_5_rule_1_regular_class_conflict(db):
    f7 = db.query(Faculty).filter(Faculty.faculty_id == "FAC-07").first()
    ok, reason = check_rule_1_free_period(db, 1, f7.id, 0, "10:00", "11:00")
    assert ok is False
    assert "Regular class conflict" in reason

# Scenario 6: Candidate is exempt -> Rejected (Rule 4)
def test_scenario_6_rule_4_exempt_faculty(db):
    f6 = db.query(Faculty).filter(Faculty.faculty_id == "FAC-06").first()
    ok, reason = check_rule_4_exempt(f6)
    assert ok is False
    assert "exempt from substitution" in reason

# Scenario 7: Candidate is absent -> Rejected (Rule 5)
def test_scenario_7_rule_5_absent_faculty(db):
    f2 = db.query(Faculty).filter(Faculty.faculty_id == "FAC-02").first()
    target_date = date(2026, 9, 7)
    # Mark Ravi absent
    db.add(Absence(faculty_id=f2.id, date=target_date, is_full_day=True, status="CONFIRMED"))
    db.commit()

    ok, reason = check_rule_5_absent(db, f2.id, target_date, "10:00", "11:00")
    assert ok is False
    assert "marked absent" in reason

# Scenario 8: Candidate already has substitution duty -> Rejected (Rule 6)
def test_scenario_8_rule_6_double_booking(db):
    f2 = db.query(Faculty).filter(Faculty.faculty_id == "FAC-02").first()
    target_date = date(2026, 9, 7)
    # Give Ravi an existing duty at 10:00-11:00
    dummy_req = SubstitutionRequirement(
        absence_id=1, date=target_date, day_of_week=0, period_start="10:00", period_end="11:00",
        class_section_id=1, subject_id=1, original_faculty_id=1, status="ALLOCATED"
    )
    db.add(dummy_req)
    db.flush()
    db.add(SubstitutionDuty(
        requirement_id=dummy_req.id, date=target_date, day_of_week=0, period_start="10:00", period_end="11:00",
        class_section_id=1, subject_id=1, original_faculty_id=1, assigned_faculty_id=f2.id, status="SCHEDULED"
    ))
    db.commit()

    ok, reason = check_rule_6_no_double_booking(db, f2.id, target_date, "10:00", "11:00")
    assert ok is False
    assert "Already assigned substitution" in reason

# Scenario 9: No eligible faculty available -> Marked UNALLOCATED
def test_scenario_9_unallocated_when_no_candidates(db):
    # Disable all other faculty
    db.query(Faculty).filter(Faculty.faculty_id != "FAC-01").update({"status": "INACTIVE"})
    db.commit()

    f1 = db.query(Faculty).filter(Faculty.faculty_id == "FAC-01").first()
    target_date = date(2026, 9, 7)
    res = create_faculty_absence(db, f1.id, target_date, auto_allocate=True)
    alloc = res["allocation_results"][0]
    assert alloc["status"] == "UNALLOCATED"
    assert "No eligible faculty available" in alloc["explanation"]

# Scenario 10: Multiple simultaneous absences batch allocation
def test_scenario_10_multiple_simultaneous_absences(db):
    f1 = db.query(Faculty).filter(Faculty.faculty_id == "FAC-01").first()
    target_date = date(2026, 9, 7)
    
    # Create requirement 1
    req1 = SubstitutionRequirement(absence_id=1, date=target_date, day_of_week=0, period_start="10:00", period_end="11:00", class_section_id=1, subject_id=1, original_faculty_id=f1.id, status="PENDING")
    # Create requirement 2
    req2 = SubstitutionRequirement(absence_id=1, date=target_date, day_of_week=0, period_start="14:00", period_end="15:00", class_section_id=1, subject_id=1, original_faculty_id=f1.id, status="PENDING")
    db.add_all([req1, req2])
    db.commit()

    batch_res = batch_allocate_requirements(db, [req1.id, req2.id])
    assert batch_res["total_processed"] == 2
    assert batch_res["allocated_count"] == 2
