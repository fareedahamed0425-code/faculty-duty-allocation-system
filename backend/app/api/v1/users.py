from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import get_password_hash, create_access_token
from app.models.entities import User, Role, Faculty, Department, AuditLog
from app.schemas.schemas import UserOut, RoleOut, UserRoleUpdate, UserStatusUpdate, FirebaseSyncRequest, Token
from app.api.deps import get_current_user, require_admin

router = APIRouter()

def user_to_user_out(user: User) -> UserOut:
    faculty_id = None
    faculty_code = None
    department_name = None
    if user.faculty_profile:
        faculty_id = user.faculty_profile.id
        faculty_code = user.faculty_profile.faculty_id
        if user.faculty_profile.department:
            department_name = user.faculty_profile.department.name

    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        is_active=user.is_active,
        faculty_id=faculty_id,
        faculty_code=faculty_code,
        department_name=department_name
    )

@router.get("", response_model=List[UserOut])
def list_all_users(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all users registered in the system.
    """
    users = db.query(User).order_by(User.id.asc()).all()
    return [user_to_user_out(u) for u in users]

@router.get("/roles", response_model=List[RoleOut])
def list_available_roles(db: Session = Depends(get_db)):
    """
    List all institutional roles.
    """
    return db.query(Role).order_by(Role.id.asc()).all()

@router.patch("/{user_id}/role", response_model=UserOut)
def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin)
):
    """
    Admin action: Update a user's role and sync faculty exemption / eligibility flags.
    """
    target_user = db.query(User).filter(User.id == user_id).first()
    if not target_user:
        raise HTTPException(status_code=404, detail=f"User #{user_id} not found.")

    role = db.query(Role).filter(Role.name == payload.role_name.upper()).first()
    if not role:
        raise HTTPException(status_code=400, detail=f"Role '{payload.role_name}' is not recognized.")

    old_role_name = target_user.role.name if target_user.role else "NONE"
    target_user.role_id = role.id

    # If linked faculty profile exists, sync its role and eligibility/exemption flags
    faculty = target_user.faculty_profile
    if faculty:
        faculty.role_id = role.id
        if role.name in ["ADMIN", "DEAN", "HOD", "PC", "COMMITTEE_MEMBER"]:
            faculty.is_exempt = True
            faculty.is_substitution_eligible = False
        else:
            faculty.is_exempt = False
            faculty.is_substitution_eligible = True
        
        if payload.department_id:
            faculty.department_id = payload.department_id
    else:
        # If user is given FACULTY or HOD role and doesn't have a faculty profile, create one
        if role.name in ["FACULTY", "HOD"]:
            default_dept = db.query(Department).first()
            if default_dept:
                new_faculty = Faculty(
                    faculty_id=f"FAC-{target_user.id:03d}",
                    user_id=target_user.id,
                    name=target_user.full_name,
                    email=target_user.email,
                    department_id=payload.department_id or default_dept.id,
                    designation="Assistant Professor" if role.name == "FACULTY" else "Head of Department",
                    role_id=role.id,
                    is_substitution_eligible=(role.name == "FACULTY"),
                    is_exempt=(role.name != "FACULTY"),
                    max_weekly_substitutions=4
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

        # If faculty, create faculty record
        if role and role.name in ["FACULTY", "HOD"]:
            default_dept = db.query(Department).first()
            if default_dept:
                new_faculty = Faculty(
                    faculty_id=f"FAC-{user.id:03d}",
                    user_id=user.id,
                    name=user.full_name,
                    email=user.email,
                    department_id=default_dept.id,
                    designation="Assistant Professor" if role.name == "FACULTY" else "Head of Department",
                    role_id=role.id,
                    is_substitution_eligible=(role.name == "FACULTY"),
                    is_exempt=(role.name != "FACULTY"),
                    max_weekly_substitutions=4
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
