from pydantic import BaseModel

class PairRequest(BaseModel):
    pairing_code: str