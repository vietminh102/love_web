from pydantic import BaseModel
from typing import List
class PrizeItem(BaseModel):
    id: int
    text: str
    color: str
    textColor: str

class UpdateWheelRequest(BaseModel):
    prizes: List[PrizeItem]

class WheelNotifyRequest(BaseModel):
    result: str
class SyncSpinRequest(BaseModel):
    prize_index: int
    is_auto_delete: bool = False