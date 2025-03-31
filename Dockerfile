FROM nginx:alpine

# Version argument
ARG VERSION=1.0.0
ENV VERSION=${VERSION}

# Copy Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the static files
COPY llm-streaming-tester/ /usr/share/nginx/html/

# Expose the port
EXPOSE 8080

# Start Nginx
CMD ["nginx", "-g", "daemon off;"] 