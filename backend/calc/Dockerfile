FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY app.js calculator.js ./

EXPOSE 3000

CMD ["npm", "start"]
