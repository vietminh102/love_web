from pydantic import BaseModel
from datetime import datetime

class PairRequest(BaseModel):
    pairing_code: str
class UpdateStartDateRequest(BaseModel):
    new_start_date: datetime