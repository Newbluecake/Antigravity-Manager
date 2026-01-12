# Multi-stage Dockerfile for Antigravity Manager Server
# Supports both amd64 and arm64 architectures

# Stage 1: Build the Rust binary
FROM rust:bookworm AS builder

# Install dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Copy the entire src-tauri directory
COPY src-tauri ./

# Copy the dist directory for embedded assets
COPY dist ../dist

# Copy the src directory for locale files
COPY src ../src

# Build the server binary without desktop features (headless mode)
RUN cargo build --release --bin antigravity-server --no-default-features --features server

# The binary will be at target/release/antigravity-server

# Stage 2: Runtime image
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 -s /bin/bash antigravity

# Copy binary from builder
COPY --from=builder /build/target/release/antigravity-server /usr/local/bin/antigravity-server

# Create data directory
RUN mkdir -p /data && chown antigravity:antigravity /data

# Switch to non-root user
USER antigravity

# Set working directory
WORKDIR /data

# Environment variables with defaults
ENV ANTIGRAVITY_DATA_DIR=/data \
    ANTIGRAVITY_WEB_ADMIN_PORT=8046 \
    ANTIGRAVITY_PROXY_PORT=8045 \
    RUST_LOG=info

# Expose ports
EXPOSE 8046 8045

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8046/health || exit 1

# Run the server
ENTRYPOINT ["/usr/local/bin/antigravity-server"]
