# LLM Streaming Tester - Dockerized

This project provides a Dockerized version of the LLM Streaming Tester with a modern Go API server.

## Features

- Modern Go API server using Go 1.22's new ServeMux
- Docker Compose setup for easy deployment
- Multi-stage Docker build for optimized image size
- Built-in health checks for reliability
- Custom Docker registry integration (hub.qpaas.com/aimod)

## Requirements

- Docker
- Docker Compose
- Make (optional, for using Makefile commands)

## Quick Start

### Using Docker Compose

1. Clone this repository
2. Run the following command to start the service:

```sh
docker-compose up -d
```

3. Access the application at http://localhost

### Using Makefile

This project includes a Makefile for common operations:

```sh
# Build the Docker image
make build

# Push the image to the registry
make push

# Build and push in one step
make release

# Run the container locally
make run

# Clean up resources
make clean
```

## Docker Image

The Docker image for this application is stored at:

```
hub.qpaas.com/aimod/llm-streaming-api:latest
```

## Architecture

- **Go API Server**: Serves the static files and provides API endpoints
  - Built using Go 1.22's new ServeMux for modern routing
  - Handles HTTP requests directly
  - Includes middleware for CORS and logging
  - Version information available via API

## Configuration

### Environment Variables

The Go API server supports the following environment variables:

- `PORT`: The port on which the API server listens (default: 8080)
- `STATIC_DIR`: The directory containing static files (default: ./llm-streaming-tester)
- `VERSION`: Application version (default: from build or "development")

These can be modified in the `docker-compose.yml` file.

## Development

### Running Locally Without Docker

To run the application locally without Docker:

1. Ensure Go 1.22 or later is installed
2. Run the Go server:

```sh
go run main.go
```

3. Access the application at http://localhost:8080

## Troubleshooting

If you encounter issues:

1. Check the logs:

```sh
docker-compose logs
```

2. Ensure port 80 is not already in use on your system
3. Verify that the LLM Streaming Tester directory is properly mounted

## License

MIT 