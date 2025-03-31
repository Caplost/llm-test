FROM nginx:alpine

# Version argument
ARG VERSION=1.0.0
ENV VERSION=${VERSION}

# 创建目录并设置权限
RUN mkdir -p /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# 复制静态文件到nginx目录（包括子目录）
COPY llm-streaming-tester/ /usr/share/nginx/html/

# 如果llm-streaming-tester目录中没有index.html，使用我们的备份文件
COPY index.html /usr/share/nginx/html/index.html.backup
RUN if [ ! -f /usr/share/nginx/html/index.html ]; then \
        cp /usr/share/nginx/html/index.html.backup /usr/share/nginx/html/index.html; \
    fi

# 复制Nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 显示复制的文件列表，用于调试
RUN echo "Files in /usr/share/nginx/html:" && \
    ls -la /usr/share/nginx/html/ && \
    echo "Subdirectories:" && \
    find /usr/share/nginx/html -type d | sort && \
    echo "index.html content:" && \
    cat /usr/share/nginx/html/index.html | head -10

# Expose the port
EXPOSE 8080

# Start Nginx with debug mode
CMD ["nginx", "-g", "daemon off;"] 