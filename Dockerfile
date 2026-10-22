FROM node:22.21.1-bookworm-slim AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/backend/package.json apps/backend/package.json
RUN npm ci
COPY apps ./apps
RUN npm run build

FROM node:22.21.1-bookworm-slim
WORKDIR /workspace
ENV NODE_ENV=production
COPY --from=build /workspace/apps/backend/dist ./apps/backend/dist
COPY --from=build /workspace/apps/backend/package.json ./apps/backend/package.json
COPY --from=build /workspace/node_modules ./node_modules
EXPOSE 4000
CMD ["node", "apps/backend/dist/server.js"]
