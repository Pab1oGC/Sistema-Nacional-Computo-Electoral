import io
from minio import Minio
from config import settings

_client: Minio | None = None


def get_minio() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=False,
        )
    return _client


def upload_acta(file_bytes: bytes, object_name: str, content_type: str) -> str:
    client = get_minio()
    client.put_object(
        settings.minio_bucket_rrv,
        object_name,
        io.BytesIO(file_bytes),
        length=len(file_bytes),
        content_type=content_type,
    )
    return f"{settings.minio_bucket_rrv}/{object_name}"
