# Maple 起始页

个人使用的简约静态主页：时钟、搜索、多级收藏夹、系统深浅色主题、壁纸和可选诗词一言。不包含 AI、天气或定位功能。

**主页：https://home.maple367.eu.org/**

## 使用

- 按 `/` 聚焦搜索，支持 Bing、Google、百度、DuckDuckGo 和收藏夹搜索。
- 从浏览器导出收藏夹 HTML，再在主页导入；默认只导入收藏夹栏及子文件夹。
- 收藏和设置保存在当前浏览器，通过 JSON 备份手动迁移，不自动同步。
- 本地壁纸在浏览器内压缩保存，不上传服务器；也支持 HTTPS 图片直链。
- Maple Mono NF CN 网页字体随站点提供，优先使用已安装字体，未安装时按字符范围加载 WOFF2 分包。

完整说明见 [HOME.md](HOME.md)。

## 本地预览与部署

```sh
python -m http.server 8765 --bind 127.0.0.1
```

访问 http://127.0.0.1:8765/ 。主页没有构建步骤，使用 GitHub Pages 从 `main` 分支根目录发布；保留现有 `CNAME`、`MusicMini/` 和 `link/`。

网页图标由浏览器直接加载；根路径图标失效时，独立 [Cloudflare Worker](worker/README.md) 仅发现实际图标 URL，不存储图片或收藏。字体授权与生成方法见 [字体说明](assets/fonts/README.md)。

开发依赖、个人收藏导出、壁纸和本地测试资料不提交到公开仓库。请勿将私密 API 凭据写入前端。

## 来源与许可

在原有 [startpage](https://danggoodcode.com/startpage) 基础上重做。原项目许可见 [LICENSE](LICENSE)，字体单独遵循 [SIL OFL 1.1](assets/fonts/OFL.txt)。
