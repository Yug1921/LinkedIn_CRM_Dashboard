from fastapi import APIRouter
from app.schemas.meta import EnumsResponse
from app.constants import LEAD_CATEGORY_HINTS, DISCOVERY_STATUSES, LEAD_STATUSES, COUNTRIES_TARGETED

router = APIRouter(prefix="/api/meta", tags=["meta"])


@router.get("/enums", response_model=EnumsResponse)
def get_enums():
    return EnumsResponse(
        lead_category_hints=LEAD_CATEGORY_HINTS,
        discovery_statuses=DISCOVERY_STATUSES,
        lead_statuses=LEAD_STATUSES,
        countries_targeted=COUNTRIES_TARGETED,
    )