# 拾光星河后端对接说明

前端已按同域接口接入。正式域名环境会自动启用；localhost、局域网 IP 和 `file:` 预览默认只使用本机数据。需要在本地联调后端时，请在应用脚本执行前设置：

```html
<script>window.SHIGUANG_GALAXY_REMOTE_ENABLED = true;</script>
```

## 数据结构

```json
{
  "id": "mine-0827-123456",
  "number": "0827",
  "name": "同学昵称",
  "identityKey": "light-catcher",
  "ipImage": "images/career-ip/light-catcher.png",
  "createdAt": "2026-11-11T12:00:00.000Z"
}
```

`id`、`number`、`name`、`identityKey` 为必需字段。前端只显示内置职业图片路径，未知图片会回退为默认图。

## REST

- `GET /api/lights` → `200 { "lights": [Light, ...] }`
- `POST /api/lights`，请求体为 `Light` → `200/201 { "light": Light }`

建议后端按 `id` 做幂等写入，避免前端离线重试产生重复记录。

## SSE

`GET /api/lights/stream` 保持 `text/event-stream` 连接。新增或更新记录时发送：

```text
event: light
data: {"id":"...","number":"0827","name":"...","identityKey":"light-catcher","ipImage":"images/career-ip/light-catcher.png"}

```

“重置演示数据”只会清除当前浏览器的身份及待同步记录，不会向后端发送删除请求。
