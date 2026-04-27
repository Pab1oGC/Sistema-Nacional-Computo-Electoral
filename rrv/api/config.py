from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mongo_uri: str = "mongodb://mongo1:27017,mongo2:27017,mongo3:27017/rrv_db?replicaSet=rrv-rs"
    kafka_bootstrap: str = "kafka:9092"
    minio_endpoint: str = "minio:9000"
    minio_access_key: str = "rrv_admin"
    minio_secret_key: str = "rrv_minio_2025"
    minio_bucket_rrv: str = "actas-rrv"
    sms_secret_key: str = "clave-secreta-rrv-2025"

    model_config = {"env_file": ".env"}


settings = Settings()
