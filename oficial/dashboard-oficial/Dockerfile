# syntax=docker/dockerfile:1.7

# Stage 1: build con Node + Vite
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar manifest e instalar deps. Si existe package-lock.json, usar npm ci
# (más rápido y reproducible). Si no, fallback a npm install que generará
# uno dentro del builder.
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# Copiar archivos de config + fuente
COPY tsconfig.json tsconfig.node.json vite.config.ts ./
COPY tailwind.config.js postcss.config.js index.html ./
COPY public ./public
COPY src ./src

RUN npm run build

# Stage 2: serve con nginx
FROM nginx:1.27-alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
