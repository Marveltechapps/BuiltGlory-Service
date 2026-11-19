# Production API image. Secrets come from the task/host environment, never from this image.
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY scripts ./scripts
RUN chown -R node:node /app
ENV NODE_ENV=production
ENV PORT=5001
EXPOSE 5001
USER node
CMD ["node", "src/server.js"]
