import uuid
from datetime import datetime
import os
import oss2
from dotenv import load_dotenv

# Load env from .env file
load_dotenv()

ACCESS_KEY_ID = os.getenv("OSS_ACCESS_KEY_ID")
ACCESS_KEY_SECRET = os.getenv("OSS_ACCESS_KEY_SECRET")
ENDPOINT = os.getenv("OSS_ENDPOINT")
BUCKET_NAME = os.getenv("OSS_BUCKET_NAME")

# Initialize Bucket if credentials exist
bucket = None
if ACCESS_KEY_ID and ACCESS_KEY_SECRET and ENDPOINT and BUCKET_NAME:
    auth = oss2.Auth(ACCESS_KEY_ID, ACCESS_KEY_SECRET)
    bucket = oss2.Bucket(auth, ENDPOINT, BUCKET_NAME)

class StorageService:
    @staticmethod
    def generate_oss_key(filename: str) -> str:
        """
        Generate a standardized OSS key: {year}/{month}/{uuid}_{filename}
        """
        now = datetime.now()
        year = now.strftime("%Y")
        month = now.strftime("%m")
        unique_id = str(uuid.uuid4())
        return f"{year}/{month}/{unique_id}_{filename}"

    @staticmethod
    def upload_file(oss_key: str, data: bytes) -> bool:
        """
        Upload data to OSS. Returns True if successful.
        If OSS is not configured, fallback to local (or return False). 
        To allow seamless switch, we check 'bucket'.
        """
        if bucket:
            try:
                bucket.put_object(oss_key, data)
                return True
            except Exception as e:
                print(f"OSS Upload Error: {e}")
                return False
        else:
            # Fallback to local 'uploads' directory
            local_path = os.path.join("uploads", oss_key)
            try:
                os.makedirs(os.path.dirname(local_path), exist_ok=True)
                with open(local_path, "wb") as f:
                    f.write(data)
                return True
            except Exception as e:
                print(f"Local Upload Error: {e}")
                return False

    @staticmethod
    def delete_file(oss_key: str) -> bool:
        if bucket:
            try:
                bucket.delete_object(oss_key)
                return True
            except Exception as e:
                print(f"OSS Delete Error: {e}")
                return False
        else:
             # Fallback
            local_path = os.path.join("uploads", oss_key)
            if os.path.exists(local_path):
                try:
                    os.remove(local_path)
                    return True
                except Exception as e:
                    print(f"Local Delete Error: {e}")
                    return False
            return True

    @staticmethod
    def get_presigned_url(oss_key: str) -> str:
        """
        Generate presigned URL for secure access.
        """
        if bucket:
            # Generate URL valid for 1 hour (3600 seconds)
            return bucket.sign_url('GET', oss_key, 3600)
        else:
            # Local dev fallback
            return f"http://localhost:8000/static/uploads/{oss_key}"
