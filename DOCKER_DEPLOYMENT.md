# Antigravity Manager - Docker Server Deployment Guide

## Overview

This guide explains how to deploy Antigravity Manager as a headless server using Docker. The server mode provides the same account management and proxy functionality as the desktop app, but without requiring a GUI or Tauri runtime.

## Architecture

The Docker deployment consists of:
- **Standalone Server Binary**: Built with `--no-default-features --features server`
- **Web Admin Interface**: Accessible at `http://<host>:8046/admin`
- **API Endpoints**: RESTful API for account and system management
- **Encryption**: Environment-based master key storage (no system keyring required)

## Quick Start

### 1. Build the Docker Image

```bash
docker build -t antigravity-server -f Dockerfile .
```

### 2. Run the Container

```bash
docker run -d \
  --name antigravity \
  -p 8046:8046 \
  -e ANTIGRAVITY_MASTER_KEY=your-secure-master-key-here \
  -v antigravity-data:/data \
  antigravity-server
```

### 3. Access the Web Admin

Open your browser to: `http://localhost:8046/admin`

## Environment Variables

### Required

- **`ANTIGRAVITY_MASTER_KEY`**: Master encryption key for sensitive data
  - **Minimum**: 16 characters
  - **Recommended**: 32+ characters
  - **Example**: `openssl rand -base64 32`

### Optional

- **`ANTIGRAVITY_DATA_DIR`**: Custom data directory (default: `/data`)
- **`ANTIGRAVITY_WEB_ADMIN_PORT`**: Web Admin port (default: `8046`)
- **`RUST_LOG`**: Logging level (default: `info`, options: `debug`, `warn`, `error`)

## Docker Compose Example

```yaml
version: '3.8'

services:
  antigravity:
    image: antigravity-server:latest
    container_name: antigravity-manager
    ports:
      - "8046:8046"
    environment:
      - ANTIGRAVITY_MASTER_KEY=${ANTIGRAVITY_MASTER_KEY}
      - RUST_LOG=info
    volumes:
      - antigravity-data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8046/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 5s

volumes:
  antigravity-data:
```

Usage:
```bash
# Create .env file
echo "ANTIGRAVITY_MASTER_KEY=$(openssl rand -base64 32)" > .env

# Start the service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

## Multi-Architecture Build

The Dockerfile supports both AMD64 and ARM64 architectures:

```bash
# Build for multiple architectures
docker buildx create --use
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t your-registry/antigravity-server:latest \
  --push \
  -f Dockerfile .
```

## Security Best Practices

### 1. Master Key Management

- **Generate a strong key**: Use `openssl rand -base64 32`
- **Store securely**: Use Docker secrets, Kubernetes secrets, or a secrets manager
- **Rotate regularly**: Plan for key rotation procedures

### 2. Network Security

- **Bind to localhost**: For single-host deployments, use `-p 127.0.0.1:8046:8046`
- **Use reverse proxy**: Place behind nginx/Caddy for HTTPS and authentication
- **Firewall rules**: Restrict access to trusted networks only

### 3. Data Persistence

- **Use named volumes**: Ensures data survives container recreation
- **Backup regularly**: The `/data` directory contains all accounts and configuration
- **Encryption at rest**: Consider encrypting the Docker volume

## API Endpoints

### Health Check
```bash
curl http://localhost:8046/health
# Response: OK
```

### Authentication
```bash
# Login (get JWT token)
curl -X POST http://localhost:8046/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password": "your-password"}'
```

### Account Management
```bash
# List accounts (requires auth)
curl http://localhost:8046/api/v1/accounts \
  -H "Authorization: Bearer <token>"

# Add account
curl -X POST http://localhost:8046/api/v1/accounts \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "refresh_token": "..."}'

# Delete account
curl -X DELETE http://localhost:8046/api/v1/accounts/{id} \
  -H "Authorization: Bearer <token>"
```

## Troubleshooting

### Container Fails to Start

**Issue**: `ANTIGRAVITY_MASTER_KEY environment variable is required`
```bash
# Solution: Set the master key
docker run -e ANTIGRAVITY_MASTER_KEY=your-key-here ...
```

**Issue**: `ANTIGRAVITY_MASTER_KEY is too short`
```bash
# Solution: Use at least 16 characters
docker run -e ANTIGRAVITY_MASTER_KEY=$(openssl rand -base64 24) ...
```

### Web Admin Not Accessible

**Issue**: Connection refused on port 8046
```bash
# Check if container is running
docker ps

# Check container logs
docker logs antigravity

# Verify port mapping
docker port antigravity
```

### Data Persistence Issues

**Issue**: Data lost after container restart
```bash
# Ensure you're using a named volume
docker run -v antigravity-data:/data ...

# Check volume exists
docker volume ls
```

## Migration from Desktop Version

### Export from Desktop
1. Open Antigravity Manager desktop app
2. Go to Settings → Data Management
3. Click "Export All Accounts"
4. Save the export file

### Import to Docker
```bash
# Copy export file to container
docker cp accounts-export.json antigravity:/tmp/

# Import via API or Web Admin interface
```

## Monitoring

### Container Logs
```bash
# Real-time logs
docker logs -f antigravity

# Last 100 lines
docker logs --tail 100 antigravity
```

### Health Monitoring
```bash
# Check health status
docker inspect antigravity | jq '.[0].State.Health'

# Continuous health check
watch -n 5 'curl -s http://localhost:8046/health'
```

### Resource Usage
```bash
# Container stats
docker stats antigravity

# Detailed resource usage
docker inspect antigravity | jq '.[0].HostConfig.Memory'
```

## Backup and Restore

### Backup
```bash
# Stop container
docker stop antigravity

# Backup data volume
docker run --rm \
  -v antigravity-data:/data \
  -v $(pwd):/backup \
  busybox tar czf /backup/antigravity-backup-$(date +%Y%m%d).tar.gz /data

# Restart container
docker start antigravity
```

### Restore
```bash
# Stop container
docker stop antigravity

# Restore from backup
docker run --rm \
  -v antigravity-data:/data \
  -v $(pwd):/backup \
  busybox tar xzf /backup/antigravity-backup-20260112.tar.gz -C /

# Restart container
docker start antigravity
```

## Performance Tuning

### Resource Limits
```bash
docker run -d \
  --name antigravity \
  --memory="512m" \
  --cpus="1.0" \
  -p 8046:8046 \
  -e ANTIGRAVITY_MASTER_KEY=your-key \
  antigravity-server
```

### Logging Configuration
```bash
# Reduce log verbosity
docker run -e RUST_LOG=warn ...

# Limit log file size
docker run --log-opt max-size=10m --log-opt max-file=3 ...
```

## Advanced Configuration

### Custom Data Directory
```bash
docker run \
  -e ANTIGRAVITY_DATA_DIR=/custom/path \
  -v /host/path:/custom/path \
  antigravity-server
```

### Behind Reverse Proxy (Nginx)
```nginx
server {
    listen 443 ssl http2;
    server_name antigravity.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8046;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Support

For issues, questions, or feature requests:
- GitHub Issues: https://github.com/lbjlaq/Antigravity-Manager/issues
- Documentation: See `/docs` directory

## License

This project is licensed under CC-BY-NC-SA-4.0.
