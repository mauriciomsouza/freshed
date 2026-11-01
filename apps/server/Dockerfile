# freshed server. Build from the repository root:
#   docker build -f apps/server/Dockerfile -t freshed-server .
FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/schema/package.json packages/schema/
COPY packages/ai/package.json packages/ai/
COPY examples/brew/package.json examples/brew/
COPY apps/server/package.json apps/server/
RUN pnpm install --frozen-lockfile --filter @freshed/server... --prod=false
COPY tsconfig.base.json ./
COPY packages/schema packages/schema
COPY packages/ai packages/ai
COPY examples/brew examples/brew
COPY apps/server apps/server
ENV NODE_ENV=production PORT=8787
EXPOSE 8787
USER node
CMD ["node", "--import", "tsx", "apps/server/src/index.ts"]
