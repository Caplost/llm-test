FROM nginx:alpine

# Version argument
ARG VERSION=1.0.0
ENV VERSION=${VERSION}

# 创建目录并设置权限
RUN mkdir -p /usr/share/nginx/html && \
    chmod -R 755 /usr/share/nginx/html

# 添加一个最基本的测试文件
RUN echo "This is a basic test file" > /usr/share/nginx/html/test.txt

# 复制我们的备份index.html（确保至少有一个可用的index.html）
COPY index.html /usr/share/nginx/html/index.html

# 复制静态文件（包括子目录）
COPY llm-streaming-tester/ /usr/share/nginx/html/

# 确保index.html文件存在且有正确权限
RUN chmod 644 /usr/share/nginx/html/index.html && \
    chown nginx:nginx /usr/share/nginx/html/index.html

# 复制Nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 详细的调试输出
RUN echo "=== Files in HTML root directory ===" && \
    ls -la /usr/share/nginx/html/ && \
    echo "=== Subdirectories (if any) ===" && \
    find /usr/share/nginx/html -type d | sort && \
    echo "=== First 10 lines of index.html ===" && \
    cat /usr/share/nginx/html/index.html | head -10 && \
    echo "=== nginx configuration ===" && \
    cat /etc/nginx/conf.d/default.conf | grep -v "^[[:space:]]*#" | grep -v "^$"

# Expose the port
EXPOSE 8080

# Start Nginx with verbose logging
CMD ["nginx", "-g", "daemon off;"] 