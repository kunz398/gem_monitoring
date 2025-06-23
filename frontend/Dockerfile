# Multi-stage Dockerfile for React (Development optimized)
FROM node:18-alpine as base

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Development stage
FROM base as development

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start development server with hot reload
CMD ["npm", "start"]

# Build stage
FROM base as build

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM nginx:alpine as production

# Copy built assets from build stage
COPY --from=build /app/build /usr/share/nginx/html

# Copy custom nginx config if needed
# COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]