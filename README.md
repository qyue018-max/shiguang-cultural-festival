# 拾光文化节互动

这是“拾光文化节互动”当前可公开访问的前端源代码，与本地局域网预览版本一致。

## 本地运行

在仓库目录启动任意静态文件服务器，例如：

```bash
python -m http.server 4173
```

然后访问 `http://127.0.0.1:4173/`。

## 后端接入

当前 GitHub Pages 仅提供静态前端。多人实时同步需要单独部署后端，接口约定见 [docs/backend-galaxy-api.md](docs/backend-galaxy-api.md)。

前端已预留：

- `GET /api/lights`
- `POST /api/lights`
- `GET /api/lights/stream`（SSE）

