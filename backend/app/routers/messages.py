from typing import List
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.listing import Listing
from app.models.message import Conversation, Message
from app.models.user import User
from app.resolve import (
    resolve_public_id, _build_pid_map,
    conversation_to_public_dict, message_to_public_dict,
    listing_to_public_dict, user_to_public_dict,
)
from app.routers.auth import get_current_user
from app.schemas.message import MessageCreate, MessageOut, ConversationOut, ConversationDetail
from app.schemas.listing import ListingOut
from app.schemas.user import UserPublic

router = APIRouter(prefix="/messages", tags=["messages"])


def _get_conversation_or_404(conv_public_id: str, user_id: int, db: Session) -> Conversation:
    conv = db.query(Conversation).filter(Conversation.public_id == conv_public_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.buyer_id != user_id and conv.seller_id != user_id:
        raise HTTPException(status_code=403, detail="Not part of this conversation")
    return conv


def _build_conversation_detail(conv: Conversation, db: Session, current_user_id: int) -> dict:
    """Build a ConversationDetail dict with all public IDs resolved."""
    listing = db.query(Listing).filter(Listing.id == conv.listing_id).first()
    buyer = db.query(User).filter(User.id == conv.buyer_id).first()
    seller = db.query(User).filter(User.id == conv.seller_id).first()
    messages = db.query(Message).filter(Message.conversation_id == conv.id).order_by(Message.created_at).all()

    conv_dict = conversation_to_public_dict(conv, db)
    conv_dict["listing"] = listing_to_public_dict(listing, db) if listing else None
    if buyer:
        bd = user_to_public_dict(buyer)
        conv_dict["buyer"] = bd
    else:
        conv_dict["buyer"] = None
    if seller:
        sd = user_to_public_dict(seller)
        conv_dict["seller"] = sd
    else:
        conv_dict["seller"] = None
    conv_dict["messages"] = [message_to_public_dict(m, db) for m in messages]
    conv_dict["unread_count"] = 0
    return conv_dict


@router.get("/unread")
def unread_count(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    count = db.query(Message).filter(
        Message.sender_id != current_user.id,
        Message.is_read == False,
        Message.conversation_id.in_(
            db.query(Conversation.id).filter(
                (Conversation.buyer_id == current_user.id) | (Conversation.seller_id == current_user.id)
            )
        ),
    ).count()
    return {"count": count}


@router.get("", response_model=List[ConversationDetail])
def list_conversations(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    convs = db.query(Conversation).filter(
        (Conversation.buyer_id == current_user.id) | (Conversation.seller_id == current_user.id)
    ).order_by(Conversation.updated_at.desc()).all()

    result = []
    for conv in convs:
        detail = _build_conversation_detail(conv, db, current_user.id)
        # Compute unread for this conversation
        unread = db.query(Message).filter(
            Message.conversation_id == conv.id,
            Message.sender_id != current_user.id,
            Message.is_read == False,
        ).count()
        detail["unread_count"] = unread
        result.append(detail)
    return result


@router.post("/start/{listing_id}", response_model=ConversationDetail, status_code=201)
def start_conversation(
    listing_id: str,
    data: MessageCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    listing = resolve_public_id(db, Listing, listing_id, "Listing")
    if listing.seller_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")

    # Reuse existing conversation if it exists
    conv = db.query(Conversation).filter(
        Conversation.listing_id == listing.id,
        Conversation.buyer_id == current_user.id,
    ).first()

    if not conv:
        conv = Conversation(
            listing_id=listing.id,
            buyer_id=current_user.id,
            seller_id=listing.seller_id,
        )
        db.add(conv)
        db.flush()

    msg = Message(conversation_id=conv.id, sender_id=current_user.id, body=data.body)
    db.add(msg)
    db.commit()
    db.refresh(conv)

    detail = _build_conversation_detail(conv, db, current_user.id)

    # Notify the seller about the new message
    seller = db.query(User).filter(User.id == conv.seller_id).first()
    buyer = db.query(User).filter(User.id == conv.buyer_id).first()
    from app import email as mail
    background_tasks.add_task(
        mail.send_new_message,
        recipient_email=seller.email,
        recipient_name=seller.full_name or seller.email,
        sender_name=buyer.full_name or buyer.email,
        listing_title=listing.title,
        message_body=data.body,
        conversation_id=conv.public_id,
    )

    return detail


@router.get("/{conv_id}", response_model=ConversationDetail)
def get_conversation(conv_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    conv = _get_conversation_or_404(conv_id, current_user.id, db)

    # Mark messages as read
    db.query(Message).filter(
        Message.conversation_id == conv.id,
        Message.sender_id != current_user.id,
        Message.is_read == False,
    ).update({"is_read": True})
    db.commit()

    detail = _build_conversation_detail(conv, db, current_user.id)
    return detail


@router.post("/{conv_id}", response_model=MessageOut, status_code=201)
def send_message(
    conv_id: str,
    data: MessageCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = _get_conversation_or_404(conv_id, current_user.id, db)
    msg = Message(conversation_id=conv.id, sender_id=current_user.id, body=data.body)
    db.add(msg)
    from datetime import datetime, timezone
    conv.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(msg)

    # Notify the other party
    other_id = conv.seller_id if current_user.id == conv.buyer_id else conv.buyer_id
    other = db.query(User).filter(User.id == other_id).first()
    listing = db.query(Listing).filter(Listing.id == conv.listing_id).first()
    if other and listing:
        from app import email as mail
        background_tasks.add_task(
            mail.send_new_message,
            recipient_email=other.email,
            recipient_name=other.full_name or other.email,
            sender_name=current_user.full_name or current_user.email,
            listing_title=listing.title,
            message_body=data.body,
            conversation_id=conv.public_id,
        )

    return message_to_public_dict(msg, db)


@router.get("/by-listing/{listing_id}")
def conversations_for_listing(
    listing_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all conversations for a listing the current user owns."""
    listing = resolve_public_id(db, Listing, listing_id, "Listing")
    if listing.seller_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your listing")
    convs = db.query(Conversation).filter(Conversation.listing_id == listing.id).order_by(Conversation.updated_at.desc()).all()
    buyer_ids = {c.buyer_id for c in convs}
    buyer_pid_map = _build_pid_map(db, User, buyer_ids)
    result = []
    for conv in convs:
        buyer = db.query(User).filter(User.id == conv.buyer_id).first()
        result.append({
            "conversation_id": conv.public_id,
            "buyer_id": buyer_pid_map.get(conv.buyer_id, ""),
            "buyer_name": buyer.full_name if buyer else None,
        })
    return result
