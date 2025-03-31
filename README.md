# LLM Streaming Tester - Dockerized

This project provides a Dockerized version of the LLM Streaming Tester with an Nginx web server.

## Features

- Nginx web server for serving static content
- Docker Compose setup for easy deployment
- Optimized Docker image
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

- **Nginx Web Server**: Serves the static files and provides a health endpoint
  - Configured for optimal static file serving
  - Includes CORS headers for cross-origin requests
  - Version information available via the health endpoint

## Configuration

The Nginx server is configured in the `nginx.conf` file and can be further customized as needed.

## Development

### Running Locally Without Docker

To run the application locally without Docker:

1. Ensure Nginx is installed
2. Copy the Nginx configuration to your Nginx config directory
3. Copy the static files to the appropriate directory
4. Restart Nginx

## Troubleshooting

If you encounter issues:

1. Check the logs:

```sh
docker-compose logs
```

2. Ensure port 80 is not already in use on your system
3. Verify that the Nginx configuration is correct

## License

MIT 