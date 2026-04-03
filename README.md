# Marketplace.aw

A full-stack marketplace for buying and selling locally. Built for Aruba, deployable anywhere.

## Tech Stack

- **Backend**: FastAPI + PostgreSQL + SQLAlchemy 2 + Pydantic 2
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS 4
- **Auth**: OTP email login (passwordless) + JWT
- **Bot protection**: Friendly Captcha (proof-of-work, no tracking)
- **Storage**: Local files (dev) or S3-compatible object store (prod)
- **Email**: Any SMTP provider (Scaleway TEM, Proton, etc.)
- **Infra**: Docker Compose, nginx, Let's Encrypt

## Getting Started

```bash
cp .env.example .env
docker compose up --build
```

Open [http://localhost](http://localhost).

The first admin account is created from `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `.env`. Admin panel is at `/admin`.

## Features

- **Listings** — create, edit, delete with up to 10 photos, category attributes, condition, negotiability
- **Search & filter** — by category, price range, condition, keyword, custom attributes
- **User profiles** — bio, avatar, contact preferences, languages
- **Messaging** — per-listing conversations between buyer and seller
- **Ratings** — buyer/seller ratings after a transaction
- **Favorites** — save listings, get notified
- **Category alerts** — email notifications for new listings in categories you follow
- **Admin panel** — manage listings, users, reports, conversations, stats
- **SEO** — Open Graph and Twitter Card meta tags
- **i18n** — English and Spanish

## Project Structure

```
marketplace/
├── backend/                  FastAPI app
│   ├── app/
│   │   ├── models/           SQLAlchemy ORM
│   │   ├── schemas/          Pydantic request/response schemas
│   │   ├── routers/          API endpoints
│   │   ├── captcha.py        Friendly Captcha verification
│   │   ├── email.py          Transactional email templates
│   │   ├── scheduler.py      Background jobs (expiry, digests)
│   │   └── main.py           App entrypoint + migrations
│   └── tests/                Pytest suite (145 tests)
├── frontend/                 React + Vite app
│   └── src/
│       ├── pages/            Route pages
│       ├── components/       Reusable UI (SEO, FavoriteButton, etc.)
│       ├── hooks/            useFriendlyCaptcha, useFavorites
│       └── contexts/         Auth, favorites state
├── nginx/                    Reverse proxy configs
│   ├── prod.conf             Standalone prod (rate limiting, gzip, TLS)
│   └── nginx.dev.conf        Dev proxy
├── docker-compose.yml        Development
├── docker-compose.prod.yml   Production (standalone nginx + certbot)
└── docker-compose.test.yml   Test server overlay (shared_web network)
```

## Running Tests

```bash
docker compose run --rm test pytest -v
```

145 tests covering auth, listings, messages, ratings, favorites, categories, users, admin, and reports.

## Production Deployment

The app deploys as a standalone Docker stack with its own nginx and Let's Encrypt certbot:

```bash
docker compose -f docker-compose.prod.yml up -d
```

For the test server (shared nginx via `shared_web` network):

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.test.yml up -d
```

GitHub Actions workflow handles deployment automatically: push to `main` deploys to test, prod requires manual approval via GitHub environment protection.

### Required Secrets

See `.env.example` for all configuration options. At minimum you need:

- PostgreSQL credentials
- `SECRET_KEY` and `JWT_SECRET_KEY` (random strings)
- SMTP credentials for transactional email
- Domain name

Optional: S3 object storage, Friendly Captcha keys, backup bucket.

## API Overview

| Area | Endpoints |
|------|-----------|
| Auth | OTP send, OTP verify, current user |
| Listings | CRUD, search/filter, image upload, renew |
| Messages | Start conversation, send/receive, unread count |
| Ratings | Submit, pending, user stats |
| Favorites | Add, remove, list |
| Categories | List, tree with counts |
| Alerts | Subscribe to category notifications |
| Users | Public profile, update own profile, avatar |
| Admin | Manage listings/users/reports, stats, conversations |
| Reports | Submit and moderate reported listings |
| Contact | Contact form (captcha-protected) |

## License

[MIT](LICENSE)
