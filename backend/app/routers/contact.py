from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel, EmailStr
from app.limiter import limiter

router = APIRouter(prefix="/contact", tags=["contact"])


class ContactForm(BaseModel):
    name: str
    email: EmailStr
    subject: str
    message: str
    frc_captcha_response: str | None = None


@router.post("", status_code=202)
@limiter.limit("5/hour")
async def submit_contact(request: Request, data: ContactForm, background_tasks: BackgroundTasks):
    from app.captcha import verify_captcha
    if not verify_captcha(data.frc_captcha_response):
        raise HTTPException(status_code=400, detail="Captcha verification failed")
    from app import email as mail
    background_tasks.add_task(
        mail.send_contact_form,
        name=data.name,
        email=data.email,
        subject=data.subject,
        message=data.message,
    )
    return {"detail": "Your message has been sent. We'll get back to you shortly."}
