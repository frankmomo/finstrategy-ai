FROM python:3.12-slim

WORKDIR /app
ENV PYTHONUNBUFFERED=1

COPY apps/api/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY apps/api ./api
COPY apps/worker ./worker
COPY migrations ./migrations
COPY scripts ./scripts

CMD ["python", "worker/realtime_worker.py"]
