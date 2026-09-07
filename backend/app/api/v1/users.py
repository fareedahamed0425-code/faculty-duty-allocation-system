from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import get_password_hash, create_access_token
from app.models.entities import User, Role, Faculty, Department, AuditLog
from app.schemas.schemas import UserOut, RoleOut, UserCreate, UserRoleUpdate, UserStatusUpdate, FirebaseSyncRequest, Token
from app.api.deps import get_current_user, require_admin

router = APIRouter()

def user_to_user_out(user: User) -> UserOut:
    faculty_id = None
    faculty_code = None
    department_name = None
    department_id = None
    designation = None
    phone = None
    is_exempt = None
    is_substitution_eligible = None

    if user.faculty_profile:
        faculty_id = user.faculty_profile.id
        faculty_code = user.faculty_profile.faculty_id
        phone = user.faculty_profile.phone
        designation = user.faculty_profile.designation
        is_exempt = user.faculty_profile.is_exempt
        is_substitution_eligible = user.faculty_profile.is_substitution_eligible
        if user.faculty_profile.department:
            department_id = user.faculty_profile.department.id
            department_name = user.faculty_profile.department.name

    role_out = None
    if user.role:
        role_out = RoleOut(
            id=user.role.id,
            name=user.role.name,
            description=user.role.description,
            is_default_exempt=user.role.is_default_exempt,
            is_default_eligible=user.role.is_default_eligible,
            permissions=user.role.permissions or []
        )

    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=role_out,
        is_active=user.is_active,
        faculty_id=faculty_id,
        faculty_code=faculty_code,
        department_name=department_name,
        department_id=department_id,
        designation=designation,
        phone=phone,
        is_exempt=is_exempt,
        is_substitution_eligible=is_substitution_eligible,
        created_at=user.created_at or datetime.utcnow()
    )

@router.get("", response_model=List[UserOut])
def list_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all institutional users registered in the system.
    """
    users = db.query(User).order_by(User.id.asc()).all()
    return [user_to_user_out(u) for u in users]

@router.get("/roles", response_model=List[RoleOut])
def list_available_roles(db: Session = Depends(get_db)):
    """
    List all institutional roles.
    """
    return db.query(Role).order_by(Role.id.asc()).all()

@router.post("", response_model=UserOut)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """
    Admin action: Create a new user with specific role and department.
    """
    clean_email = payload.email.strip().lower()
    existing_user = db.query(User).filter(User.email == clean_email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail=f"User with email '{clean_email}' already exists.")

    role_name = (payload.role_name or "FACULTY").upper()
    role = db.query(Role).filter(Role.name == role_name).first()
    if not role:
        role = db.query(Role).filter(Role.name == "FACULTY").first()

    new_user = User(
        email=clean_email,
        hashed_password=get_password_hash(payload.password or "Apollo@2026"),
        full_name=payload.full_name.strip(),
        role_id=role.id if role else 4,
        is_active=True
    )
    db.add(new_user)
    db.flush()

    # Check department
    dept = None
    if payload.department_id:
        dept = db.query(Department).filter(Department.id == payload.department_id).first()
    if not dept:
        dept = db.query(Department).first()

    # Check if a faculty profile with this email already exists
    existing_faculty = db.query(Faculty).filter(Faculty.email == clean_email).first()
    if existing_faculty:
        existing_faculty.user_id = new_user.id
        existing_faculty.role_id = role.id
        if dept:
            existing_faculty.department_id = dept.id
        if payload.designation:
            existing_faculty.designation = payload.designation
        if payload.phone:
            existing_faculty.phone = payload.phone
    else:
        # Determine designation
        default_desig = "Assistant Professor"
        if role.name == "HOD":
            default_desig = "Head of Department"
        elif role.name == "DEAN":
            default_desig = "Dean of Academic Affairs"
        elif role.name == "ADMIN":
            default_desig = "System Administrator"
        elif role.name == "PC":
            default_desig = "Program Coordinator"
        elif role.name == "COMMITTEE_MEMBER":
            default_desig = "Committee Member"

        # Unique faculty code
        fac_code = f"FAC-{new_user.id:03d}"
        code_exists = db.query(Faculty).filter(Faculty.faculty_id == fac_code).first()
        if code_exists:
            fac_code = f"FAC-{new_user.id:03d}-{int(datetime.utcnow().timestamp()) % 10000}"

        is_exempt_val = role.name in ["ADMIN", "DEAN", "HOD", "PC", "COMMITTEE_MEMBER"]
        new_faculty = Faculty(
            faculty_id=fac_code,
            user_id=new_user.id,
            name=new_user.full_name,
            email=clean_email,
            phone=payload.phone or "+91 98765 00000",
            department_id=dept.id if dept else 1,
            designation=payload.designation or default_desig,
            role_id=role.id,
            is_substitution_eligible=(role.name == "FACULTY"),
            is_exempt=is_exempt_val,
            max_weekly_substitutions=0 if is_exempt_val else 4,
            status="ACTIVE"
        )
        db.add(new_faculty)

    # Log to audit trail
    audit = AuditLog(
        event_type="USER_CREATED",
        actor_id=admin_user.id,
        actor_name=admin_user.full_name,
        target_type="USER",
        target_id=new_user.id,
        details={
            "target_email": new_user.email,
            "role": role.name if role else "FACULTY",
            "department": dept.name if dept else "General"
        }
    )
    db.add(audit)

    db.commit()
    db.refresh(new_user)
    return user_to_user_out(new_user)

@router.patch("/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """
    Admin action: Update a user's role and sync faculty exemption / eligibility flags and department.
    """
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail=f"User #{user_id} not found.")

    role = db.query(Role).filter(Role.name == payload.role_name.upper()).first()
    if not role:
        raise HTTPException(status_code=400, detail=f"Role '{payload.role_name}' is not recognized.")

    old_role_name = target_user.role.name if target_user.role else "NONE"
    target_user.role_id = role.id

    is_leadership = role.name in ["ADMIN", "DEAN", "HOD", "PC", "COMMITTEE_MEMBER"]

    # If linked faculty profile exists, sync its role and eligibility/exemption flags
    faculty = target_user.faculty_profile
    if not faculty:
        # Check if faculty exists by email
        faculty = db.query(Faculty).filter(Faculty.email == target_user.email).first()
        if faculty:
            faculty.user_id = target_user.id

    if faculty:
        faculty.role_id = role.id
        faculty.is_exempt = is_leadership
        faculty.is_substitution_eligible = (role.name == "FACULTY")
        faculty.max_weekly_substitutions = 0 if is_leadership else 4

        if payload.department_id:
            faculty.department_id = payload.department_id

        if payload.designation:
            faculty.designation = payload.designation
        elif role.name == "HOD" and "Head" not in faculty.designation:
            faculty.designation = "Head of Department"
        elif role.name == "DEAN" and "Dean" not in faculty.designation:
            faculty.designation = "Dean of Academic Affairs"
        elif role.name == "ADMIN" and "Admin" not in faculty.designation:
            faculty.designation = "System Administrator"
        elif role.name == "PC":
            faculty.designation = "Program Coordinator"
        elif role.name == "COMMITTEE_MEMBER":
            faculty.designation = "Committee Member"
        elif role.name == "FACULTY" and ("Head" in faculty.designation or "Dean" in faculty.designation or "Admin" in faculty.designation):
            faculty.designation = "Assistant Professor"
    else:
        # Create a linked faculty profile
        default_dept = None
        if payload.department_id:
            default_dept = db.query(Department).filter(Department.id == payload.department_id).first()
        if not default_dept:
            default_dept = db.query(Department).first()

        default_desig = "Assistant Professor"
        if role.name == "HOD":
            default_desig = "Head of Department"
        elif role.name == "DEAN":
            default_desig = "Dean of Academic Affairs"
        elif role.name == "ADMIN":
            default_desig = "System Administrator"
        elif role.name == "PC":
            default_desig = "Program Coordinator"
        elif role.name == "COMMITTEE_MEMBER":
            default_desig = "Committee Member"

        fac_code = f"FAC-{target_user.id:03d}"
        code_exists = db.query(Faculty).filter(Faculty.faculty_id == fac_code).first()
        if code_exists:
            fac_code = f"FAC-{target_user.id:03d}-{int(datetime.utcnow().timestamp()) % 10000}"

        new_faculty = Faculty(
            faculty_id=fac_code,
            user_id=target_user.id,
            name=target_user.full_name,
            email=target_user.email,
            phone="+91 98765 00000",
            department_id=default_dept.id if default_dept else 1,
            designation=payload.designation or default_desig,
            role_id=role.id,
            is_substitution_eligible=(role.name == "FACULTY"),
            is_exempt=is_leadership,
            max_weekly_substitutions=0 if is_leadership else 4,
            status="ACTIVE"
        )
        db.add(new_faculty)

    # Log to audit trail
    audit = AuditLog(
        event_type="USER_ROLE_UPDATED",
        actor_id=admin_user.id,
        actor_name=admin_user.full_name,
        target_type="USER",
        target_id=target_user.id,
        details={
            "target_email": target_user.email,
            "old_role": old_role_name,
            "new_role": role.name
        }
    )
    db.add(audit)

    db.commit()
    db.refresh(target_user)
    return user_to_user_out(target_user)

@router.patch("/{user_id}/status", response_model=UserOut)
def toggle_user_status(
    user_id: int,
    payload: UserStatusUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """
    Admin action: Activate or deactivate a user account.
    """
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail=f"User #{user_id} not found.")

    if target_user.id == admin_user.id and not payload.is_active:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own administrator account.")

    target_user.is_active = payload.is_active

    if target_user.faculty_profile:
        target_user.faculty_profile.status = "ACTIVE" if payload.is_active else "INACTIVE"

    audit = AuditLog(
        event_type="USER_STATUS_UPDATED",
        actor_id=admin_user.id,
        actor_name=admin_user.full_name,
        target_type="USER",
        target_id=target_user.id,
        details={
            "target_email": target_user.email,
            "is_active": payload.is_active
        }
    )
    db.add(audit)

    db.commit()
    db.refresh(target_user)
    return user_to_user_out(target_user)

@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """
    Admin action: Delete a user account from the system.
    """
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail=f"User #{user_id} not found.")

    if target_user.id == admin_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own administrator account.")

    user_email = target_user.email
    user_name = target_user.full_name

    # Unlink faculty profile if exists rather than deleting whole timetable history
    if target_user.faculty_profile:
        target_user.faculty_profile.user_id = None

    db.delete(target_user)

    audit = AuditLog(
        event_type="USER_DELETED",
        actor_id=admin_user.id,
        actor_name=admin_user.full_name,
        target_type="USER",
        target_id=user_id,
        details={
            "deleted_email": user_email,
            "deleted_name": user_name
        }
    )
    db.add(audit)
    db.commit()
    return {"status": "success", "message": f"User {user_name} ({user_email}) has been deleted."}

@router.post("/sync-firebase", response_model=Token)
def sync_firebase_user(
    payload: FirebaseSyncRequest,
    db: Session = Depends(get_db)
):
    """
    Synchronizes or enrolls a Firebase user into the backend database.
    """
    clean_email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == clean_email).first()

    if not user:
        # Determine initial role
        role_str = "FACULTY"
        if payload.role_name:
            role_str = payload.role_name.upper()
        elif "admin" in clean_email:
            role_str = "ADMIN"
        elif "hod" in clean_email:
            role_str = "HOD"
        elif "dean" in clean_email:
            role_str = "DEAN"

        role = db.query(Role).filter(Role.name == role_str).first()
        if not role:
            role = db.query(Role).filter(Role.name == "FACULTY").first()

        name = payload.full_name or clean_email.split("@")[0].replace(".", " ").title()

        user = User(
            email=clean_email,
            hashed_password=get_password_hash("firebase_oauth_session_2026"),
            full_name=name,
            role_id=role.id if role else 4,
            is_active=True
        )
        db.add(user)
        db.flush()

        # Check if faculty with this email already exists
        existing_faculty = db.query(Faculty).filter(Faculty.email == clean_email).first()
        if existing_faculty:
            existing_faculty.user_id = user.id
            existing_faculty.role_id = role.id if role else existing_faculty.role_id
        else:
            default_dept = db.query(Department).first()
            is_leadership = role and role.name in ["ADMIN", "DEAN", "HOD", "PC", "COMMITTEE_MEMBER"]
            fac_code = f"FAC-{user.id:03d}"
            code_exists = db.query(Faculty).filter(Faculty.faculty_id == fac_code).first()
            if code_exists:
                fac_code = f"FAC-{user.id:03d}-{int(datetime.utcnow().timestamp()) % 10000}"

            new_faculty = Faculty(
                faculty_id=fac_code,
                user_id=user.id,
                name=user.full_name,
                email=user.email,
                department_id=default_dept.id if default_dept else 1,
                designation="Assistant Professor" if (role and role.name == "FACULTY") else (user.full_name + " (" + (role.name if role else "Faculty") + ")"),
                role_id=role.id if role else None,
                is_substitution_eligible=(role and role.name == "FACULTY"),
                is_exempt=is_leadership,
                max_weekly_substitutions=0 if is_leadership else 4
            )
            db.add(new_faculty)

        db.commit()
        db.refresh(user)

    # Create backend session token
    access_token = create_access_token(
        subject=user.id,
        extra_claims={"email": user.email, "role": user.role.name if user.role else "USER"}
    )
    return Token(access_token=access_token, user=user_to_user_out(user))
