# Built from the repository root: the server bundles the engine and protocol
# packages from their TypeScript sources, so the whole workspace is the context.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages ./packages
COPY apps/server ./apps/server
# npm ci wants every workspace it knows about to exist, even the one not built here
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci --ignore-scripts
RUN npm run build -w @dcv/server

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/node_modules/ws ./node_modules/ws
EXPOSE 8080
CMD ["node", "dist/main.js"]
