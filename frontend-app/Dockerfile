# ---------- Stage 1: Build ----------
    FROM node:20-alpine AS build
    WORKDIR /app
    
    COPY package*.json ./
    RUN npm ci
    
    COPY . .
    RUN npm run build
    
    
    # ---------- Stage 2: Serve ----------
    FROM nginx:1.27-alpine
    
    # allow non-root to bind to port 80
    RUN apk add --no-cache libcap \
      && setcap 'cap_net_bind_service=+ep' /usr/sbin/nginx
    
    # IMPORTANT: nginx image already has user "nginx" (often uid 101)
    # We'll run as that user and make sure permissions are OK.
    
    # copy built output
    COPY --from=build /app/dist /usr/share/nginx/html
    
    # overwrite the MAIN nginx config (http-level temp paths!)
    COPY nginx.conf /etc/nginx/nginx.conf
    
    # Create /tmp dirs and set permissions for non-root
    RUN mkdir -p /tmp/client_temp /tmp/proxy_temp /tmp/fastcgi_temp /tmp/uwsgi_temp /tmp/scgi_temp \
      && chown -R nginx:nginx /tmp /usr/share/nginx/html
    
    USER nginx
    
    EXPOSE 80
    
    HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
      CMD wget -qO- http://127.0.0.1/health || exit 1
    
    CMD ["nginx", "-g", "daemon off;"]