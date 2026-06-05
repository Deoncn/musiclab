# 在线音乐播放器

## 使用方法

1. 把你的音乐文件放到 `music/` 文件夹，例如：
   - `music/qinghua.mp3`
   - `music/song2.mp3`

2. 修改 `playlist.json`，每首歌写成这样：

```json
{
  "title": "入戏太深",
  "artist": "古佑社",
  "album": "不小心",
  "duration": 275,
  "cover": "./covers/ruxitaishen.jpg",
  "url": "./music/ruxitaishen.mp3"
}
```

3. 用本地服务器打开，不要直接双击 HTML。推荐：

```bash
python -m http.server 8000
```

然后浏览器访问：

```text
http://localhost:8000
```

## 注意

- `url` 可以是本地路径，也可以是远程 mp3 链接。
- 远程链接需要允许跨域访问，否则浏览器可能无法读取时长或播放。
- 不建议直接抓取 Spotify、网易云、QQ 音乐等平台的完整音乐源，很多内容有版权和 DRM 限制。
