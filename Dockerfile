FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY dist/ dist/
COPY bin/ bin/

EXPOSE 3000

CMD ["node", "dist/src/index.js"]
