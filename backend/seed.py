from sqlmodel import Session, select, SQLModel
from database import engine, create_db_and_tables
from models import User, Department, Role, Folder, SpaceType
from auth_utils import get_password_hash
import os

def seed_db():
    # Ensure database is clean or at least tables are created
    create_db_and_tables()
    
    with Session(engine) as session:
        # Check if already seeded with basic root
        root_dept = session.exec(select(Department).where(Department.name == "美洲研发中心")).first()
        if root_dept:
            print("Database already contains '美洲研发中心'. Cleaning up users/departments for re-seed...")
            SQLModel.metadata.drop_all(engine)
            create_db_and_tables()

        # 1. Create Organization Tree
        root = Department(name="美洲研发中心")
        session.add(root)
        session.commit()
        session.refresh(root)
        dept_map = {"美洲研发中心": root}

        # Level 1
        depts_l1 = {
            "数智研发部": root.id,
            "项目支持部": root.id,
            "电解质研发部": root.id,
            "高分子研发部": root.id,
            "电芯开发部": root.id,
            "低空动力部": root.id
        }
        
        for name, parent_id in depts_l1.items():
            d = Department(name=name, parent_id=parent_id)
            session.add(d)
            dept_map[name] = d
        
        session.commit()
        for d in dept_map.values(): session.refresh(d)

        # Level 2
        depts_l2 = [
            ("仿真计算部", "数智研发部"),
            ("数字应用部", "数智研发部"),
            ("项目管理部", "项目支持部"),
            ("测试验证部", "项目支持部"),
            ("品质安环部", "项目支持部"),
            ("设备开发部", "项目支持部"),
            ("材料开发部", "电解质研发部"),
            ("工艺工程部", "电解质研发部"),
            ("粘结剂研发部", "高分子研发部"),
            ("聚合物研发部", "高分子研发部"),
            ("功能材料研发部", "高分子研发部"),
            ("硫化物开发部", "电芯开发部"),
            ("卤化物开发部", "电芯开发部"),
            ("工艺开发部", "电芯开发部"),
            ("产品开发部", "低空动力部"),
            ("试制工艺部", "低空动力部"),
            ("市场应用部", "低空动力部"),
        ]

        for name, parent_name in depts_l2:
            d = Department(name=name, parent_id=dept_map[parent_name].id)
            session.add(d)
            dept_map[name] = d
        
        session.commit()
        for d in dept_map.values(): session.refresh(d)

        # 2. Create Personnel
        # Format: [姓名] - [工号] - [所属部门] - [角色]
        pwd = get_password_hash("123456")
        
        users_data = [
            ("admin", "ADMIN", "美洲研发中心", Role.SUPER_ADMIN),
            ("高慕园", "SH100379", "数智研发部", Role.SUPER_ADMIN),
            ("洪意闻", "SH100300", "项目支持部", Role.SUPER_ADMIN),
            ("杨凯麒", "US2025030021", "仿真计算部", Role.MANAGER),
            ("张国兴", "SH100428", "数字应用部", Role.MANAGER),
            ("潘晨", "SH100553", "数字应用部", Role.EDITOR),
            ("王淑琴", "2022032908", "项目管理部", Role.MANAGER),
            ("韩立华", "2018052105", "测试验证部", Role.MANAGER),
            ("叶慧", "YJ2023085022", "测试验证部", Role.EDITOR),
        ]

        admin_user = None
        for name, emp_id, dept_name, role in users_data:
            user = User(
                username=name,
                hashed_password=pwd,
                employee_id=emp_id,
                email=f"{emp_id.lower()}@gotion.com",
                role=role,
                department_id=dept_map[dept_name].id
            )
            session.add(user)
            if name == "admin":
                admin_user = user # Capture admin for later use

        session.commit()
        
        # Reload admin to get ID
        if admin_user:
            session.refresh(admin_user)
            admin_id = admin_user.id
        else:
            # Fallback if logic fails (shouldn't happen)
            admin_reloaded = session.exec(select(User).where(User.username == "admin")).first()
            admin_id = admin_reloaded.id if admin_reloaded else None

        # 3. Create Root Folders
        root_folders = [
            Folder(name="00_公共资源库", space_type=SpaceType.PUBLIC, owner_id=admin_id),
            Folder(name="01_部门专属空间", space_type=SpaceType.DEPARTMENT, owner_id=admin_id),
            Folder(name="02_项目协作空间", space_type=SpaceType.PROJECT, owner_id=admin_id)
        ]
        for folder in root_folders:
            session.add(folder)

        session.commit()
        print("Database reconfigured with American R&D Center structure successfully!")

if __name__ == "__main__":
    seed_db()
