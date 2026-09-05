import json
from datetime import date, datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.entities import (
    Faculty, Department, ClassSection, Subject, TimetableEntry,
    TimetableVersion, Absence, SubstitutionRequirement, SubstitutionDuty, AuditLog
)
from app.allocation.constraints import get_week_bounds
from app.allocation.engine import evaluate_candidates_for_requirement, generate_allocation
from app.services.absence_service import create_faculty_absence
from app.services.report_service import get_dashboard_stats, get_workload_report

# Tool Schema Definitions for NVIDIA Nemotron / OpenAI tool format
TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "get_faculty",
            "description": "Search and list faculty members by name, department, or status.",
            "parameters": {
                "type": "object",
                "properties": {
                    "search_query": {"type": "string", "description": "Optional name or faculty ID search"},
                    "department_code": {"type": "string", "description": "Optional department filter like CSE, ECE"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_faculty_timetable",
            "description": "Get weekly regular schedule and class load for a specific faculty member.",
            "parameters": {
                "type": "object",
                "properties": {
                    "faculty_id": {"type": "integer", "description": "ID of the faculty member"},
                    "day_of_week": {"type": "integer", "description": "Optional day: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat"}
                },
                "required": ["faculty_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_absences",
            "description": "List faculty absences for a given date or all recent absences.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date_str": {"type": "string", "description": "Date in YYYY-MM-DD format"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_absence",
            "description": "Record a faculty absence and automatically generate & allocate substitution duties for affected classes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "faculty_id": {"type": "integer", "description": "Faculty ID"},
                    "date_str": {"type": "string", "description": "Date in YYYY-MM-DD format"},
                    "reason": {"type": "string", "description": "Reason for absence"}
                },
                "required": ["faculty_id", "date_str"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "find_eligible_faculty",
            "description": "Find all eligible and rejected candidates for an uncovered class requirement, with exact rule violation reasons.",
            "parameters": {
                "type": "object",
                "properties": {
                    "requirement_id": {"type": "integer", "description": "Substitution requirement ID"}
                },
                "required": ["requirement_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "generate_allocation",
            "description": "Trigger deterministic automatic allocation for a pending substitution requirement.",
            "parameters": {
                "type": "object",
                "properties": {
                    "requirement_id": {"type": "integer", "description": "Substitution requirement ID"}
                },
                "required": ["requirement_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "explain_allocation",
            "description": "Explain why a specific faculty member was selected for a duty and why other candidates were rejected.",
            "parameters": {
                "type": "object",
                "properties": {
                    "duty_id": {"type": "integer", "description": "Substitution duty ID"}
                },
                "required": ["duty_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_weekly_duty_count",
            "description": "Get current weekly substitution count (X/4) and workload for all faculty or a specific faculty member.",
            "parameters": {
                "type": "object",
                "properties": {
                    "faculty_id": {"type": "integer", "description": "Optional specific faculty ID"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_unallocated_requirements",
            "description": "List all unallocated substitution requirements that could not find an eligible candidate.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date_str": {"type": "string", "description": "Optional date filter in YYYY-MM-DD format"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_dashboard_summary",
            "description": "Get high-level operational statistics and summary for today.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date_str": {"type": "string", "description": "Optional target date"}
                }
            }
        }
    }
]

def execute_tool(db: Session, tool_name: str, arguments: Dict[str, Any], actor_name: str = "AI Assistant") -> Dict[str, Any]:
    """
    Executes controlled backend tool safely.
    """
    try:
        if tool_name == "get_faculty":
            query = db.query(Faculty)
            if arguments.get("department_code"):
                dept = db.query(Department).filter(Department.code == arguments["department_code"].upper()).first()
                if dept:
                    query = query.filter(Faculty.department_id == dept.id)
            if arguments.get("search_query"):
                sq = f"%{arguments['search_query']}%"
                query = query.filter((Faculty.name.ilike(sq)) | (Faculty.faculty_id.ilike(sq)))
            faculty_list = query.limit(15).all()
            return {
                "total_found": len(faculty_list),
                "faculty": [
                    {
                        "id": f.id,
                        "faculty_id": f.faculty_id,
                        "name": f.name,
                        "department": f.department.name if f.department else "",
                        "designation": f.designation,
                        "is_exempt": f.is_exempt,
                        "is_eligible": f.is_substitution_eligible,
                        "status": f.status
                    }
                    for f in faculty_list
                ]
            }

        elif tool_name == "get_faculty_timetable":
            fid = arguments.get("faculty_id")
            active_version = db.query(TimetableVersion).filter(TimetableVersion.is_active == True).first()
            if not active_version:
                return {"error": "No active timetable version found."}
            
            query = db.query(TimetableEntry).filter(
                TimetableEntry.timetable_version_id == active_version.id,
                TimetableEntry.faculty_id == fid
            )
            if "day_of_week" in arguments and arguments["day_of_week"] is not None:
                query = query.filter(TimetableEntry.day_of_week == arguments["day_of_week"])
            entries = query.order_by(TimetableEntry.day_of_week, TimetableEntry.start_time).all()
            
            day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            return {
                "faculty_id": fid,
                "total_classes": len(entries),
                "schedule": [
                    {
                        "day": day_names[e.day_of_week],
                        "time": f"{e.start_time}-{e.end_time}",
                        "class": e.class_section.name if e.class_section else "",
                        "subject": f"{e.subject.code} - {e.subject.name}" if e.subject else "",
                        "room": e.room_number
                    }
                    for e in entries
                ]
            }

        elif tool_name == "get_absences":
            target_date = date.fromisoformat(arguments["date_str"]) if arguments.get("date_str") else date.today()
            absences = db.query(Absence).filter(
                Absence.date == target_date,
                Absence.status != "CANCELLED"
            ).all()
            return {
                "date": str(target_date),
                "count": len(absences),
                "absences": [
                    {
                        "id": a.id,
                        "faculty_name": a.faculty.name,
                        "faculty_code": a.faculty.faculty_id,
                        "department": a.faculty.department.name if a.faculty.department else "",
                        "time": "Full Day" if a.is_full_day else f"{a.start_time}-{a.end_time}",
                        "reason": a.reason,
                        "affected_classes": len(a.requirements)
                    }
                    for a in absences
                ]
            }

        elif tool_name == "create_absence":
            fid = arguments["faculty_id"]
            d = date.fromisoformat(arguments["date_str"])
            reason = arguments.get("reason", "Reported via AI Assistant")
            res = create_faculty_absence(
                db=db,
                faculty_id=fid,
                absence_date=d,
                reason=reason,
                reported_by=actor_name,
                auto_allocate=True
            )
            return res

        elif tool_name == "find_eligible_faculty":
            req_id = arguments["requirement_id"]
            req = db.query(SubstitutionRequirement).filter(SubstitutionRequirement.id == req_id).first()
            if not req:
                return {"error": f"Requirement #{req_id} not found."}
            eval_res = evaluate_candidates_for_requirement(db, req)
            return {
                "requirement_id": req_id,
                "class": req.class_section.name,
                "subject": req.subject.name,
                "period": f"{req.period_start}-{req.period_end}",
                "date": str(req.date),
                "eligible_count": len(eval_res["eligible_candidates"]),
                "eligible_candidates": [
                    {
                        "name": c["faculty_name"],
                        "weekly_substitutions": c["weekly_substitutions"],
                        "daily_classes_today": c["daily_regular_classes"]
                    }
                    for c in eval_res["eligible_candidates"]
                ],
                "rejected_count": len(eval_res["rejected_candidates"]),
                "sample_rejected": [
                    {
                        "name": r["faculty_name"],
                        "reasons": r["rejection_reasons"]
                    }
                    for r in eval_res["rejected_candidates"][:5]
                ]
            }

        elif tool_name == "generate_allocation":
            req_id = arguments["requirement_id"]
            return generate_allocation(
                db=db,
                requirement_id=req_id,
                actor_name=actor_name,
                allocation_method="AI_ORCHESTRATED"
            )

        elif tool_name == "explain_allocation":
            duty_id = arguments["duty_id"]
            duty = db.query(SubstitutionDuty).filter(SubstitutionDuty.id == duty_id).first()
            if not duty:
                return {"error": f"Duty #{duty_id} not found."}
            return {
                "duty_id": duty.id,
                "class_name": duty.class_section.name,
                "subject": duty.subject.name,
                "date": str(duty.date),
                "period": f"{duty.period_start}-{duty.period_end}",
                "assigned_faculty": duty.assigned_faculty.name,
                "original_faculty": duty.original_faculty.name,
                "allocation_method": duty.allocation_method,
                "weekly_count_at_assignment": duty.weekly_count_at_assignment,
                "daily_classes_at_assignment": duty.daily_classes_at_assignment,
                "allocation_reason": duty.allocation_reason,
                "is_manual_override": duty.is_manual_override,
                "override_reason": duty.override_reason
            }

        elif tool_name == "get_weekly_duty_count":
            workload = get_workload_report(db)
            if arguments.get("faculty_id"):
                workload = [w for w in workload if w["faculty_id"] == arguments["faculty_id"]]
            return {"workload": workload}

        elif tool_name == "get_unallocated_requirements":
            query = db.query(SubstitutionRequirement).filter(
                SubstitutionRequirement.status == "UNALLOCATED"
            )
            if arguments.get("date_str"):
                query = query.filter(SubstitutionRequirement.date == date.fromisoformat(arguments["date_str"]))
            unalloc = query.all()
            return {
                "count": len(unalloc),
                "unallocated": [
                    {
                        "id": u.id,
                        "class": u.class_section.name,
                        "subject": u.subject.name,
                        "date": str(u.date),
                        "period": f"{u.period_start}-{u.period_end}",
                        "original_faculty": u.original_faculty.name,
                        "reason": u.unallocated_reason
                    }
                    for u in unalloc
                ]
            }

        elif tool_name == "get_dashboard_summary":
            target_date = date.fromisoformat(arguments["date_str"]) if arguments.get("date_str") else date.today()
            return get_dashboard_stats(db, target_date)

        else:
            return {"error": f"Unknown tool name '{tool_name}'"}

    except Exception as e:
        return {"error": f"Tool execution failed: {str(e)}"}
