# Get the base image of Node version 20
FROM node:20

# Use the official Playwright image
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

# Set the working directory in the Docker container
WORKDIR /app

# Install build-essential and other necessary tools
RUN apt-get update && apt-get install -y \
    build-essential \
    xvfb \
    python3

# Link python3 to python (if necessary)
RUN ln -s /usr/bin/python3 /usr/bin/python

# Copy package.json and package-lock.json
COPY package*.json ./

# Get the needed libraries to run Playwright
RUN apt-get update && apt-get -y install libnss3 libatk-bridge2.0-0 libdrm-dev libxkbcommon-dev libgbm-dev libasound-dev libatspi2.0-0 libxshmfence-dev

# Install Node.js dependencies
RUN npm install

# Copy the rest of your application's code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Use the 'xvfb-run' command to run the application with virtual display support
CMD ["xvfb-run", "node", "index.js"]
