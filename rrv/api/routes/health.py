from fastapi import APIRouter
from services.mongo import get_db
from services.producer import get_producer

router = APIRouter(tags=["health"])


@router.get("/health")
def health():
    checks = {}

    try:
        get_db().command("ping")
        checks["mongo"] = "ok"
    except Exception as e:
        checks["mongo"] = f"error: {e}"

    try:
        get_producer()
        checks["kafka"] = "ok"
    except Exception as e:
        checks["kafka"] = f"error: {e}"

    all_ok = all(v == "ok" for v in checks.values())
    return {"status": "ok" if all_ok else "degraded", **checks}
