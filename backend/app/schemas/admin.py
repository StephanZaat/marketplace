from pydantic import BaseModel


class AdminToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    totp_required: bool = False


class AdminOut(BaseModel):
    id: int
    username: str
    totp_enabled: bool = False

    model_config = {"from_attributes": True}


class TotpVerifyIn(BaseModel):
    code: str


class TotpSetupOut(BaseModel):
    qr_uri: str
    secret: str
    enabled: bool
