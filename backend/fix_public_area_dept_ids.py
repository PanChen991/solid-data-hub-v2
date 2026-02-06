from sqlmodel import Session, select
from database import engine
from models import Folder

def fix_public_area_dept_ids():
    with Session(engine) as session:
        # 1. Get Root "01_部门专属空间"
        dept_space = session.exec(select(Folder).where(Folder.name == "01_部门专属空间")).first()
        if not dept_space: return

        # 2. Iterate L1 Dept Folders (e.g. "数智研发部")
        l1_folders = session.exec(select(Folder).where(Folder.parent_id == dept_space.id)).all()
        
        fixed_count = 0
        
        for dept_folder in l1_folders:
            # Determine correct Department ID from the folder itself
            correct_dept_id = dept_folder.department_id
            print(f"Checking Dept Folder: {dept_folder.name} (ID: {dept_folder.id}, Expected DeptID: {correct_dept_id})")
            
            if not correct_dept_id:
                print(f"  WARNING: Dept folder {dept_folder.name} has no department_id! Skipping.")
                continue

            # 3. Find the Public Area child
            public_name = f"{dept_folder.name}公共区"
            public_folder = session.exec(select(Folder).where(
                Folder.parent_id == dept_folder.id,
                Folder.name == public_name
            )).first()

            if public_folder:
                # Fix Public Folder itself
                if public_folder.department_id != correct_dept_id:
                    print(f"  Fixing Public Area '{public_folder.name}': {public_folder.department_id} -> {correct_dept_id}")
                    public_folder.department_id = correct_dept_id
                    session.add(public_folder)
                    fixed_count += 1
                
                # 4. Fix Children (e.g. "发发发ff")
                # Iterate all descendants roughly? Or just direct children for now?
                # Let's do direct children and maybe one level deep just to be safe for the user's case.
                children = session.exec(select(Folder).where(Folder.parent_id == public_folder.id)).all()
                for child in children:
                    if child.department_id != correct_dept_id:
                         print(f"    Fixing Child '{child.name}': {child.department_id} -> {correct_dept_id}")
                         child.department_id = correct_dept_id
                         session.add(child)
                         fixed_count += 1
                    
                    # Level 2 children
                    l2_children = session.exec(select(Folder).where(Folder.parent_id == child.id)).all()
                    for sub in l2_children:
                        if sub.department_id != correct_dept_id:
                            print(f"      Fixing Grandchild '{sub.name}': {sub.department_id} -> {correct_dept_id}")
                            sub.department_id = correct_dept_id
                            session.add(sub)
                            fixed_count += 1

        session.commit()
        print(f"\nFixed {fixed_count} folders.")

if __name__ == "__main__":
    fix_public_area_dept_ids()
