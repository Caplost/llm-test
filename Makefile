.PHONY: build push run clean help

# 变量定义
IMAGE_REGISTRY := hub.qpaas.com/aimod
IMAGE_NAME := llm-streaming-api
VERSION := 1.0.0
IMAGE_TAG := $(IMAGE_REGISTRY)/$(IMAGE_NAME):$(VERSION)
IMAGE_TAG_LATEST := $(IMAGE_REGISTRY)/$(IMAGE_NAME):latest

# 默认目标
help:
	@echo "可用命令:"
	@echo "make build    - 构建Docker镜像"
	@echo "make push     - 推送Docker镜像到仓库"
	@echo "make run      - 本地运行Docker容器"
	@echo "make clean    - 清理本地Docker资源"
	@echo "make release  - 构建并推送镜像"

# 构建Docker镜像
build:
	@echo "构建Docker镜像: $(IMAGE_TAG)"
	docker build --build-arg VERSION=$(VERSION) -t $(IMAGE_TAG) -t $(IMAGE_TAG_LATEST) .
	@echo "构建完成"

# 推送Docker镜像到仓库
push:
	@echo "推送镜像到: $(IMAGE_REGISTRY)"
	docker push $(IMAGE_TAG)
	docker push $(IMAGE_TAG_LATEST)
	@echo "推送完成"

# 本地运行Docker容器
run:
	@echo "本地运行容器"
	docker-compose up -d
	@echo "容器已启动 访问: http://localhost"

# 清理Docker资源
clean:
	@echo "清理Docker资源"
	docker-compose down
	docker rmi $(IMAGE_TAG) $(IMAGE_TAG_LATEST) || true
	@echo "清理完成"

# 完整发布流程
release: build push
	@echo "发布完成: $(IMAGE_TAG)" 