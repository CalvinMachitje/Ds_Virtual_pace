# services/auth-service/app/dependencies/auth.py
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
import jwt
from app.core.config import settings
from app.utils.redis_utils import safe_redis_call


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=["HS256"])

        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")

        jti = payload.get("jti")
        if safe_redis_call("get", f"blacklist:{jti}") == "true":
            raise HTTPException(status_code=401, detail="Token has been revoked")

        return payload.get("sub")
    except JWTError:
        raise credentials_exception