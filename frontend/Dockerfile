FROM node:18-alpine

# Install PM2 globally
RUN npm install -g pm2

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your app
COPY . .

# Create logs directory for PM2
RUN mkdir -p logs

# Expose React dev server port
EXPOSE 3111

# Start using PM2
CMD ["pm2-runtime", "ecosystem.config.js"]