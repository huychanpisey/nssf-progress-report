# Production Dockerfile for NSSF IT Progress Report
FROM node:20-alpine

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./
RUN npm install --omit=dev

# Copy application files
COPY . .

# Set environment
ENV PORT=8080
ENV HOST=0.0.0.0
ENV NODE_ENV=production

EXPOSE 8080

# Persist data directory
VOLUME ["/app/data"]

CMD ["node", "server.js"]
