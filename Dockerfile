FROM node:20-alpine

WORKDIR /app

# Copy all backend source code
COPY backend/ .

# Install dependencies (without frozen lockfile since it might not exist)
RUN yarn install --ignore-engines

# Build TypeScript
RUN yarn build

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8001/health || exit 1

# Start the server
CMD ["node", "dist/server.js"]
