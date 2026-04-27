from minio import Minio
from config import settings

_client: Minio | None = None


def _get_minio() -> Minio:
    global _client
    if _client is None:
        _client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=False,
        )
    return _client


def download_file(bucket: str, object_name: str) -> bytes:
    response = _get_minio().get_object(bucket, object_name)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()
