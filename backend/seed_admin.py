from app.db.database import SessionLocal
from app.models.models import User
import bcrypt
import uuid

db = SessionLocal()

email = "admin@goteeoff.com"
existing = db.query(User).filter(User.email == email).first()
if existing:
    print("Admin already exists:", email)
else:
    password = "ChangeMe123!"
    pw_bytes = password.encode("utf-8")[:72]
    hashed = bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode("utf-8")

    admin = User(
        id=uuid.uuid4(),
        email=email,
        full_name="Admin",
        hashed_password=hashed,
        is_active=True,
        is_admin=True,
    )
    db.add(admin)
    db.commit()
    print("Admin created:", email)

db.close()