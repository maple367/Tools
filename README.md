# Maple 起始页

简约的个人主页，将时间、搜索和收藏集中在一个页面。

**[打开主页](https://home.maple367.eu.org/)**

## 功能

- 时钟与日期，支持秒数和 12/24 小时制
- Bing、Google、百度、DuckDuckGo 及收藏夹搜索，按 `/` 聚焦
- 多级收藏夹导航，支持 HTML 合并或替换导入、JSON 备份与恢复
- 跟随系统的深浅色主题、多套配色、本地与在线壁纸
- 网站图标自动解析、可选诗词一言
- Maple Mono NF CN 字体，按需加载网页字体分包

## 使用

在浏览器收藏夹管理器中导出 HTML，点击主页的“导入书签”，选择合并或替换。收藏和设置保存在当前浏览器，可通过 JSON 备份迁移到其他设备。

## 本地预览

```sh
python -m http.server 8765 --bind 127.0.0.1
```

访问 http://127.0.0.1:8765/ 。

## 许可

基于原有 [startpage](https://danggoodcode.com/startpage) 重做，项目许可见 [LICENSE](LICENSE)。字体遵循 [SIL OFL 1.1](assets/fonts/OFL.txt)。
