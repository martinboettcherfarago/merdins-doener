FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY vinted_bot ./vinted_bot

# config.yaml und Datenbank liegen im Ordner /data (als Volume einbinden)
ENV VINTED_BOT_CONFIG=/data/config.yaml PYTHONUNBUFFERED=1
VOLUME ["/data"]
CMD ["python", "-m", "vinted_bot", "run"]
