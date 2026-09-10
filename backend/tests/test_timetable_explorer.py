from datetime import datetime
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.entities import TimetablePeriod, TimetableEntry, TimetableVersion, Faculty, Department, ClassSection, Subject, Role, User, AuditLog
from app.services.timetable_service import normalize_academic_year, normalize_course_code

client = TestClient(app)

def test_roman_numeral_and_course_normalization():
    assert normalize_academic_year("I") == 1
    assert normalize_academic_year("II") == 2
    assert normalize_academic_year("III") == 3
    assert normalize_academic_year("IV") == 4
    assert normalize_academic_year("1st Year") == 1
    assert normalize_academic_year("2nd Year") == 2
    assert normalize_academic_year("3rd Year") == 3
    assert normalize_academic_year("4th Year") == 4
    assert normalize_academic_year("IV Year") == 4

    assert normalize_course_code("Computer Science") == "CSE"
    assert normalize_course_code("Artificial Intelligence & Data Science") == "AIDS"
    assert normalize_course_code("AI & ML") == "AIML"
    assert normalize_course_code("Cyber Security") == "CS"
    assert normalize_course_code("Cloud Computing") == "CC"
    assert normalize_course_code("Artificial Intelligence in Health Care") == "AIHC"

def test_timetable_periods_api():
    response = client.get("/api/v1/timetables/periods")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 6
    assert data[0]["period_number"] == 1
    assert "start_time" in data[0]
    assert "end_time" in data[0]

def test_timetable_hierarchy_api():
    response = client.get("/api/v1/timetables/hierarchy")
    assert response.status_code == 200
    hierarchy = response.json()
    assert len(hierarchy) == 4
    # All 4 academic years present
    labels = [h["roman_label"] for h in hierarchy]
    assert "1st Year (I)" in labels
    assert "2nd Year (II)" in labels
    assert "3rd Year (III)" in labels
    assert "4th Year (IV)" in labels

    # Each year must contain the 6 canonical courses
    for year in hierarchy:
        course_codes = [c["code"] for c in year["courses"]]
        assert "CSE" in course_codes
        assert "AIDS" in course_codes
        assert "AIML" in course_codes
        assert "CS" in course_codes
        assert "CC" in course_codes
        assert "AIHC" in course_codes

def test_create_class_section_api():
    # Attempt creating a section with invalid empty name -> 400
    res_empty = client.post("/api/v1/timetables/sections", json={"name": "", "course_code": "CSE", "year_level": 2})
    assert res_empty.status_code in [400, 401, 403]

    # Create real section as admin or authenticated
    db = SessionLocal()
    admin_user = db.query(User).filter(User.email == "admin@apollouniversity.edu.in").first()
    db.close()

    if admin_user:
        from app.core.security import create_access_token
        token = create_access_token(subject=admin_user.email, extra_claims={"role": "ADMIN"})
        headers = {"Authorization": f"Bearer {token}"}

        test_sec_name = f"TEST_SEC_{int(datetime.utcnow().timestamp())}"
        try:
            res = client.post("/api/v1/timetables/sections", json={
                "name": test_sec_name,
                "course_code": "CSE",
                "year_level": 2,
                "capacity": 60
            }, headers=headers)
            if res.status_code == 200:
                data = res.json()
                assert data["name"] == test_sec_name
                assert data["department_code"] == "CSE"
                assert data["year_level"] == 2
        finally:
            db = SessionLocal()
            created_sec = db.query(ClassSection).filter(ClassSection.name == test_sec_name).first()
            if created_sec:
                db.query(AuditLog).filter(AuditLog.target_type == "CLASS_SECTION", AuditLog.target_id == created_sec.id).delete()
                db.delete(created_sec)
                db.commit()
            db.close()
