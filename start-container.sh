#!/bin/bash

# 停止并移除已存在的容器（如果有）
docker stop llm-streaming-nginx 2>/dev/null
docker rm llm-streaming-nginx 2>/dev/null

# 拉取最新镜像
docker pull hub.qpaas.com/aimod/llm-streaming-api:latest

# 启动容器
docker run -d \
  --name llm-streaming-nginx \
  --restart=unless-stopped \
  -p 80:8080 \
  hub.qpaas.com/aimod/llm-streaming-api:latest

# 检查容器是否成功启动
if [ $? -eq 0 ]; then
  echo "容器已成功启动。访问 http://localhost 查看应用"
  echo "查看日志: docker logs llm-streaming-nginx"
else
  echo "容器启动失败"
fi