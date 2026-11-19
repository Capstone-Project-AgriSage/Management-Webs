# Management web for staging or any container host. Two ways to reach the API:
#   - same origin (default): leave VITE_API_URL empty and set API_UPSTREAM at run time; nginx forwards /api,
#     SignalR included, so the browser needs no CORS;
#   - direct: build with --build-arg VITE_API_URL=https://api.example.org and leave API_UPSTREAM empty; the API must
#     then allow this site's origin (Cors__AllowedOrigins__0).
#
#   docker build -t agrisage-management-web .
#   docker run -p 8081:8080 -e API_UPSTREAM=http://api:8080 agrisage-management-web

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_API_URL=
ENV VITE_API_URL=$VITE_API_URL
RUN npx tsc -p tsconfig.app.json --noEmit && npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY deploy/nginx/api-proxy.conf.template /etc/nginx/agrisage/api-proxy.conf.template
COPY deploy/nginx/40-agrisage-api-proxy.sh /docker-entrypoint.d/40-agrisage-api-proxy.sh
# A Windows checkout may give the script CRLF line ends, which /bin/sh cannot run.
RUN sed -i 's/\r$//' /docker-entrypoint.d/40-agrisage-api-proxy.sh && chmod +x /docker-entrypoint.d/40-agrisage-api-proxy.sh
COPY --from=build /app/dist /usr/share/nginx/html
ENV API_UPSTREAM=
EXPOSE 8080
