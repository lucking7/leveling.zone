FROM node:20-alpine
RUN apk add --no-cache curl python3 py3-pip
WORKDIR /app

# Database updates are independent of the web application's npm dependencies.
COPY scripts/requirements-ipdb.txt scripts/requirements-ipdb.txt
RUN python3 -m venv /opt/ipdb && /opt/ipdb/bin/pip install --no-cache-dir -r scripts/requirements-ipdb.txt
ENV PATH="/opt/ipdb/bin:${PATH}"
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && mkdir -p /app/data/db && chmod +x scripts/docker-entrypoint.sh
VOLUME ["/app/data/db"]
EXPOSE 3000
ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["npm", "start"]
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -fsS http://localhost:3000/ > /dev/null || exit 1
