# Build stage
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Version argument
ARG VERSION=1.0.0

# Copy go.mod and go.sum files
COPY go.mod ./

# Download dependencies
RUN go mod download

# Copy the source code
COPY main.go ./

# Build the Go app with version information
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-X 'main.Version=${VERSION}'" -o /app/server

# Final stage
FROM alpine:latest

WORKDIR /app

# Copy the binary from the builder stage
COPY --from=builder /app/server .

# Copy the static files
COPY llm-streaming-tester/ ./llm-streaming-tester/

# Expose the port
EXPOSE 8080

# Set environment variables
ENV PORT=8080
ENV STATIC_DIR=./llm-streaming-tester
ENV VERSION=1.0.0

# Run the binary
CMD ["./server"] 