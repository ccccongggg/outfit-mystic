# AI电子衣柜｜前后端 API Contract V1

> 前端唯一通过 `window.WardrobeAPI` 访问数据。默认 `apiMode=mock`；联调时在 `js/config.js` 改成 `real`。

## 1. Bootstrap
`GET /api/v1/bootstrap`

返回用户、当前衣柜摘要、首页玩法设置。用于 App 首次加载。

## 2. 当前衣柜
`GET /api/v1/wardrobes/current/items`

返回 `WardrobeItem[]`。衣柜字段以《电子衣橱接口表 V1》为基础；W01/W02/W03 的最终字段仍需与电子衣柜队友对齐。

## 3. 跃然自然语言解析
`POST /api/v1/intent/parse`

Request:
```json
{"text":"陪客户吃饭，下午还要骑车；不要红色。","target_date":"2026-09-27"}
```
Response:
```json
{"raw_text":"...","parsed_summary":["客户 / 商务","需要活动","不要红色"]}
```

## 4. 创建推荐
`POST /api/v1/recommendations`

Request:
```json
{
  "wardrobe_id":"wardrobe_me",
  "created_at":"2026-09-26T17:30:00+08:00",
  "target_date":"2026-09-27",
  "source":{"type":"identity","payload":{"identity":"大女主","channel":"爽剧主角"}}
}
```

`source.type` 固定：`tarot | social_energy | identity | input`。

Response:
```json
{
  "session_id":"rec_001",
  "outfits":[
    {"outfit_id":"outfit_001","name":"雾紫轻盈通勤","source":"wardrobe","item_ids":["item_001"],"images":["purple_blouse.png"]},
    {"outfit_id":"ref_001","name":"AI 参考｜当季完整穿搭","source":"ai_reference","is_reference":true,"full_image":"ai_outfit_model.png"}
  ]
}
```

### 必须规则
- 用户衣柜不足时，不要硬凑风格不成立的 Outfit。
- 可减少自有衣柜结果数量，再补完整 AI 参考 Outfit。
- `ai_reference` 必须明确来源；前端不会把它记成用户已穿。

## 5. 确认某日穿搭
`POST /api/v1/outfits/confirm`

Request:
```json
{"target_date":"2026-09-27","outfit_id":"outfit_001","source":{"type":"identity","payload":{}},"overwrite":false}
```

若日期已有 confirmed outfit：
```json
{"status":"conflict","existing":{"outfit_id":"old_001"}}
```
用户确认覆盖后重发 `overwrite:true`。

## 6. 穿搭记录
`GET /api/v1/outfit-records`

前端按日期分：历史记录 / 未来穿搭。每个日期最多 1 个 confirmed outfit。

## 7. 当季趋势
`GET /api/v1/trends/seasonal`

只用于首页新品/趋势弹窗；**不得使用用户历史穿搭偏好**。

## 8. 个人信息 / Theme / 首页玩法
- `PUT /api/v1/users/me/profile`
- `PUT /api/v1/users/me/preferences/theme`
- `PUT /api/v1/users/me/preferences/home-games`

Theme 取值：`system | flow | space`，只影响 UI，不进入推荐。

## 9. 电子衣柜录入
`POST /api/v1/wardrobes/current/items`

真实识图服务完成后写入。前端 Demo 当前使用模拟识别。

## 10. 当前未冻结的后端业务点
- TarotResult → Constraint 的正式桥接算法；前端已经发送 3 张牌及正逆位，但 Mock 只返回演示 Outfit。
- Tarot 是否严格限定“今天”还是跟随 `target_date`。
- AI 参考穿搭库真实数据源。
- 首页市场趋势真实数据源。
