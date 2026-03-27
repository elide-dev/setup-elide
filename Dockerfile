FROM node:24-slim AS base

# Install Bun from a pinned, checksum-verified release
ARG BUN_VERSION=1.3.11
RUN apt-get update && apt-get install -y curl unzip && rm -rf /var/lib/apt/lists/* \
    && ARCH=$(dpkg --print-architecture) \
    && if [ "$ARCH" = "amd64" ]; then \
         BUN_ARCH="x64"; \
         BUN_SHA256="8611ba935af886f05a6f38740a15160326c15e5d5d07adef966130b4493607ed"; \
       elif [ "$ARCH" = "arm64" ]; then \
         BUN_ARCH="aarch64"; \
         BUN_SHA256="d13944da12a53ecc74bf6a720bd1d04c4555c038dfe422365356a7be47691fdf"; \
       else echo "Unsupported arch: $ARCH" && exit 1; fi \
    && curl -fsSL "https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}/bun-linux-${BUN_ARCH}.zip" \
         -o /tmp/bun.zip \
    && echo "${BUN_SHA256}  /tmp/bun.zip" | sha256sum -c - \
    && unzip -q /tmp/bun.zip -d /tmp/bun-extract \
    && mv /tmp/bun-extract/bun-linux-${BUN_ARCH}/bun /usr/local/bin/bun \
    && chmod +x /usr/local/bin/bun \
    && rm -rf /tmp/bun.zip /tmp/bun-extract

FROM base AS deps
WORKDIR /app

# Copy package files first for layer caching
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Full build stage
FROM base AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Default: run the build
CMD ["bun", "run", "build"]
