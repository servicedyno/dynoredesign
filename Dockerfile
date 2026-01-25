FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY backend/package.json backend/yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile --ignore-engines

# Copy source code
COPY backend/ .

# Build TypeScript
RUN yarn build

# Expose port
EXPOSE 8001

# Start the server
CMD ["node", "dist/server.js"]
