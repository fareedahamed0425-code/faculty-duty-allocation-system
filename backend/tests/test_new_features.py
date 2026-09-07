from datetime import date, timedelta
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.db.session import Base
from app.models.entities import (
    Role, User, Department, Subject, ClassSection, Faculty,
    TimetableVersion, TimetableEntry, Absence, SubstitutionRequirement,
    SubstitutionDuty, AcademicHoliday, ExamDuty, Notification
)
from app.services.absence_service import create_faculty_absence, cancel_faculty_absence
from app.api.v1.academic_calendar import get_second_saturday_for_month, is_date_second_saturday, ensure_initial_holidays_seeded

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:", echo=False)
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Seed roles
    role_admin = Role(name="ADMIN", is_default_exempt=True, is_default_eligible=False)
    role_fac = Role(name="FACULTY", is_default_exempt=False, is_default_eligible=True)
    session.add_all([role_admin, role_fac])
    session.flush()

    # Seed dept
    dept = Department(code="CSE", name="Computer Science")
    session.add(dept)
    session.flush()

    # Seed subjects
    s1 = Subject(code="CS101", name="Data Structures", department_id=dept.id)
    s2 = Subject(code="CS102", name="Algorithms", department_id=dept.id)
    session.add_all([s1, s2])
    session.flush()

    # Seed class
    c1 = ClassSection(name="CSE-A", department_id=dept.id, academic_year="2026", semester=1)
    session.add(c1)
    session.flush()

    # Seed users and faculties
    u1 = User(email="f1@test.com", hashed_password="pw", full_name="Dr. Alice", role_id=role_fac.id)
    u2 = User(email="f2@test.com", hashed_password="pw", full_name="Dr. Bob", role_id=role_fac.id)
    session.add_all([u1, u2])
    session.flush()

    f1 = Faculty(faculty_id="FAC001", user_id=u1.id, name="Dr. Alice", email="f1@test.com", department_id=dept.id, is_substitution_eligible=True, is_exempt=False, max_weekly_substitutions=4)
    f2 = Faculty(faculty_id="FAC002", user_id=u2.id, name="Dr. Bob", email="f2@test.com", department_id=dept.id, is_substitution_eligible=True, is_exempt=False, max_weekly_substitutions=4)
    session.add_all([f1, f2])
    session.flush()

    # Seed active timetable version
    tt_ver = TimetableVersion(name="Spring 2026", is_active=True)
    session.add(tt_ver)
    session.flush()

    # Alice has regular classes on Monday (0), Tuesday (1), Wednesday (2) 09:00-10:00
    e1 = TimetableEntry(timetable_version_id=tt_ver.id, faculty_id=f1.id, class_section_id=c1.id, subject_id=s1.id, day_of_week=0, start_time="09:00", end_time="10:00")
    e2 = TimetableEntry(timetable_version_id=tt_ver.id, faculty_id=f1.id, class_section_id=c1.id, subject_id=s1.id, day_of_week=1, start_time="09:00", end_time="10:00")
    e3 = TimetableEntry(timetable_version_id=tt_ver.id, faculty_id=f1.id, class_section_id=c1.id, subject_id=s1.id, day_of_week=2, start_time="09:00", end_time="10:00")
    session.add_all([e1, e2, e3])
    session.commit()

    yield session
    session.close()

def test_advance_multi_day_leave(db_session):
    # Dr. Alice takes a long leave from Mon 2026-09-07 to Wed 2026-09-09
    start_d = date(2026, 9, 7)  # Monday
    end_d = date(2026, 9, 9)    # Wednesday
    fac = db_session.query(Faculty).filter(Faculty.faculty_id == "FAC001").first()

    res = create_faculty_absence(
        db=db_session,
        faculty_id=fac.id,
        absence_date=start_d,
        end_date=end_d,
        leave_type="LONG_LEAVE",
        reason="Attending International Research Conference",
        reported_by="Dr. Alice",
        auto_allocate=True
    )

    assert res["success"] is True
    assert res["affected_classes_count"] == 3
    # Verify substitution duties are generated in advance and assigned to Bob
    duties = db_session.query(SubstitutionDuty).all()
    assert len(duties) == 3
    for d in duties:
        assert d.assigned_faculty_id != fac.id

def test_academic_calendar_second_saturday(db_session):
    # September 2026 2nd Saturday
    sec_sat = get_second_saturday_for_month(2026, 9)
    assert sec_sat == date(2026, 9, 12)
    assert is_date_second_saturday(date(2026, 9, 12)) is True
    assert is_date_second_saturday(date(2026, 9, 5)) is False  # 1st Saturday

    ensure_initial_holidays_seeded(db_session, 2026)
    holidays = db_session.query(AcademicHoliday).filter(AcademicHoliday.academic_year == "2026").all()
    assert len(holidays) >= 20

def test_exam_duty_allocation_and_notification(db_session):
    fac = db_session.query(Faculty).filter(Faculty.faculty_id == "FAC002").first()
    
    duty = ExamDuty(
        exam_name="Mid-Term Examination 2026",
        course_code="CS101",
        course_name="Data Structures & Algorithms",
        date=date(2026, 9, 15),
        reporting_time="08:30 AM",
        exam_start_time="09:00 AM",
        exam_end_time="12:00 PM",
        venue="Exam Hall B-204",
        assigned_faculty_id=fac.id,
        role_type="Room Invigilator",
        allotted_by="Admin",
        status="SCHEDULED"
    )
    db_session.add(duty)
    db_session.flush()

    # Create rich notification
    notif = Notification(
        user_id=fac.user_id,
        title="Exam Duty Allotted",
        message=f"Reporting at 08:30 AM at Exam Hall B-204 for CS101",
        notification_type="EXAM_DUTY_ALLOCATED",
        metadata_json={
            "duty_id": duty.id,
            "exam_name": duty.exam_name,
            "reporting_time": duty.reporting_time,
            "exam_start_time": duty.exam_start_time,
            "venue": duty.venue,
            "role_type": duty.role_type
        }
    )
    db_session.add(notif)
    db_session.commit()

    saved_notif = db_session.query(Notification).filter(Notification.user_id == fac.user_id).first()
    assert saved_notif is not None
    assert saved_notif.metadata_json["venue"] == "Exam Hall B-204"
    assert saved_notif.metadata_json["reporting_time"] == "08:30 AM"
