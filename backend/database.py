from sqlmodel import create_engine, Session, SQLModel
from models import *
import os

sqlite_file_name = "database.db"
base_dir = os.path.dirname(os.path.abspath(__file__))
sqlite_url = f"sqlite:///{os.path.join(base_dir, sqlite_file_name)}"

engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})

def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

def get_session():
    with Session(engine) as session:
        yield session
