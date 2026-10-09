FROM python:3.12-alpine

WORKDIR /app
COPY inspector.py /app/inspector.py

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    LISTEN_PORT=8090 \
    UPSTREAM_HOST=backend \
    UPSTREAM_PORT=8080 \
    LOG_FILE=/logs/inspector.log

EXPOSE 8090
CMD ["python", "-u", "/app/inspector.py"]
