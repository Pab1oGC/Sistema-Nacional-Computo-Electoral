from pymongo import MongoClient
from pymongo.database import Database
from config import settings

_client: MongoClient | None = None


def get_db() -> Database:
    global _client
    if _client is None:
        _client = MongoClient(settings.mongo_uri)
    return _client.rrv_db
