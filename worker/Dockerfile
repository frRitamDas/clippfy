FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY lib ./lib
COPY scripts/install-downloader.js ./scripts/install-downloader.js
RUN node scripts/install-downloader.js && chmod 755 node_modules/@ffmpeg-installer/linux-x64/ffmpeg
COPY fonts ./fonts
COPY worker/server.js ./worker/server.js
ENV PORT=8080
USER node
EXPOSE 8080
CMD ["node", "worker/server.js"]
