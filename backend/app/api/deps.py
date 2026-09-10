from typing import Generator, Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from app.db.session import SessionLocal, get_db
from app.core.config import settings
from app.models.entities import User, Role, Faculty

oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)

def get_current_user(
    db: Session = Depends(get_db),
    token: Optional[str] = Depends(oauth2_scheme)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials. Please sign in.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token or not token.strip():
        raise credentials_exception

    clean_token = token.strip()
    if clean_token.lower().startswith("bearer "):
        clean_token = clean_token[7:].strip()

    # 1. Try decoding with institutional SECRET_KEY
    try:
        payload = jwt.decode(clean_token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        sub_val = payload.get("sub")
        email_val = payload.get("email")
        if sub_val is not None:
            if str(sub_val).isdigit():
                user = db.query(User).filter(User.id == int(sub_val)).first()
                if user and user.is_active:
                    return user
            elif "@" in str(sub_val):
                user = db.query(User).filter(User.email == str(sub_val).strip().lower()).first()
                if user and user.is_active:
                    return user
        if email_val:
            user = db.query(User).filter(User.email == str(email_val).strip().lower()).first()
            if user and user.is_active:
                return user
    except Exception:
        pass

    # 2. Try decoding claims from Firebase ID token or external JWT
    try:
        unverified_claims = jwt.get_unverified_claims(clean_token)
        email = unverified_claims.get("email") or unverified_claims.get("sub")
        if email and isinstance(email, str) and "@" in email:
            user = db.query(User).filter(User.email == email.strip().lower()).first()
            if user and user.is_active:
                return user
    except Exception:
        pass

    raise credentials_exception

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not current_user.role or current_user.role.name != "ADMIN":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required for this operation."
        )
    return current_user

