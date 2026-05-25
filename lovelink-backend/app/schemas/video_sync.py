from pydantic import BaseModel
from typing import Any, Optional

class VideoSyncRequest(BaseModel):
    action: str
    payload: Optional[Any] = None