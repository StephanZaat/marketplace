from fastapi import APIRouter, BackgroundTasks, Request
from pydantic import BaseModel, EmailStr
from app.limiter import limiter

router = APIRouter(prefix="/contact", tags=["contact"])


class ContactForm(BaseModel):
    name: str
    email: EmailStr
    subject: str
    message: str


@router.post("", status_code=202)
@limiter.limit("5/hour")
async def submit_contact(request: Request, data: ContactForm, background_tasks: BackgroundTasks):
    from app import email as mail
    background_tasks.add_task(
        mail.send_contact_form,
        name=data.name,
        email=data.email,
        subject=data.subject,
        message=data.message,
    )
    return {"detail": "Your message has been sent. We'll get back to you shortly."}
