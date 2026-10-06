FROM python:3.14-slim

# All dependencies ship binary wheels (psycopg[binary], Pillow, bcrypt), so
# no compiler or -dev packages are needed.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir --disable-pip-version-check --root-user-action=ignore -r requirements.txt

# Country database for the off-island listing review. Lives outside /app so
# the dev bind mount doesn't hide it; GEOIP_MONTH busts the cache monthly.
ARG GEOIP_MONTH=""
COPY tools/fetch_geoip.py /tmp/fetch_geoip.py
RUN python /tmp/fetch_geoip.py && rm /tmp/fetch_geoip.py

# uid 1000 matches the typical host user, so the dev bind mount stays writable.
RUN useradd --uid 1000 --create-home app && mkdir -p /app/app/uploads && chown -R app:app /app
COPY --chown=app:app . .
USER app

# Behind nginx: take the client IP from X-Forwarded-For, trusting only private
# (container network) hops so a client-supplied header can't spoof it.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload", \
     "--proxy-headers", "--forwarded-allow-ips", "172.16.0.0/12,10.0.0.0/8,192.168.0.0/16"]
