# ==============================================================================
# Production Dockerfile for MockMate Express Backend with Multi-Language Runner
# Provides compilers/runtimes for C++ (g++), Python 3, Java (OpenJDK 17), and Node.js
# ==============================================================================

FROM node:20-bookworm-slim

# Set working directory
WORKDIR /app

# Install native compilers and runtimes required by the code execution engine
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    g++ \
    python3 \
    python-is-python3 \
    openjdk-17-jdk-headless \
    procps \
    ca-certificates \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# Precompile <bits/stdc++.h> for ultra-fast C++ competitive programming compilation
RUN find /usr/include -name "stdc++.h" -exec g++ -std=c++17 -O2 {} -o {}.gch \; 2>/dev/null || true

# Set production environment defaults
ENV NODE_ENV=production
ENV PORT=5000

# Copy dependency definitions
COPY package*.json ./

# Install production dependencies only
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Expose backend port
EXPOSE 5000

# Start backend server using production command
CMD ["npm", "start"]
