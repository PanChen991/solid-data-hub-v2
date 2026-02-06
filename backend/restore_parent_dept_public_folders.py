from sqlmodel import Session, select
from database import engine
from models import Folder, SpaceType

def restore_l1_public_areas():
    with Session(engine) as session:
        # 1. Find the Root for Departments
        dept_space = session.exec(select(Folder).where(Folder.name == "01_部门专属空间")).first()
        if not dept_space:
            print("Department Space Root not found!")
            return

        # 2. Iterate Level 1 Departments (Children of 01_Space)
        l1_depts = session.exec(select(Folder).where(Folder.parent_id == dept_space.id)).all()
        
        restored_count = 0
        print(f"Checking {len(l1_depts)} L1 departments for missing Public Areas...")

        for dept_folder in l1_depts:
            public_folder_name = f"{dept_folder.name}公共区"
            
            # Check if exists
            exists = session.exec(select(Folder).where(
                Folder.parent_id == dept_folder.id,
                Folder.name == public_folder_name
            )).first()

            if not exists:
                print(f"  Restoring: '{public_folder_name}' inside '{dept_folder.name}'")
                
                # Create folder
                # Note: Parent is L1 Dept. SpaceType is 'department'.
                # Owner: Admin (1) for now, or match Dept owner? We use Admin(1) for structure.
                new_folder = Folder(
                    name=public_folder_name,
                    parent_id=dept_folder.id,
                    space_type="department", # Explicitly set space type
                    owner_id=1, # Admin
                    is_locked=False,
                    is_restricted=False
                )
                session.add(new_folder)
                restored_count += 1
            else:
                print(f"  Skipping: '{public_folder_name}' (Already exists)")

        session.commit()
        print(f"\nRestored {restored_count} folders.")

if __name__ == "__main__":
    restore_l1_public_areas()
