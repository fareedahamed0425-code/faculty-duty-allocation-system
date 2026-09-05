from typing import List, Dict, Any
from sqlalchemy.orm import Session
from app.models.entities import SubstitutionRequirement
from app.allocation.engine import generate_allocation

def batch_allocate_requirements(
    db: Session,
    requirement_ids: List[int],
    actor_name: str = "Batch Allocation Engine"
) -> Dict[str, Any]:
    """
    Solves multiple substitution requirements sequentially while updating dynamic state
    (preventing double booking and adjusting weekly duty counts on the fly).
    """
    requirements = db.query(SubstitutionRequirement).filter(
        SubstitutionRequirement.id.in_(requirement_ids)
    ).order_by(
        SubstitutionRequirement.date.asc(),
        SubstitutionRequirement.period_start.asc()
    ).all()

    results: List[Dict[str, Any]] = []
    allocated_count = 0
    unallocated_count = 0

    for req in requirements:
        alloc_res = generate_allocation(
            db=db,
            requirement_id=req.id,
            actor_name=actor_name,
            allocation_method="AUTOMATIC_BATCH"
        )
        results.append(alloc_res)
        if alloc_res.get("status") == "ALLOCATED":
            allocated_count += 1
        else:
            unallocated_count += 1

    return {
        "total_processed": len(requirements),
        "allocated_count": allocated_count,
        "unallocated_count": unallocated_count,
        "results": results
    }
