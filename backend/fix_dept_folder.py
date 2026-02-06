from sqlmodel import Session, create_engine, select
from models import Folder, Department, SpaceType

# Connect to database
# Note: Path relative to backend/
engine = create_engine("sqlite:///database.db")

def fix_structure():
    with Session(engine) as session:
        print("Starting restructuring...")
        
        # 1. Fetch '01_部门专属空间' (Parent for new folder) - ID 2
        parent_folder = session.get(Folder, 2)
        if not parent_folder:
            print("Error: Root folder ID 2 not found!")
            return

        # 2. Fetch '美洲研发中心' Department - ID 1
        dept = session.get(Department, 1)
        if not dept:
            print("Error: Department ID 1 not found!")
            return
            
        if dept.root_folder_id:
            print(f"Department already has root folder: {dept.root_folder_id}")
            # Optional: Check if we need to move children if it already existed but structure was wrong
            # But based on user request, it's missing.
            new_folder_id = dept.root_folder_id
        else:
            # 3. Create New Folder
            new_folder = Folder(
                name=dept.name,
                parent_id=2, # Under 01_部门专属空间
                space_type=SpaceType.DEPARTMENT,
                department_id=dept.id,
                is_locked=True, # Dept roots are usually locked/system managed
                owner_id=1 # Assign to System/Admin usually, or leave None. Assuming 1 is admin.
            )
            session.add(new_folder)
            session.commit()
            session.refresh(new_folder)
            new_folder_id = new_folder.id
            print(f"Created new folder '{new_folder.name}' with ID {new_folder_id}")

            # 4. Link Dept to Folder
            dept.root_folder_id = new_folder_id
            session.add(dept)
            session.commit()
            print("Linked Department to new Folder.")

        # 5. Move Child Folders (IDs 4, 5, 6, 7, 8, 9)
        # These are the root folders of the sub-departments
        child_ids = [4, 5, 6, 7, 8, 9]
        
        for cid in child_ids:
            child_folder = session.get(Folder, cid)
            if child_folder:
                if child_folder.parent_id != new_folder_id:
                    print(f"Moving folder '{child_folder.name}' (ID {cid}) from Parent {child_folder.parent_id} to {new_folder_id}")
                    child_folder.parent_id = new_folder_id
                    session.add(child_folder)
                else:
                    print(f"Folder '{child_folder.name}' (ID {cid}) is already in correct place.")
        
        session.commit()
        print("Restructuring Complete!")

if __name__ == "__main__":
    fix_structure()
