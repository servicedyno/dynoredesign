FROM node:20-alpine

WORKDIR /app

# Copy package files first for better caching
COPY backend/package.json ./package.json
COPY backend/yarn.lock ./yarn.lock

# Install dependencies
RUN yarn install --frozen-lockfile --ignore-engines || yarn install --ignore-engines

# Copy all backend source code
COPY backend/ .

# Build TypeScript
RUN yarn build

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8001/health || exit 1

# Start the server
CMD ["node", "dist/server.js"]
