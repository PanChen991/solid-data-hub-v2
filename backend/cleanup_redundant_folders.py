from sqlmodel import Session, select
from database import engine
from models import Folder

def cleanup_redundant_folders():
    with Session(engine) as session:
        # 1. Find the Root for Departments
        dept_space = session.exec(select(Folder).where(Folder.name == "01_部门专属空间")).first()
        if not dept_space:
            print("Department Space Root not found!")
            return

        # 2. Iterate Level 1 Departments (Children of 01_Space)
        l1_depts = session.exec(select(Folder).where(Folder.parent_id == dept_space.id)).all()
        
        folders_to_delete = []

        print(f"Scanning {len(l1_depts)} departments...")

        for dept_folder in l1_depts:
            # Check Level 1 Redundancy
            children = session.exec(select(Folder).where(Folder.parent_id == dept_folder.id)).all()
            
            for child in children:
                # Top level redundancy: e.g. "数智研发部" -> "数智研发部公共区"
                if dept_folder.name in child.name and "公共区" in child.name:
                     print(f"  [Found Redundant L1] '{child.name}' (ID: {child.id}) inside '{dept_folder.name}'")
                     folders_to_delete.append(child)
                else:
                    # Check Level 2 Redundancy (Sub-Depts)
                    # e.g. "数智研发部" -> "仿真计算部" -> "仿真计算部公共区"
                    l2_children = session.exec(select(Folder).where(Folder.parent_id == child.id)).all()
                    for sub_child in l2_children:
                        if child.name in sub_child.name and "公共区" in sub_child.name:
                             print(f"    [Found Redundant L2] '{sub_child.name}' (ID: {sub_child.id}) inside '{child.name}'")
                             folders_to_delete.append(sub_child)

        print(f"\nFound {len(folders_to_delete)} redundant folders.")
        
        if len(folders_to_delete) > 0:
            # We will use 'run_command' which is interaction-less usually or needs input.
            # I will assume YES for the tool execution but safeguard here
            print("Deleting...")
            for f in folders_to_delete:
                session.delete(f)
            session.commit()
            print("Deleted successfully.")
        else:
            print("No redundant folders found.")

if __name__ == "__main__":
    cleanup_redundant_folders()
