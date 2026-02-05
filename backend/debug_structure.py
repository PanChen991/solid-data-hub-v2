from sqlmodel import Session, select
from database import engine
from models import Folder

def check_structure():
    with Session(engine) as session:
        # Check Root folders
        roots = session.exec(select(Folder).where(Folder.parent_id == None)).all()
        print("--- Root Folders ---")
        for r in roots:
            print(f"ID: {r.id}, Name: {r.name}, Type: {r.space_type}")
            
            # Check children count
            count = session.exec(select(Folder).where(Folder.parent_id == r.id)).all()
            print(f"   -> Children count: {len(count)}")
            
            if "01" in r.name:
                print("   -> Listing first 5 children:")
                for c in count[:5]:
                     print(f"      - ID: {c.id}, Name: {c.name}")

if __name__ == "__main__":
    check_structure()
