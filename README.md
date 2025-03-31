# LLM Streaming Tester - Dockerized

This project provides a Dockerized version of the LLM Streaming Tester with a modern Go API server.

## Features

- Modern Go API server using Go 1.22's new ServeMux
- Docker Compose setup for easy deployment
- Multi-stage Docker build for optimized image size
- Built-in health checks for reliability

## Requirements

- Docker
- Docker Compose

## Quick Start

1. Clone this repository
2. Run the following command to start the service:

```sh
docker-compose up -d
```

3. Access the application at http://localhost

## Architecture

- **Go API Server**: Serves the static files and provides API endpoints
  - Built using Go 1.22's new ServeMux for modern routing
  - Handles HTTP requests directly
  - Includes middleware for CORS and logging

## Configuration

### Environment Variables

The Go API server supports the following environment variables:

- `PORT`: The port on which the API server listens (default: 8080)
- `STATIC_DIR`: The directory containing static files (default: ./llm-streaming-tester)

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