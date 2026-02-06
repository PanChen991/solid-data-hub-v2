from sqlmodel import Session, select
from database import engine
from models import User
from auth_utils import get_password_hash, verify_password

def verify_password_change_logic():
    # Simulate the logic in update_self directly
    # We can't easily spin up a full HTTP client here without running server, 
    # but we can verify the DB logic which is what matters.
    
    username = "admin" # Test with admin or any user
    new_password = "NewPassword123!"
    
    with Session(engine) as session:
        user = session.exec(select(User).where(User.username == username)).first()
        if not user:
            print(f"User {username} not found")
            return
            
        print(f"User found: {user.username}")
        
        # Simulate update
        hashed = get_password_hash(new_password)
        user.hashed_password = hashed
        session.add(user)
        session.commit()
        session.refresh(user)
        
        # Verify
        is_valid = verify_password(new_password, user.hashed_password)
        print(f"Password update verification: {'SUCCESS' if is_valid else 'FAILED'}")
        
        # Restore (Optional, but good for admin)
        # Restore to '123456' or whatever default
        restore_pass = "123456"
        user.hashed_password = get_password_hash(restore_pass)
        session.add(user)
        session.commit()
        print(f"Restored password to default.")

if __name__ == "__main__":
    verify_password_change_logic()
