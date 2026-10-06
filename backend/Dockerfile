FROM python:3.14-slim

# All dependencies ship binary wheels (psycopg[binary], Pillow, bcrypt), so
# no compiler or -dev packages are needed.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --disable-pip-version-check --root-user-action=ignore -r requirements.txt

# uid 1000 matches the typical host user, so the dev bind mount stays writable.
RUN useradd --uid 1000 --create-home app && mkdir -p /app/app/uploads && chown -R app:app /app
COPY --chown=app:app . .
USER app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
