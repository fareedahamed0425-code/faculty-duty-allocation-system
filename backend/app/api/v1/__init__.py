from fastapi import APIRouter
from app.api.v1 import (
    auth, users, faculty, timetables, absences, substitutions, reports,
    notifications, system_rules, audit, ai
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["User Management"])
api_router.include_router(faculty.router, prefix="/faculty", tags=["Faculty Management"])
api_router.include_router(timetables.router, prefix="/timetables", tags=["Timetables"])
api_router.include_router(absences.router, prefix="/absences", tags=["Absences"])
api_router.include_router(substitutions.router, prefix="/substitutions", tags=["Substitutions"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports & Analytics"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["Notifications"])
api_router.include_router(system_rules.router, prefix="/system-rules", tags=["System Rules"])
api_router.include_router(audit.router, prefix="/audit", tags=["Audit Trail"])
api_router.include_router(ai.router, prefix="/ai", tags=["AI Assistant"])
