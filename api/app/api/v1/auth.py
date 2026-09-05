from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.core.security import verify_password, create_access_token
from app.models.entities import User, Role, Faculty
from app.schemas.schemas import Token, LoginRequest, UserOut
from app.api.deps import get_current_user

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

@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user account.")

    access_token = create_access_token(
        subject=user.id,
        extra_claims={"email": user.email, "role": user.role.name if user.role else "USER"}
    )
    return Token(access_token=access_token, user=user_to_user_out(user))

@router.post("/json-login", response_model=Token)
def json_login(
    payload: LoginRequest,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user account.")

    access_token = create_access_token(
        subject=user.id,
        extra_claims={"email": user.email, "role": user.role.name if user.role else "USER"}
    )
    return Token(access_token=access_token, user=user_to_user_out(user))

@router.get("/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return user_to_user_out(current_user)

@router.post("/demo-switch/{role_name}", response_model=Token)
def demo_switch_role(
    role_name: str,
    db: Session = Depends(get_db)
):
    """
    Demo helper: switches user session to a specified role user (ADMIN, FACULTY, DEAN, HOD)
    for instant UI testing and demonstration.
    """
    role = db.query(Role).filter(Role.name == role_name.upper()).first()
    if not role:
        raise HTTPException(status_code=404, detail=f"Role '{role_name}' not found.")
    
    user = db.query(User).filter(User.role_id == role.id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"No active user found for role '{role_name}'.")

    access_token = create_access_token(
        subject=user.id,
        extra_claims={"email": user.email, "role": user.role.name}
    )
    return Token(access_token=access_token, user=user_to_user_out(user))
