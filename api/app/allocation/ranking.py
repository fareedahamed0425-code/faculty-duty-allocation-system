from typing import List, Dict, Any
from app.models.entities import Faculty, ClassSection, Subject

class RankedCandidate:
    def __init__(
        self,
        faculty: Faculty,
        weekly_substitutions: int,
        daily_regular_classes: int,
        target_class: ClassSection,
        target_subject: Subject
    ):
        self.faculty = faculty
        self.weekly_substitutions = weekly_substitutions
        self.daily_regular_classes = daily_regular_classes
        self.target_class = target_class
        self.target_subject = target_subject
        
        # Soft preference calculations
        self.department_match = (faculty.department_id == target_class.department_id)
        
        expertise = faculty.subject_expertise or []
        subject_code = target_subject.code if target_subject else ""
        subject_name = target_subject.name if target_subject else ""
        self.subject_match = any(
            exp.lower() in [subject_code.lower(), subject_name.lower()] or subject_code.lower() in exp.lower()
            for exp in expertise
        )
        
        # Priority Score (Lower score = higher priority)
        # Primary: weekly_substitutions (weight = 100.0)
        # Secondary: department match (-10.0 bonus)
        # Tertiary: subject match (-5.0 bonus)
        # Quaternary: daily_regular_classes (weight = 1.0)
        self.score = (
            (self.weekly_substitutions * 100.0)
            + (self.daily_regular_classes * 1.0)
            - (10.0 if self.department_match else 0.0)
            - (5.0 if self.subject_match else 0.0)
        )

def rank_eligible_candidates(
    candidates_data: List[Dict[str, Any]],
    target_class: ClassSection,
    target_subject: Subject
) -> List[RankedCandidate]:
    """
    Ranks eligible faculty strictly adhering to Rule 7 (Lowest weekly substitutions first).
    """
    ranked_list = []
    for item in candidates_data:
        rc = RankedCandidate(
            faculty=item["faculty"],
            weekly_substitutions=item["weekly_substitutions"],
            daily_regular_classes=item["daily_regular_classes"],
            target_class=target_class,
            target_subject=target_subject
        )
        ranked_list.append(rc)
        
    # Sort strictly by:
    # 1. weekly_substitutions (ascending) -> Rule 7
    # 2. department_match (True first)
    # 3. subject_match (True first)
    # 4. daily_regular_classes (ascending)
    # 5. faculty.id (deterministic tie-breaker)
    ranked_list.sort(
        key=lambda rc: (
            rc.weekly_substitutions,
            not rc.department_match,
            not rc.subject_match,
            rc.daily_regular_classes,
            rc.faculty.id
        )
    )
    
    return ranked_list
