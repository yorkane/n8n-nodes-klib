# n8n 文件操作类 自定义节点

这是一个n8n自定义节点，用于文件系统操作。

## 功能特性

- 列出指定目录的文件夹和文件信息，并提供排序支持（按照时间，类型，文件名等）
- 提供清理空目录功能，包括递归清理，压缩目录层级
- 提供文件名修复功能，对不兼容windows文件系统的文件名和目录名进行修改

## 安装

1. 进入n8n自定义节点目录
```bash
cd ~/.n8n/custom
```

2. 克隆此仓库
```bash
git clone https://github.com/yorkane/n8n-nodes-klib.git
```

3. 安装依赖
```bash
cd n8n-nodes-klib
pnpm install
```

4. 构建节点
```