"""
Email service — Proton SMTP (smtp.protonmail.ch:587, STARTTLS).

All send_* helpers are async fire-and-forget: call with asyncio.create_task()
or await directly.  They silently log errors rather than crashing the request.
"""
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib
from jinja2 import Environment, BaseLoader

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_jinja = Environment(loader=BaseLoader(), autoescape=True)


def _render(template_str: str, **ctx) -> str:
    return _jinja.from_string(template_str).render(**ctx)


async def _send(to: str, subject: str, html: str, text: str | None = None) -> None:
    """Send an email via Proton SMTP bridge (STARTTLS on port 587)."""
    if not settings.smtp_user or not settings.smtp_password:
        logger.warning("SMTP credentials not configured — skipping email to %s", to)
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.email_from
    msg["To"] = to

    if text:
        msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_user,
            password=settings.smtp_password,
            start_tls=True,
        )
        logger.info("Email sent to %s: %s", to, subject)
    except Exception:
        logger.exception("Failed to send email to %s", to)


# ── Shared layout helpers ───────────────────────────────────────────────────────
# Design matches the site: ocean-500 (#418FDE) header, Aruba flag, white card body.

# Aruba flag as inline SVG (scaled for email)
_FLAG_SVG = """<svg width="36" height="24" viewBox="0 0 24 16" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:inline-block;vertical-align:middle;border-radius:2px">
  <rect width="24" height="16" fill="#418FDE" rx="1.5"/>
  <rect x="0" y="10.5" width="24" height="1.6" fill="#FBE122"/>
  <rect x="0" y="13"   width="24" height="1.6" fill="#FBE122"/>
  <path d="M5 2 L5.55 3.8 L7.4 3.8 L5.9 4.9 L6.5 6.7 L5 5.55 L3.5 6.7 L4.1 4.9 L2.6 3.8 L4.45 3.8 Z" fill="white"/>
  <path d="M5 2.5 L5.45 3.95 L7 3.95 L5.75 4.85 L6.2 6.3 L5 5.35 L3.8 6.3 L4.25 4.85 L3 3.95 L4.55 3.95 Z" fill="#C8102E"/>
</svg>"""

_HEADER = """
<tr>
  <td style="background:#418FDE;padding:28px 40px;text-align:center">
    <div style="margin-bottom:12px">""" + _FLAG_SVG + """</div>
    <p style="margin:0 0 6px;color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-0.3px;font-family:Inter,system-ui,sans-serif">Marketplace.aw</p>
    <p style="margin:0;color:#dbeafe;font-size:13px;font-weight:400;font-family:Inter,system-ui,sans-serif">{{ heading }}</p>
  </td>
</tr>
"""

_FOOTER = """
<tr>
  <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center">
    <p style="margin:0 0 4px;color:#64748b;font-size:12px;font-family:Inter,system-ui,sans-serif">Marketplace.aw &mdash; Aruba's local marketplace</p>
    <p style="margin:0;color:#94a3b8;font-size:11px;font-family:Inter,system-ui,sans-serif">&copy; 2026 Marketplace.aw &middot; All rights reserved</p>
  </td>
</tr>
"""

_WRAP_START = """<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eef5fc;font-family:Inter,system-ui,sans-serif;color:#1e293b">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#eef5fc;padding:32px 16px">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 4px 24px rgba(65,143,222,0.08)">"""

_WRAP_END = """
      </table>
    </td></tr>
  </table>
</body>
</html>"""


# ── Welcome email (on registration) ────────────────────────────────────────────

_WELCOME_HTML = _WRAP_START + _HEADER + """
<tr>
  <td style="padding:36px 40px">
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6">Hi <strong>{{ username }}</strong>,</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#475569">
      Welcome to <strong style="color:#2d7ac8">Marketplace.aw</strong>! You're all set to start buying and selling
      second-hand items across Aruba.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
      <tr><td align="center">
        <a href="{{ site_url }}"
           style="display:inline-block;background:#2d7ac8;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px">
          Browse Listings →
        </a>
      </td></tr>
    </table>
    <p style="margin:0;font-size:14px;color:#64748b;line-height:1.6">Happy selling!<br>
      <strong style="color:#2d7ac8">The Marketplace.aw Team</strong>
    </p>
  </td>
</tr>
""" + _FOOTER + _WRAP_END

_WELCOME_TEXT = """\
Welcome to Marketplace.aw, {{ username }}!

You're all set to start buying and selling second-hand items across Aruba.

Visit {{ site_url }} to browse listings.

Happy selling!
The Marketplace.aw Team
"""


# ── New listing confirmation (to seller) ───────────────────────────────────────

_NEW_LISTING_HTML = _WRAP_START + _HEADER + """
<tr>
  <td style="padding:36px 40px">
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6">Hi <strong>{{ username }}</strong>,</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#475569">
      Your listing is now live on <strong style="color:#2d7ac8">Marketplace.aw</strong>!
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border-radius:8px;border:1px solid #bae6fd;margin-bottom:24px">
      <tr><td style="padding:20px 24px">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding:9px 0;color:#64748b;font-size:13px;width:35%;border-bottom:1px solid #e0f2fe">Title</td>
            <td style="padding:9px 0;font-size:13px;font-weight:600;color:#1e293b;border-bottom:1px solid #e0f2fe">{{ title }}</td>
          </tr>
          <tr>
            <td style="padding:9px 0;color:#64748b;font-size:13px;border-bottom:1px solid #e0f2fe">Price</td>
            <td style="padding:9px 0;font-size:13px;font-weight:600;color:#1e293b;border-bottom:1px solid #e0f2fe">AWG {{ price }}</td>
          </tr>
          <tr>
            <td style="padding:9px 0;color:#64748b;font-size:13px">Category</td>
            <td style="padding:9px 0;font-size:13px;font-weight:600;color:#1e293b">{{ category }}</td>
          </tr>
        </table>
      </td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
      <tr><td align="center">
        <a href="{{ listing_url }}"
           style="display:inline-block;background:#2d7ac8;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px">
          View Your Listing →
        </a>
      </td></tr>
    </table>

    <p style="margin:0;font-size:14px;color:#64748b;line-height:1.6">
      Good luck with your sale!<br>
      <strong style="color:#2d7ac8">The Marketplace.aw Team</strong>
    </p>
  </td>
</tr>
""" + _FOOTER + _WRAP_END

_NEW_LISTING_TEXT = """\
Hi {{ username }},

Your listing "{{ title }}" is now live on Marketplace.aw!

Price    : AWG {{ price }}
Category : {{ category }}

View it here: {{ listing_url }}

Good luck with your sale!
The Marketplace.aw Team
"""


# ── New message notification ────────────────────────────────────────────────────

_NEW_MESSAGE_HTML = _WRAP_START + _HEADER + """
<tr>
  <td style="padding:36px 40px">
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6">Hi <strong>{{ recipient_name }}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#475569">
      <strong>{{ sender_name }}</strong> sent you a message about
      <strong style="color:#2d7ac8">{{ listing_title }}</strong>.
    </p>

    <div style="background:#f8fafc;border-left:3px solid #5aa1e3;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:24px">
      <p style="margin:0;font-size:14px;line-height:1.7;color:#334155;white-space:pre-wrap">{{ message_body }}</p>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
      <tr><td align="center">
        <a href="{{ conversation_url }}"
           style="display:inline-block;background:#2d7ac8;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px">
          Reply →
        </a>
      </td></tr>
    </table>

    <p style="margin:0;font-size:13px;color:#94a3b8;line-height:1.6">
      You're receiving this because you have an account on Marketplace.aw.
    </p>
  </td>
</tr>
""" + _FOOTER + _WRAP_END

_NEW_MESSAGE_TEXT = """\
Hi {{ recipient_name }},

{{ sender_name }} sent you a message about "{{ listing_title }}":

{{ message_body }}

Reply here: {{ conversation_url }}

The Marketplace.aw Team
"""


# ── Listing expiry reminder (30 days old) ──────────────────────────────────────

_LISTING_REMINDER_HTML = _WRAP_START + _HEADER + """
<tr>
  <td style="padding:36px 40px">
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6">Hi <strong>{{ username }}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#475569">
      Your listing has been active for 30 days. Did you sell it? Please update its status so other buyers know.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff;border-radius:8px;border:1px solid #bae6fd;margin-bottom:24px">
      <tr><td style="padding:16px 20px">
        <p style="margin:0;font-size:14px;font-weight:600;color:#1e293b">{{ title }}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#64748b">AWG {{ price }}</p>
      </td></tr>
    </table>

    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#475569">
      <strong>If you already sold it</strong>, mark it as sold on your listing page.<br>
      <strong>If it's still available</strong>, no action needed — it stays active.<br>
      <strong>If you'd like to remove it</strong>, you can delete it from your profile.
    </p>

    <p style="margin:0 0 8px;font-size:13px;color:#ef4444;line-height:1.6">
      ⚠️ If no action is taken within 7 days, the listing will be automatically marked as sold.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0">
      <tr><td align="center">
        <a href="{{ listing_url }}"
           style="display:inline-block;background:#2d7ac8;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px">
          View Listing →
        </a>
      </td></tr>
    </table>

    <p style="margin:0;font-size:14px;color:#64748b">
      <strong style="color:#2d7ac8">The Marketplace.aw Team</strong>
    </p>
  </td>
</tr>
""" + _FOOTER + _WRAP_END

_LISTING_REMINDER_TEXT = """\
Hi {{ username }},

Your listing "{{ title }}" (AWG {{ price }}) has been active for 30 days.

Did you sell it? Please mark it as sold on your listing page.

If no action is taken within 7 days, the listing will be automatically marked as sold.

View your listing: {{ listing_url }}

The Marketplace.aw Team
"""


# ── Listing expiry warning (7 days before expiry) ──────────────────────────────

_LISTING_EXPIRY_WARNING_HTML = _WRAP_START + _HEADER + """
<tr>
  <td style="padding:36px 40px">
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6">Hi <strong>{{ username }}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#475569">
      Your listing will <strong style="color:#ef4444">expire in {{ days_left }} days</strong> due to inactivity.
      Renew it now to keep it visible to buyers.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff7ed;border-radius:8px;border:1px solid #fed7aa;margin-bottom:24px">
      <tr><td style="padding:16px 20px">
        <p style="margin:0;font-size:14px;font-weight:600;color:#1e293b">{{ title }}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#64748b">AWG {{ price }}</p>
      </td></tr>
    </table>

    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#475569">
      <strong>Still selling?</strong> Click below to renew your listing and reset the 30-day timer.<br>
      <strong>Already sold it?</strong> Mark it as sold on your listing page.<br>
      <strong>Want to remove it?</strong> You can delete it from your profile.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0">
      <tr><td align="center">
        <a href="{{ listing_url }}"
           style="display:inline-block;background:#2d7ac8;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px">
          Renew Listing →
        </a>
      </td></tr>
    </table>

    <p style="margin:0;font-size:14px;color:#64748b">
      <strong style="color:#2d7ac8">The Marketplace.aw Team</strong>
    </p>
  </td>
</tr>
""" + _FOOTER + _WRAP_END

_LISTING_EXPIRY_WARNING_TEXT = """\
Hi {{ username }},

Your listing "{{ title }}" (AWG {{ price }}) will expire in {{ days_left }} days due to inactivity.

Renew it to keep it visible: {{ listing_url }}

If it's already sold, mark it as sold on your listing page.

The Marketplace.aw Team
"""


# ── Listing expired notification ────────────────────────────────────────────────

_LISTING_EXPIRED_HTML = _WRAP_START + _HEADER + """
<tr>
  <td style="padding:36px 40px">
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6">Hi <strong>{{ username }}</strong>,</p>
    <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#475569">
      Your listing has <strong style="color:#ef4444">expired</strong> after 30 days of inactivity
      and is no longer visible to buyers.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border-radius:8px;border:1px solid #fecaca;margin-bottom:24px">
      <tr><td style="padding:16px 20px">
        <p style="margin:0;font-size:14px;font-weight:600;color:#1e293b">{{ title }}</p>
        <p style="margin:4px 0 0;font-size:13px;color:#64748b">AWG {{ price }}</p>
      </td></tr>
    </table>

    <p style="margin:0 0 20px;font-size:14px;line-height:1.7;color:#475569">
      <strong>Still want to sell it?</strong> You can renew your listing to make it active again.<br>
      Expired listings are permanently deleted after 30 days.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0">
      <tr><td align="center">
        <a href="{{ listing_url }}"
           style="display:inline-block;background:#2d7ac8;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px">
          Renew Listing →
        </a>
      </td></tr>
    </table>

    <p style="margin:0;font-size:14px;color:#64748b">
      <strong style="color:#2d7ac8">The Marketplace.aw Team</strong>
    </p>
  </td>
</tr>
""" + _FOOTER + _WRAP_END

_LISTING_EXPIRED_TEXT = """\
Hi {{ username }},

Your listing "{{ title }}" (AWG {{ price }}) has expired after 30 days of inactivity.
It is no longer visible to buyers.

You can still renew it here: {{ listing_url }}

Expired listings are permanently deleted after 30 days.

The Marketplace.aw Team
"""


# ── Password reset ─────────────────────────────────────────────────────────────

_PASSWORD_RESET_HTML = _WRAP_START + _HEADER + """
<tr>
  <td style="padding:36px 40px">
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6">Hi <strong>{{ username }}</strong>,</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#475569">
      We received a request to reset your password. Click the button below to set a new one.
      This link is valid for <strong>1 hour</strong>.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
      <tr><td align="center">
        <a href="{{ reset_url }}"
           style="display:inline-block;background:#2d7ac8;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px">
          Reset Password →
        </a>
      </td></tr>
    </table>

    <p style="margin:0 0 16px;font-size:14px;color:#64748b;line-height:1.6">
      If you didn't request a password reset, you can safely ignore this email.
      Your password will not change.
    </p>
    <p style="margin:0;font-size:14px;color:#64748b">
      <strong style="color:#2d7ac8">The Marketplace.aw Team</strong>
    </p>
  </td>
</tr>
""" + _FOOTER + _WRAP_END

_PASSWORD_RESET_TEXT = """\
Hi {{ username }},

We received a request to reset your password. Use the link below (valid for 1 hour):

{{ reset_url }}

If you didn't request this, ignore this email — your password won't change.

The Marketplace.aw Team
"""


# ── Public helpers ─────────────────────────────────────────────────────────────

async def send_welcome(user) -> None:
    """Send a welcome email after registration."""
    ctx = dict(username=user.full_name or user.email, site_url=settings.site_url)
    await _send(
        to=user.email,
        subject="Welcome to Marketplace.aw!",
        html=_render(_WELCOME_HTML, heading="Welcome!", **ctx),
        text=_render(_WELCOME_TEXT, **ctx),
    )


async def send_new_listing(user, listing, category_name: str) -> None:
    """Notify seller that their listing is live."""
    ctx = dict(
        username=user.full_name or user.email,
        title=listing.title,
        price=f"{listing.price:,.2f}",
        category=category_name,
        listing_url=f"{settings.site_url}/listings/{listing.public_id}",
    )
    await _send(
        to=user.email,
        subject=f"Your listing \"{listing.title}\" is now live",
        html=_render(_NEW_LISTING_HTML, heading="Listing Published ✓", **ctx),
        text=_render(_NEW_LISTING_TEXT, **ctx),
    )


async def send_new_message(
    *,
    recipient_email: str,
    recipient_name: str,
    sender_name: str,
    listing_title: str,
    message_body: str,
    conversation_id: str,
) -> None:
    """Notify a user (seller or buyer) that they received a new message."""
    ctx = dict(
        recipient_name=recipient_name,
        sender_name=sender_name,
        listing_title=listing_title,
        message_body=message_body,
        conversation_url=f"{settings.site_url}/messages/{conversation_id}",
    )
    await _send(
        to=recipient_email,
        subject=f"New message from {sender_name} — Marketplace.aw",
        html=_render(_NEW_MESSAGE_HTML, heading="New Message", **ctx),
        text=_render(_NEW_MESSAGE_TEXT, **ctx),
    )


async def send_listing_reminder(user, listing) -> None:
    """30-day expiry reminder to seller."""
    ctx = dict(
        username=user.full_name or user.email,
        title=listing.title,
        price=f"{listing.price:,.2f}",
        listing_url=f"{settings.site_url}/listings/{listing.public_id}",
    )
    await _send(
        to=user.email,
        subject=f"Is \"{listing.title}\" still available?",
        html=_render(_LISTING_REMINDER_HTML, heading="Your Listing — Action Needed", **ctx),
        text=_render(_LISTING_REMINDER_TEXT, **ctx),
    )


async def send_listing_expiry_warning(user, listing) -> None:
    """Warning email sent 7 days before a listing expires (after 23 days of inactivity)."""
    days_left = 7
    ctx = dict(
        username=user.full_name or user.email,
        title=listing.title,
        price=f"{listing.price:,.2f}",
        days_left=days_left,
        listing_url=f"{settings.site_url}/listings/{listing.public_id}",
    )
    await _send(
        to=user.email,
        subject=f"Your listing \"{listing.title}\" expires in {days_left} days",
        html=_render(_LISTING_EXPIRY_WARNING_HTML, heading="Listing Expiring Soon", **ctx),
        text=_render(_LISTING_EXPIRY_WARNING_TEXT, **ctx),
    )


async def send_listing_expired(user, listing) -> None:
    """Notification email sent when a listing has been marked as expired."""
    ctx = dict(
        username=user.full_name or user.email,
        title=listing.title,
        price=f"{listing.price:,.2f}",
        listing_url=f"{settings.site_url}/listings/{listing.public_id}",
    )
    await _send(
        to=user.email,
        subject=f"Your listing \"{listing.title}\" has expired",
        html=_render(_LISTING_EXPIRED_HTML, heading="Listing Expired", **ctx),
        text=_render(_LISTING_EXPIRED_TEXT, **ctx),
    )


async def send_password_reset(to_email: str, username: str, token: str) -> None:
    """Send a password-reset link."""
    reset_url = f"{settings.site_url}/reset-password?token={token}"
    ctx = dict(username=username, reset_url=reset_url)
    await _send(
        to=to_email,
        subject="Reset your Marketplace.aw password",
        html=_render(_PASSWORD_RESET_HTML, heading="Password Reset", **ctx),
        text=_render(_PASSWORD_RESET_TEXT, **ctx),
    )


# ── Daily category digest ───────────────────────────────────────────────────────

_CATEGORY_DIGEST_HTML = _WRAP_START + _HEADER + """
<tr>
  <td style="padding:36px 40px">
    <p style="margin:0 0 16px;font-size:16px;line-height:1.6">Hi <strong>{{ username }}</strong>,</p>
    <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#475569">
      Here are today's new listings in the categories you're watching.
    </p>

    {% for group in groups %}
    <p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:8px">
      {{ group.category_name }}
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px">
      {% for item in group.listings %}
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;vertical-align:top">
          <a href="{{ site_url }}/listings/{{ item.id }}"
             style="font-size:14px;font-weight:600;color:#2d7ac8;text-decoration:none">{{ item.title }}</a>
          <span style="margin-left:10px;font-size:13px;color:#64748b">
            {% if item.price == "0.00" %}Free{% else %}AWG {{ item.price }}{% endif %}
          </span>
          <span style="margin-left:8px;font-size:12px;color:#94a3b8">· {{ item.location }}</span>
        </td>
      </tr>
      {% endfor %}
    </table>
    {% endfor %}

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">
      <tr><td align="center">
        <a href="{{ site_url }}/listings"
           style="display:inline-block;background:#2d7ac8;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:8px">
          Browse All Listings →
        </a>
      </td></tr>
    </table>

    <p style="margin:20px 0 0;font-size:12px;color:#94a3b8;text-align:center">
      You're receiving this because you subscribed to category alerts.<br>
      <a href="{{ site_url }}/profile/{{ user_id }}" style="color:#94a3b8">Manage your alerts</a>
    </p>
  </td>
</tr>
""" + _FOOTER + _WRAP_END

_CATEGORY_DIGEST_TEXT = """\
Hi {{ username }},

Here are today's new listings in the categories you're watching:

{% for group in groups %}
{{ group.category_name }}
{% for item in group.listings %}
  - {{ item.title }} — AWG {{ item.price }}{% if item.location %} ({{ item.location }}){% endif %}
    {{ site_url }}/listings/{{ item.id }}
{% endfor %}

{% endfor %}
Browse all listings: {{ site_url }}/listings

To manage your alerts: {{ site_url }}/profile/{{ user_id }}

The Marketplace.aw Team
"""


async def send_category_digest(user, groups: list) -> None:
    """Send a daily digest of new listings grouped by watched category."""
    total = sum(len(g["listings"]) for g in groups)
    if total == 0:
        return
    ctx = dict(
        username=user.full_name or user.email,
        groups=groups,
        site_url=settings.site_url,
        user_id=user.id,
    )
    plural = "" if total == 1 else "s"
    await _send(
        to=user.email,
        subject=f"{total} new listing{plural} in your watched categories",
        html=_render(_CATEGORY_DIGEST_HTML, heading="Your Daily Digest", **ctx),
        text=_render(_CATEGORY_DIGEST_TEXT, **ctx),
    )


async def send_contact_form(*, name: str, email: str, subject: str, message: str) -> None:
    """Forward a contact form submission to the support inbox."""
    _CONTACT_FORM_HTML = """
    <h2>New Contact Form Submission</h2>
    <p><strong>From:</strong> {{ name }} &lt;{{ email }}&gt;</p>
    <p><strong>Subject:</strong> {{ subject }}</p>
    <hr>
    <p style="white-space:pre-wrap">{{ message }}</p>
    """
    html = _render(_CONTACT_FORM_HTML, name=name, email=email, subject=subject, message=message)
    text = f"From: {name} <{email}>\nSubject: {subject}\n\n{message}"
    await _send(
        to=settings.support_email,
        subject=f"[Contact] {subject}",
        html=html,
        text=text,
    )
