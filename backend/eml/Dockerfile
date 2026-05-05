FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY eml.py ./eml.py

EXPOSE 10000

CMD ["python", "eml.py"]