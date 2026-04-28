FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

RUN apk add --no-cache python3

COPY . .

EXPOSE 3000

CMD ["npm", "start"]
