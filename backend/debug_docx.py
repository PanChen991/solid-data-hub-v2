from sqlmodel import Session, create_engine, select
from models import Document, Folder
import os

base_dir = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(base_dir, "database.db")
engine = create_engine(f"sqlite:///{db_path}")

def check_docs():
    with Session(engine) as session:
        folders = session.exec(select(Folder)).all()
        print(f"Found {len(folders)} folders.")
        for f in folders:
            print(f"  Folder ID: {f.id}, Name: {f.name}")

        docs = session.exec(select(Document)).all()
        print(f"Found {len(docs)} documents.")
        for doc in docs:
            print(f"ID: {doc.id}, Name: {doc.name}, OSS_KEY: {doc.oss_key}, FileType: {doc.file_type}, FolderID: {doc.folder_id}")
            local_path = os.path.join(base_dir, "uploads", doc.oss_key)
            print(f"  Checking local path: {local_path}")
            if os.path.exists(local_path):
                print("  [OK] File exists.")
            else:
                print("  [ERROR] File MISSING!")
                # Try fallback
                alt_path = doc.oss_key
                if os.path.exists(alt_path):
                    print(f"  [Found] File exists at raw OSS_KEY: {alt_path}")

if __name__ == "__main__":
    check_docs()
