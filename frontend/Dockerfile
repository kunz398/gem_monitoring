# PM2-based Dockerfile for React
FROM node:18-alpine

# Install PM2 globally
RUN npm install -g pm2

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Create logs directory for PM2
RUN mkdir -p logs

# Fix permissions for react-scripts and all binaries
RUN chmod +x node_modules/.bin/* && \
    chmod +x node_modules/.bin/react-scripts && \
    ls -la node_modules/.bin/react-scripts

# Build the application
RUN npm run build

# Expose port
EXPOSE 3000

# Start with PM2
CMD ["pm2-runtime", "start", "ecosystem.config.js"]