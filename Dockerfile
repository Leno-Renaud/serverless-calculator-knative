FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

RUN apk add --no-cache python3 py3-pip && \
    pip3 install flask --break-system-packages

COPY . .

EXPOSE 3000

# Démarre le worker Python (port 8000) puis le backend Node (port 3000)
CMD ["sh", "-c", "python3 worker.py & npm start"]
