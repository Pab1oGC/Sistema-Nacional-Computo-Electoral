from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    mongo_uri: str = "mongodb://mongo1:27017,mongo2:27017,mongo3:27017/rrv_db?replicaSet=rrv-rs"
    kafka_bootstrap: str = "kafka:9092"

    model_config = {"env_file": ".env"}


settings = Settings()
