/* web/data/offline.js —— 【自动生成，请勿手改】
   来源：web/data/{items,samples,slot-samples,tarot}.json（唯一真相源仍是这些 JSON）
   生成：python scripts/build_offline_data.py
         （server/app.py 写入 items.json 后也会自动重建）
   SOURCE_MD5: 6d78aae08febe0af9df19dd55da925de

   为什么要有这个文件：浏览器在 file:// 下拒绝一切 fetch（"URL scheme must be
   http or https for CORS request"），双击 index.html 时 data/*.json 全读不到，
   衣橱 / 塔罗 / 示例图会一片空白。<script> 不受这个限制，所以把数据也做成一份
   经典脚本快照。app.js 的顺序是「先接口 / 再 fetch 相对路径 / 最后用这份快照」，
   起服务时永远是接口的最新数据，这份只在断网或双击打开时兜底。*/
window.__offlineData = {
  "items": [
    {
      "id": "w0001",
      "image": "assets/items/prod_tee_white.jpg",
      "category": "top",
      "type": "吊带",
      "color_name": "柔白",
      "color_hex": "#F2F0EB",
      "palette": [
        "#F2F0EB",
        "#E4E0D6"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "season": [
        "春",
        "夏"
      ],
      "style_tags": [
        "温柔",
        "甜美"
      ],
      "formality": 2,
      "source": "ai",
      "manual_override": false,
      "material": "真丝",
      "occasions": [
        "约会",
        "休闲"
      ]
    },
    {
      "id": "w0002",
      "image": "assets/items/prod_tee_black.jpg",
      "category": "top",
      "type": "短袖",
      "color_name": "纯黑",
      "color_hex": "#1C1C1E",
      "palette": [
        "#1C1C1E",
        "#2E2E30"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "season": [
        "春",
        "夏",
        "秋"
      ],
      "style_tags": [
        "甜美",
        "通勤"
      ],
      "formality": 3,
      "source": "ai",
      "manual_override": false,
      "material": "雪纺",
      "occasions": [
        "约会",
        "通勤"
      ]
    },
    {
      "id": "w0005",
      "image": "assets/items/prod_dress_gray.jpg",
      "category": "top",
      "type": "连衣裙",
      "color_name": "奶白",
      "color_hex": "#F1EEE8",
      "palette": [
        "#F1EEE8",
        "#D8D6D0"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "season": [
        "春",
        "夏"
      ],
      "style_tags": [
        "简约",
        "温柔"
      ],
      "formality": 2,
      "source": "ai",
      "manual_override": false,
      "material": "其他",
      "occasions": [
        "通勤",
        "休闲"
      ]
    },
    {
      "id": "w0006",
      "image": "assets/items/prod_jogger_gray.jpg",
      "category": "bottom",
      "type": "长裤",
      "color_name": "雾灰",
      "color_hex": "#A8B0B8",
      "palette": [
        "#A8B0B8",
        "#78808A"
      ],
      "fit": "宽松",
      "pattern": "纯色",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约",
        "通勤"
      ],
      "formality": 3,
      "source": "ai",
      "manual_override": false,
      "material": "西装面料",
      "occasions": [
        "通勤",
        "休闲"
      ]
    },
    {
      "id": "w0007",
      "image": "assets/items/prod_short_olive.jpg",
      "category": "bottom",
      "type": "半身裙",
      "color_name": "橄榄绿",
      "color_hex": "#78824E",
      "palette": [
        "#78824E",
        "#586238"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "season": [
        "春",
        "夏",
        "秋"
      ],
      "style_tags": [
        "简约",
        "复古"
      ],
      "formality": 2,
      "source": "ai",
      "manual_override": false,
      "material": "棉",
      "occasions": [
        "休闲",
        "约会"
      ]
    },
    {
      "id": "w0008",
      "image": "assets/items/prod_jogger_red.jpg",
      "category": "bottom",
      "type": "半身裙",
      "color_name": "砖红",
      "color_hex": "#963237",
      "palette": [
        "#963237",
        "#6E2328"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "温柔",
        "复古"
      ],
      "formality": 2,
      "source": "ai",
      "manual_override": false,
      "material": "棉",
      "occasions": [
        "约会",
        "休闲"
      ]
    },
    {
      "id": "w0009",
      "image": "assets/items/prod_sneaker_white.jpg",
      "category": "shoes",
      "type": "鞋",
      "color_name": "米白",
      "color_hex": "#EDE8DC",
      "palette": [
        "#EDE8DC",
        "#C9B49A"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "season": [
        "春",
        "夏",
        "秋"
      ],
      "style_tags": [
        "简约",
        "通勤"
      ],
      "formality": 2,
      "source": "ai",
      "manual_override": false,
      "material": "皮革",
      "occasions": [
        "通勤",
        "休闲"
      ]
    },
    {
      "id": "w0010",
      "image": "assets/items/prod_sneaker_red.jpg",
      "category": "shoes",
      "type": "鞋",
      "color_name": "正红",
      "color_hex": "#C41E2A",
      "palette": [
        "#C41E2A",
        "#B01B25"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "甜美",
        "复古"
      ],
      "formality": 2,
      "source": "ai",
      "manual_override": false,
      "material": "皮革",
      "occasions": [
        "约会",
        "休闲"
      ]
    },
    {
      "id": "w0011",
      "image": "assets/items/prod_jacket.jpg",
      "category": "outer",
      "type": "外套",
      "color_name": "卡其",
      "color_hex": "#B8895A",
      "palette": [
        "#B8895A",
        "#8F6840"
      ],
      "fit": "宽松",
      "pattern": "纯色",
      "season": [
        "秋",
        "冬"
      ],
      "style_tags": [
        "通勤",
        "复古"
      ],
      "formality": 3,
      "source": "ai",
      "manual_override": false,
      "material": "棉",
      "occasions": [
        "通勤",
        "休闲"
      ]
    },
    {
      "id": "w0012",
      "image": "assets/items/prod_shoes_heel.jpg",
      "category": "shoes",
      "type": "鞋",
      "color_name": "浅金棕",
      "color_hex": "#C9A574",
      "palette": [
        "#C9A574",
        "#A88858"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "season": [
        "春",
        "夏"
      ],
      "style_tags": [
        "甜美",
        "通勤"
      ],
      "formality": 3,
      "source": "ai",
      "manual_override": false,
      "material": "皮革",
      "occasions": [
        "通勤",
        "正式"
      ]
    },
    {
      "category": "bag",
      "type": "包",
      "color_name": "黑色",
      "color_hex": "#F3F3F3",
      "palette": [
        "#F3F3F3"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约",
        "通勤"
      ],
      "occasions": [
        "通勤"
      ],
      "formality": 2,
      "source": "ai",
      "manual_override": true,
      "id": "w9001",
      "image": "assets/items/w9001.jpg"
    },
    {
      "category": "bag",
      "type": "包",
      "color_name": "棕色",
      "color_hex": "#A55728",
      "palette": [
        "#A55728"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "复古",
        "通勤"
      ],
      "occasions": [
        "通勤"
      ],
      "formality": 2,
      "source": "ai",
      "manual_override": true,
      "id": "w9002",
      "image": "assets/items/w9002.jpg"
    },
    {
      "category": "outer",
      "type": "外套",
      "color_name": "浅蓝与米白",
      "color_hex": "#E6E2DB",
      "palette": [
        "#E6E2DB"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "material": "其他",
      "season": [
        "秋"
      ],
      "style_tags": [
        "慵懒",
        "简约"
      ],
      "occasions": [
        "休闲"
      ],
      "formality": 2,
      "source": "ai",
      "manual_override": true,
      "id": "w9003",
      "image": "assets/items/w9003.jpg"
    },
    {
      "category": "outer",
      "type": "外套",
      "color_name": "米白色",
      "color_hex": "#E8E2D7",
      "palette": [
        "#E8E2D7"
      ],
      "fit": "宽松",
      "pattern": "纯色",
      "material": "运动面料",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "复古",
        "明艳"
      ],
      "occasions": [
        "休闲"
      ],
      "formality": 2,
      "source": "ai",
      "manual_override": true,
      "id": "w9004",
      "image": "assets/items/w9004.jpg"
    },
    {
      "category": "top",
      "type": "短袖",
      "color_name": "酒红色",
      "color_hex": "#431A1C",
      "palette": [
        "#431A1C"
      ],
      "fit": "宽松",
      "pattern": "纯色",
      "material": "棉",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "文艺",
        "温柔"
      ],
      "occasions": [
        "约会"
      ],
      "formality": 2,
      "source": "ai",
      "manual_override": true,
      "id": "w9005",
      "image": "assets/items/w9005.jpg"
    },
    {
      "category": "shoes",
      "type": "鞋",
      "color_name": "棕色",
      "color_hex": "#683329",
      "palette": [
        "#683329"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "复古",
        "通勤"
      ],
      "occasions": [
        "通勤"
      ],
      "formality": 2,
      "source": "ai",
      "manual_override": true,
      "id": "w9006",
      "image": "assets/items/w9006.jpg"
    },
    {
      "category": "shoes",
      "type": "鞋",
      "color_name": "白色",
      "color_hex": "#D6D9D4",
      "palette": [
        "#D6D9D4"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "文艺",
        "简约"
      ],
      "occasions": [
        "通勤"
      ],
      "formality": 2,
      "source": "ai",
      "manual_override": true,
      "id": "w9007",
      "image": "assets/items/w9007.jpg"
    },
    {
      "category": "bottom",
      "type": "长裤",
      "color_name": "黑色",
      "color_hex": "#181818",
      "palette": [
        "#181818"
      ],
      "fit": "阔腿",
      "pattern": "纯色",
      "material": "针织",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "慵懒",
        "通勤"
      ],
      "occasions": [
        "通勤"
      ],
      "formality": 2,
      "source": "ai",
      "manual_override": true,
      "id": "w9009",
      "image": "assets/items/w9009.jpg"
    },
    {
      "category": "bottom",
      "type": "长裤",
      "color_name": "黑色",
      "color_hex": "#171719",
      "palette": [
        "#171719"
      ],
      "fit": "宽松",
      "pattern": "其他",
      "material": "棉",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "通勤",
        "简约"
      ],
      "occasions": [
        "通勤"
      ],
      "formality": 2,
      "source": "ai",
      "manual_override": true,
      "id": "w9301",
      "image": "assets/items/w9301.jpg"
    },
    {
      "id": "w9701",
      "image": "assets/items/prod_tee_white.jpg",
      "category": "top",
      "type": "吊带",
      "color_name": "柔白",
      "color_hex": "#F2F0EB",
      "palette": [
        "#F2F0EB",
        "#E4E0D6"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "season": [
        "春",
        "夏"
      ],
      "style_tags": [
        "文艺",
        "温柔"
      ],
      "formality": 2,
      "source": "ai",
      "manual_override": true,
      "material": "真丝",
      "occasions": [
        "约会",
        "通勤"
      ]
    },
    {
      "id": "w9703",
      "image": "assets/items/prod_short_olive.jpg",
      "category": "bottom",
      "type": "半身裙",
      "color_name": "橄榄绿",
      "color_hex": "#78824E",
      "palette": [
        "#78824E",
        "#586238"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "season": [
        "春",
        "夏",
        "秋"
      ],
      "style_tags": [
        "文艺",
        "复古"
      ],
      "formality": 2,
      "source": "ai",
      "manual_override": true,
      "material": "棉",
      "occasions": [
        "约会",
        "休闲"
      ]
    },
    {
      "id": "w9704",
      "image": "assets/items/prod_jacket.jpg",
      "category": "outer",
      "type": "外套",
      "color_name": "卡其",
      "color_hex": "#B8895A",
      "palette": [
        "#B8895A",
        "#8F6840"
      ],
      "fit": "宽松",
      "pattern": "纯色",
      "season": [
        "秋",
        "冬"
      ],
      "style_tags": [
        "慵懒",
        "通勤"
      ],
      "formality": 3,
      "source": "ai",
      "manual_override": true,
      "material": "棉",
      "occasions": [
        "休闲",
        "通勤"
      ]
    },
    {
      "id": "w9705",
      "image": "assets/items/prod_sneaker_red.jpg",
      "category": "shoes",
      "type": "鞋",
      "color_name": "正红",
      "color_hex": "#C41E2A",
      "palette": [
        "#C41E2A",
        "#B01B25"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "明艳",
        "甜美"
      ],
      "formality": 2,
      "source": "ai",
      "manual_override": true,
      "material": "皮革",
      "occasions": [
        "约会",
        "聚会"
      ]
    },
    {
      "id": "w9706",
      "image": "assets/items/prod_sneaker_white.jpg",
      "category": "shoes",
      "type": "鞋",
      "color_name": "米白",
      "color_hex": "#EDE8DC",
      "palette": [
        "#EDE8DC",
        "#C9B49A"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "season": [
        "春",
        "夏",
        "秋"
      ],
      "style_tags": [
        "运动",
        "通勤"
      ],
      "formality": 2,
      "source": "ai",
      "manual_override": true,
      "material": "皮革",
      "occasions": [
        "通勤",
        "休闲"
      ]
    },
    {
      "id": "w9707",
      "image": "assets/items/prod_jogger_red.jpg",
      "category": "bottom",
      "type": "半身裙",
      "color_name": "砖红",
      "color_hex": "#963237",
      "palette": [
        "#963237",
        "#6E2328"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "复古",
        "温柔"
      ],
      "formality": 2,
      "source": "ai",
      "manual_override": true,
      "material": "棉",
      "occasions": [
        "约会",
        "通勤"
      ]
    },
    {
      "id": "w5500",
      "image": "assets/items/_new_women/tops/top_01.jpg",
      "category": "top",
      "type": "长袖衬衫",
      "color_name": "白",
      "color_hex": "#D8D8D8",
      "palette": [
        "#D8D8D8"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "material": "其他",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "休闲"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5501",
      "image": "assets/items/_new_women/tops/top_02.jpg",
      "category": "top",
      "type": "长袖衬衫",
      "color_name": "白",
      "color_hex": "#C0C0C0",
      "palette": [
        "#C0C0C0"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "material": "其他",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "休闲"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5502",
      "image": "assets/items/_new_women/tops/top_03.jpg",
      "category": "top",
      "type": "刺绣衬衫",
      "color_name": "白",
      "color_hex": "#D8D8D8",
      "palette": [
        "#D8D8D8"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "material": "其他",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "休闲"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5503",
      "image": "assets/items/_new_women/tops/top_05.jpg",
      "category": "top",
      "type": "长袖衬衫",
      "color_name": "白",
      "color_hex": "#D8D8D8",
      "palette": [
        "#D8D8D8"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "material": "其他",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "休闲"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5504",
      "image": "assets/items/_new_women/tops/top_06.jpg",
      "category": "top",
      "type": "针织毛衣",
      "color_name": "米",
      "color_hex": "#D8D8D8",
      "palette": [
        "#D8D8D8"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "material": "其他",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "休闲"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5505",
      "image": "assets/items/_new_women/tops/top_07.jpg",
      "category": "top",
      "type": "V领针织衫",
      "color_name": "白",
      "color_hex": "#C0C0C0",
      "palette": [
        "#C0C0C0"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "material": "其他",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "休闲"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5506",
      "image": "assets/items/_new_women/tops/top_08.jpg",
      "category": "top",
      "type": "针织开衫",
      "color_name": "白",
      "color_hex": "#D8D8D8",
      "palette": [
        "#D8D8D8"
      ],
      "fit": "合身",
      "pattern": "波点",
      "material": "其他",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "休闲"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5507",
      "image": "assets/items/_new_women/tops/top_09.jpg",
      "category": "top",
      "type": "针织衫",
      "color_name": "白",
      "color_hex": "#D8D8D8",
      "palette": [
        "#D8D8D8"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "material": "其他",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "休闲"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5508",
      "image": "assets/items/_new_women/tops/top_10.jpg",
      "category": "top",
      "type": "吊带",
      "color_name": "白",
      "color_hex": "#D8D8D8",
      "palette": [
        "#D8D8D8"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "material": "其他",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "休闲"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5509",
      "image": "assets/items/_new_women/dresses/dress_01.jpg",
      "category": "dress",
      "type": "连衣裙",
      "color_name": "黑",
      "color_hex": "#C0C0A8",
      "palette": [
        "#C0C0A8"
      ],
      "fit": "合身",
      "pattern": "波点",
      "material": "其他",
      "season": [
        "春",
        "夏"
      ],
      "style_tags": [
        "温柔"
      ],
      "occasions": [
        "约会",
        "通勤"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5510",
      "image": "assets/items/_new_women/dresses/dress_02.jpg",
      "category": "dress",
      "type": "衬衫连衣裙",
      "color_name": "卡其",
      "color_hex": "#C0C0C0",
      "palette": [
        "#C0C0C0"
      ],
      "fit": "合身",
      "pattern": "格纹",
      "material": "其他",
      "season": [
        "春",
        "夏"
      ],
      "style_tags": [
        "温柔"
      ],
      "occasions": [
        "约会",
        "通勤"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5511",
      "image": "assets/items/_new_women/dresses/dress_03.jpg",
      "category": "dress",
      "type": "裹身连衣裙",
      "color_name": "白",
      "color_hex": "#D8D8D8",
      "palette": [
        "#D8D8D8"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "material": "其他",
      "season": [
        "春",
        "夏"
      ],
      "style_tags": [
        "温柔"
      ],
      "occasions": [
        "约会",
        "通勤"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5512",
      "image": "assets/items/_new_women/dresses/dress_04.jpg",
      "category": "dress",
      "type": "方领连衣裙",
      "color_name": "白",
      "color_hex": "#D8D8D8",
      "palette": [
        "#D8D8D8"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "material": "其他",
      "season": [
        "春",
        "夏"
      ],
      "style_tags": [
        "温柔"
      ],
      "occasions": [
        "约会",
        "通勤"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5513",
      "image": "assets/items/_new_women/dresses/dress_05.jpg",
      "category": "dress",
      "type": "直筒连衣裙",
      "color_name": "白",
      "color_hex": "#C0C0C0",
      "palette": [
        "#C0C0C0"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "material": "其他",
      "season": [
        "春",
        "夏"
      ],
      "style_tags": [
        "温柔"
      ],
      "occasions": [
        "约会",
        "通勤"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5514",
      "image": "assets/items/_new_women/dresses/dress_06.jpg",
      "category": "dress",
      "type": "蕾丝连衣裙",
      "color_name": "白",
      "color_hex": "#C0C0C0",
      "palette": [
        "#C0C0C0"
      ],
      "fit": "合身",
      "pattern": "纯色",
      "material": "其他",
      "season": [
        "春",
        "夏"
      ],
      "style_tags": [
        "温柔"
      ],
      "occasions": [
        "约会",
        "通勤"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5516",
      "image": "assets/items/_new_women/dresses/dress_09.jpg",
      "category": "dress",
      "type": "吊带连衣裙",
      "color_name": "黑",
      "color_hex": "#181818",
      "palette": [
        "#181818"
      ],
      "fit": "合身",
      "pattern": "蕾丝",
      "material": "其他",
      "season": [
        "春",
        "夏"
      ],
      "style_tags": [
        "温柔"
      ],
      "occasions": [
        "约会",
        "通勤"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5517",
      "image": "assets/items/_new_women/dresses/dress_10.jpg",
      "category": "dress",
      "type": "碎花连衣裙",
      "color_name": "红",
      "color_hex": "#D8A8A8",
      "palette": [
        "#D8A8A8"
      ],
      "fit": "合身",
      "pattern": "碎花",
      "material": "其他",
      "season": [
        "春",
        "夏"
      ],
      "style_tags": [
        "温柔"
      ],
      "occasions": [
        "约会",
        "通勤"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5518",
      "image": "assets/items/_new_women/skirts/skirt_01.jpg",
      "category": "bottom",
      "type": "百褶半身裙",
      "color_name": "白",
      "color_hex": "#C0C0C0",
      "palette": [
        "#C0C0C0"
      ],
      "fit": "修身",
      "pattern": "纯色",
      "material": "其他",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "休闲"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5519",
      "image": "assets/items/_new_women/skirts/skirt_02.jpg",
      "category": "bottom",
      "type": "波点半身裙",
      "color_name": "白",
      "color_hex": "#D8D8D8",
      "palette": [
        "#D8D8D8"
      ],
      "fit": "修身",
      "pattern": "波点",
      "material": "其他",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "休闲"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5520",
      "image": "assets/items/_new_women/skirts/skirt_03.jpg",
      "category": "bottom",
      "type": "条纹百褶裙",
      "color_name": "白",
      "color_hex": "#D8D8D8",
      "palette": [
        "#D8D8D8"
      ],
      "fit": "修身",
      "pattern": "条纹",
      "material": "其他",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "休闲"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5521",
      "image": "assets/items/_new_women/skirts/skirt_04.jpg",
      "category": "bottom",
      "type": "牛仔半身裙",
      "color_name": "白",
      "color_hex": "#C0C0C0",
      "palette": [
        "#C0C0C0"
      ],
      "fit": "修身",
      "pattern": "牛仔",
      "material": "其他",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "休闲"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5522",
      "image": "assets/items/_new_women/skirts/skirt_05.jpg",
      "category": "bottom",
      "type": "格纹半身裙",
      "color_name": "黑白",
      "color_hex": "#000000",
      "palette": [
        "#000000"
      ],
      "fit": "修身",
      "pattern": "格纹",
      "material": "其他",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "休闲"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5523",
      "image": "assets/items/_new_women/pants/pant_02.jpg",
      "category": "bottom",
      "type": "直筒牛仔裤",
      "color_name": "白",
      "color_hex": "#D8D8D8",
      "palette": [
        "#D8D8D8"
      ],
      "fit": "修身",
      "pattern": "牛仔",
      "material": "其他",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "休闲"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5524",
      "image": "assets/items/_new_women/pants/pant_03.jpg",
      "category": "bottom",
      "type": "阔腿牛仔裤",
      "color_name": "米白",
      "color_hex": "#D8D8C0",
      "palette": [
        "#D8D8C0"
      ],
      "fit": "修身",
      "pattern": "牛仔",
      "material": "其他",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "休闲"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5525",
      "image": "assets/items/_new_women/pants/pant_04.jpg",
      "category": "bottom",
      "type": "阔腿西裤",
      "color_name": "黑",
      "color_hex": "#181818",
      "palette": [
        "#181818"
      ],
      "fit": "修身",
      "pattern": "纯色",
      "material": "其他",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "休闲"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5526",
      "image": "assets/items/_new_women/pants/pant_05.jpg",
      "category": "bottom",
      "type": "褶裥西裤",
      "color_name": "黑",
      "color_hex": "#181818",
      "palette": [
        "#181818"
      ],
      "fit": "修身",
      "pattern": "纯色",
      "material": "其他",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "休闲"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5527",
      "image": "assets/items/_new_women/outer/outer_02.jpg",
      "category": "outer",
      "type": "西装外套",
      "color_name": "米白",
      "color_hex": "#D8C0C0",
      "palette": [
        "#D8C0C0"
      ],
      "fit": "宽松",
      "pattern": "纯色",
      "material": "其他",
      "season": [
        "秋",
        "冬"
      ],
      "style_tags": [
        "通勤"
      ],
      "occasions": [
        "通勤"
      ],
      "formality": 3,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5528",
      "image": "assets/items/_new_women/outer/outer_03.jpg",
      "category": "outer",
      "type": "牛仔外套",
      "color_name": "白",
      "color_hex": "#C0C0C0",
      "palette": [
        "#C0C0C0"
      ],
      "fit": "宽松",
      "pattern": "牛仔",
      "material": "其他",
      "season": [
        "秋",
        "冬"
      ],
      "style_tags": [
        "通勤"
      ],
      "occasions": [
        "通勤"
      ],
      "formality": 3,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5529",
      "image": "assets/items/_new_women/shoes/shoe_01.jpg",
      "category": "shoes",
      "type": "高跟凉鞋",
      "color_name": "白",
      "color_hex": "#D8D8C0",
      "palette": [
        "#D8D8C0"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "约会"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5530",
      "image": "assets/items/_new_women/shoes/shoe_02.jpg",
      "category": "shoes",
      "type": "穆勒高跟鞋",
      "color_name": "白",
      "color_hex": "#D8C0C0",
      "palette": [
        "#D8C0C0"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "约会"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5531",
      "image": "assets/items/_new_women/shoes/shoe_03.jpg",
      "category": "shoes",
      "type": "尖头高跟鞋",
      "color_name": "米",
      "color_hex": "#D8D8D8",
      "palette": [
        "#D8D8D8"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "约会"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5532",
      "image": "assets/items/_new_women/shoes/shoe_04.jpg",
      "category": "shoes",
      "type": "后空高跟鞋",
      "color_name": "白",
      "color_hex": "#D8D8D8",
      "palette": [
        "#D8D8D8"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "约会"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5533",
      "image": "assets/items/_new_women/shoes/shoe_05.jpg",
      "category": "shoes",
      "type": "拼色高跟鞋",
      "color_name": "米白拼黑",
      "color_hex": "#C0C0C0",
      "palette": [
        "#C0C0C0"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "约会"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5534",
      "image": "assets/items/_new_women/shoes/shoe_06.jpg",
      "category": "shoes",
      "type": "厚底短靴",
      "color_name": "米",
      "color_hex": "#D8C0C0",
      "palette": [
        "#D8C0C0"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "约会"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5535",
      "image": "assets/items/_new_women/shoes/shoe_07.jpg",
      "category": "shoes",
      "type": "系带单鞋",
      "color_name": "白",
      "color_hex": "#C0C0C0",
      "palette": [
        "#C0C0C0"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "约会"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5536",
      "image": "assets/items/_new_women/shoes/shoe_08.jpg",
      "category": "shoes",
      "type": "乐福单鞋",
      "color_name": "白",
      "color_hex": "#D8D8D8",
      "palette": [
        "#D8D8D8"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "约会"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5537",
      "image": "assets/items/_new_women/shoes/shoe_09.jpg",
      "category": "shoes",
      "type": "乐福鞋",
      "color_name": "白",
      "color_hex": "#A8A8A8",
      "palette": [
        "#A8A8A8"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "约会"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5538",
      "image": "assets/items/_new_women/shoes/shoe_10.jpg",
      "category": "shoes",
      "type": "厚底单鞋",
      "color_name": "白",
      "color_hex": "#C0C0C0",
      "palette": [
        "#C0C0C0"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "约会"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5539",
      "image": "assets/items/_new_women/shoes/shoe_12.jpg",
      "category": "shoes",
      "type": "粗跟短靴",
      "color_name": "黑",
      "color_hex": "#181818",
      "palette": [
        "#181818"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "约会"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5540",
      "image": "assets/items/_new_women/shoes/shoe_14.jpg",
      "category": "shoes",
      "type": "搭扣短靴",
      "color_name": "黑",
      "color_hex": "#000000",
      "palette": [
        "#000000"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "春",
        "秋"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "约会"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5541",
      "image": "assets/items/_new_women/bags/bag_01.jpg",
      "category": "bag",
      "type": "手提包",
      "color_name": "棕白",
      "color_hex": "#C0C0C0",
      "palette": [
        "#C0C0C0"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "全季"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "日常"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5542",
      "image": "assets/items/_new_women/bags/bag_02.jpg",
      "category": "bag",
      "type": "绗缝斜挎包",
      "color_name": "白",
      "color_hex": "#D8D8D8",
      "palette": [
        "#D8D8D8"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "全季"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "日常"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5543",
      "image": "assets/items/_new_women/bags/bag_03.jpg",
      "category": "bag",
      "type": "单肩包",
      "color_name": "白",
      "color_hex": "#C0C0C0",
      "palette": [
        "#C0C0C0"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "全季"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "日常"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5544",
      "image": "assets/items/_new_women/bags/bag_04.jpg",
      "category": "bag",
      "type": "斜挎相机包",
      "color_name": "白",
      "color_hex": "#D8D8D8",
      "palette": [
        "#D8D8D8"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "全季"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "日常"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5545",
      "image": "assets/items/_new_women/bags/bag_05.jpg",
      "category": "bag",
      "type": "手提公文包",
      "color_name": "白",
      "color_hex": "#F0D8D8",
      "palette": [
        "#F0D8D8"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "全季"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "日常"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5546",
      "image": "assets/items/_new_women/bags/bag_06.jpg",
      "category": "bag",
      "type": "圆形斜挎包",
      "color_name": "白",
      "color_hex": "#D8D8D8",
      "palette": [
        "#D8D8D8"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "全季"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "日常"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5547",
      "image": "assets/items/_new_women/bags/bag_07.jpg",
      "category": "bag",
      "type": "木质提手包",
      "color_name": "白",
      "color_hex": "#C0C0C0",
      "palette": [
        "#C0C0C0"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "全季"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "日常"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5548",
      "image": "assets/items/_new_women/bags/bag_08.jpg",
      "category": "bag",
      "type": "拼色斜挎包",
      "color_name": "黑白",
      "color_hex": "#D8C0C0",
      "palette": [
        "#D8C0C0"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "全季"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "日常"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5549",
      "image": "assets/items/_new_women/bags/bag_09.jpg",
      "category": "bag",
      "type": "圆形斜挎包",
      "color_name": "黑",
      "color_hex": "#000000",
      "palette": [
        "#000000"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "全季"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "日常"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5550",
      "image": "assets/items/_new_women/bags/bag_10.jpg",
      "category": "bag",
      "type": "手提托特包",
      "color_name": "黑",
      "color_hex": "#181818",
      "palette": [
        "#181818"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "全季"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "日常"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5551",
      "image": "assets/items/_new_women/bags/bag_12.jpg",
      "category": "bag",
      "type": "翻盖斜挎包",
      "color_name": "黑",
      "color_hex": "#000000",
      "palette": [
        "#000000"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "皮革",
      "season": [
        "全季"
      ],
      "style_tags": [
        "简约"
      ],
      "occasions": [
        "通勤",
        "日常"
      ],
      "formality": 2,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5552",
      "image": "assets/items/_new_women/jewelry/jewel_01.jpg",
      "category": "accessory",
      "type": "耳环",
      "color_name": "米",
      "color_hex": "#D8C0C0",
      "palette": [
        "#D8C0C0"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "其他",
      "season": [
        "全季"
      ],
      "style_tags": [
        "精致"
      ],
      "occasions": [
        "约会",
        "日常"
      ],
      "formality": 1,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5553",
      "image": "assets/items/_new_women/jewelry/jewel_02.jpg",
      "category": "accessory",
      "type": "耳钩耳环",
      "color_name": "银",
      "color_hex": "#D8D8D8",
      "palette": [
        "#D8D8D8"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "其他",
      "season": [
        "全季"
      ],
      "style_tags": [
        "精致"
      ],
      "occasions": [
        "约会",
        "日常"
      ],
      "formality": 1,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5554",
      "image": "assets/items/_new_women/jewelry/jewel_03.jpg",
      "category": "accessory",
      "type": "长款耳环",
      "color_name": "白",
      "color_hex": "#D8D8D8",
      "palette": [
        "#D8D8D8"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "其他",
      "season": [
        "全季"
      ],
      "style_tags": [
        "精致"
      ],
      "occasions": [
        "约会",
        "日常"
      ],
      "formality": 1,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5555",
      "image": "assets/items/_new_women/jewelry/jewel_04.jpg",
      "category": "accessory",
      "type": "圆圈耳环",
      "color_name": "金",
      "color_hex": "#D8A878",
      "palette": [
        "#D8A878"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "其他",
      "season": [
        "全季"
      ],
      "style_tags": [
        "精致"
      ],
      "occasions": [
        "约会",
        "日常"
      ],
      "formality": 1,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5556",
      "image": "assets/items/_new_women/jewelry/jewel_05.jpg",
      "category": "accessory",
      "type": "心形项链",
      "color_name": "银",
      "color_hex": "#D8D8D8",
      "palette": [
        "#D8D8D8"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "其他",
      "season": [
        "全季"
      ],
      "style_tags": [
        "精致"
      ],
      "occasions": [
        "约会",
        "日常"
      ],
      "formality": 1,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5557",
      "image": "assets/items/_new_women/jewelry/jewel_06.jpg",
      "category": "accessory",
      "type": "吊坠项链",
      "color_name": "银",
      "color_hex": "#C0C0C0",
      "palette": [
        "#C0C0C0"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "其他",
      "season": [
        "全季"
      ],
      "style_tags": [
        "精致"
      ],
      "occasions": [
        "约会",
        "日常"
      ],
      "formality": 1,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    },
    {
      "id": "w5558",
      "image": "assets/items/_new_women/jewelry/jewel_07.jpg",
      "category": "accessory",
      "type": "珍珠项链",
      "color_name": "白",
      "color_hex": "#A8A890",
      "palette": [
        "#A8A890"
      ],
      "fit": "标准",
      "pattern": "纯色",
      "material": "其他",
      "season": [
        "全季"
      ],
      "style_tags": [
        "精致"
      ],
      "occasions": [
        "约会",
        "日常"
      ],
      "formality": 1,
      "source": "web",
      "manual_override": true,
      "cut_ok": true
    }
  ],
  "samples": {
    "schema_version": 2,
    "note": "内置示例衣物图：无素材时可直接入柜跑通主链路。tags 由 VLM 真实打标产出（schema v2：含 material / occasions），断网时前端直接复用这份标签本地入柜。",
    "samples": []
  },
  "slot-samples": {
    "_note": "结果页的「示例卡」数据。只在衣橱里真的挑不出某一格时用（不是占位装饰）——告诉用户这一格长什么样，不是宣称你衣柜里有它。改文案只动这个文件。",
    "slots": {
      "top": [
        {
          "type": "米白针织开衫",
          "color_name": "米白",
          "color_hex": "#EDE6DA",
          "style_tags": [
            "温柔",
            "简约"
          ],
          "why": "上身软一点，什么下装都压得住"
        },
        {
          "type": "纯白衬衫",
          "color_name": "纯白",
          "color_hex": "#F5F4F1",
          "style_tags": [
            "通勤",
            "简约"
          ],
          "why": "最稳的一件，配裙子配裤子都不挑"
        }
      ],
      "bottom": [
        {
          "type": "直筒长裤",
          "color_name": "雾灰",
          "color_hex": "#A8B0B8",
          "style_tags": [
            "简约",
            "通勤"
          ],
          "why": "直筒显腿直，颜色跟鞋接近就不出错"
        },
        {
          "type": "A 字半身裙",
          "color_name": "燕麦",
          "color_hex": "#D8CBB6",
          "style_tags": [
            "温柔",
            "文艺"
          ],
          "why": "A 字版型收腰，上身宽松也能压住"
        }
      ],
      "shoes": [
        {
          "type": "乐福鞋",
          "color_name": "米白",
          "color_hex": "#EDE8DC",
          "style_tags": [
            "通勤",
            "简约"
          ],
          "why": "白鞋收尾，整套亮一个度"
        },
        {
          "type": "小白鞋",
          "color_name": "纯白",
          "color_hex": "#F5F4F1",
          "style_tags": [
            "简约",
            "运动"
          ],
          "why": "什么风格都能配，走路也舒服"
        }
      ],
      "outer": [
        {
          "type": "卡其风衣",
          "color_name": "卡其",
          "color_hex": "#B8895A",
          "style_tags": [
            "通勤",
            "复古"
          ],
          "why": "穿脱都在线，秋天最好用的一件"
        },
        {
          "type": "短款夹克",
          "color_name": "炭灰",
          "color_hex": "#4A4A4E",
          "style_tags": [
            "简约",
            "运动"
          ],
          "why": "短款放在腰线上，比例直接好看一档"
        }
      ]
    }
  },
  "tarot": [
    {
      "id": "tarot_fool",
      "name": "愚者",
      "name_en": "The Fool",
      "image": "assets/tarot/fool.svg",
      "style_tags": [
        "慵懒",
        "运动"
      ],
      "must_colors": [
        "米白",
        "亮黄",
        "浅蓝",
        "白"
      ],
      "avoid_colors": [],
      "season": [
        "春",
        "夏"
      ],
      "vibe": "free / light",
      "story": "愚者正位：轻装上阵，今天不必把所有事都想清楚"
    },
    {
      "id": "tarot_magician",
      "name": "魔术师",
      "name_en": "The Magician",
      "image": "assets/tarot/magician.svg",
      "style_tags": [
        "明艳",
        "通勤"
      ],
      "must_colors": [
        "正红",
        "亮黄",
        "纯白",
        "焦糖"
      ],
      "avoid_colors": [],
      "season": [
        "春",
        "秋"
      ],
      "vibe": "focus / spark",
      "story": "魔术师正位：你手里的牌够用，穿得像今天能成事"
    },
    {
      "id": "tarot_priestess",
      "name": "女祭司",
      "name_en": "The High Priestess",
      "image": "assets/tarot/priestess.svg",
      "style_tags": [
        "文艺",
        "简约"
      ],
      "must_colors": [
        "雾紫",
        "银灰",
        "藏蓝",
        "纯白"
      ],
      "avoid_colors": [
        "正红"
      ],
      "season": [
        "秋",
        "冬"
      ],
      "vibe": "inner / quiet",
      "story": "女祭司正位：先听自己的，穿得沉一点没关系"
    },
    {
      "id": "tarot_empress",
      "name": "皇后",
      "name_en": "The Empress",
      "image": "assets/tarot/empress.svg",
      "style_tags": [
        "甜美",
        "文艺"
      ],
      "must_colors": [
        "藕粉",
        "玫粉",
        "奶油白",
        "米色"
      ],
      "avoid_colors": [],
      "season": [
        "春",
        "夏"
      ],
      "vibe": "soft / abundant",
      "story": "皇后正位：今天值得被好好对待，挑柔软的那件"
    },
    {
      "id": "tarot_emperor",
      "name": "皇帝",
      "name_en": "The Emperor",
      "image": "assets/tarot/emperor.svg",
      "style_tags": [
        "通勤",
        "简约"
      ],
      "must_colors": [
        "炭灰",
        "藏蓝",
        "纯黑",
        "驼色"
      ],
      "avoid_colors": [
        "亮黄"
      ],
      "season": [
        "秋",
        "冬"
      ],
      "vibe": "steady / solid",
      "story": "皇帝正位：把边界立住，穿得干净利落就好"
    },
    {
      "id": "tarot_hierophant",
      "name": "教皇",
      "name_en": "The Hierophant",
      "image": "assets/tarot/hierophant.svg",
      "style_tags": [
        "通勤",
        "复古"
      ],
      "must_colors": [
        "米白",
        "驼色",
        "藏蓝",
        "卡其"
      ],
      "avoid_colors": [],
      "season": [
        "春",
        "秋"
      ],
      "vibe": "classic / trusted",
      "story": "教皇正位：按你自己认的那套规矩穿，不会错"
    },
    {
      "id": "tarot_lovers",
      "name": "恋人",
      "name_en": "The Lovers",
      "image": "assets/tarot/lovers.svg",
      "style_tags": [
        "甜美",
        "文艺"
      ],
      "must_colors": [
        "藕粉",
        "奶油白",
        "浅蓝",
        "玫粉"
      ],
      "avoid_colors": [
        "纯黑"
      ],
      "season": [
        "春",
        "夏"
      ],
      "vibe": "warm / open",
      "story": "恋人正位：今天适合穿得让人想靠近"
    },
    {
      "id": "tarot_chariot",
      "name": "战车",
      "name_en": "The Chariot",
      "image": "assets/tarot/chariot.svg",
      "style_tags": [
        "运动",
        "明艳"
      ],
      "must_colors": [
        "藏蓝",
        "正红",
        "纯白",
        "牛仔蓝"
      ],
      "avoid_colors": [],
      "season": [
        "春",
        "秋"
      ],
      "vibe": "drive / bold",
      "story": "战车正位：目标在前，穿得利落好赶路"
    },
    {
      "id": "tarot_strength",
      "name": "力量",
      "name_en": "Strength",
      "image": "assets/tarot/strength.svg",
      "style_tags": [
        "运动",
        "简约"
      ],
      "must_colors": [
        "砖红",
        "焦糖",
        "米白",
        "驼色"
      ],
      "avoid_colors": [],
      "season": [
        "秋",
        "冬"
      ],
      "vibe": "warm / steady",
      "story": "力量正位：温柔也是力气，选一件撑得住场面的"
    },
    {
      "id": "tarot_hermit",
      "name": "隐者",
      "name_en": "The Hermit",
      "image": "assets/tarot/hermit.svg",
      "style_tags": [
        "极简",
        "通勤"
      ],
      "must_colors": [
        "灰",
        "棕",
        "卡其"
      ],
      "avoid_colors": [],
      "season": [
        "秋",
        "冬"
      ],
      "vibe": "quiet / focused",
      "story": "隐者正位：把世界调成静音，选一身不吵的衣服"
    },
    {
      "id": "tarot_wheel",
      "name": "命运之轮",
      "name_en": "Wheel of Fortune",
      "image": "assets/tarot/wheel.svg",
      "style_tags": [
        "复古",
        "明艳"
      ],
      "must_colors": [
        "雾紫",
        "亮黄",
        "玫粉",
        "焦糖"
      ],
      "avoid_colors": [],
      "season": [
        "春",
        "秋"
      ],
      "vibe": "turn / chance",
      "story": "命运之轮正位：节奏会变，穿好走路的那身"
    },
    {
      "id": "tarot_justice",
      "name": "正义",
      "name_en": "Justice",
      "image": "assets/tarot/justice.svg",
      "style_tags": [
        "简约",
        "通勤"
      ],
      "must_colors": [
        "纯白",
        "炭灰",
        "藏蓝",
        "银灰"
      ],
      "avoid_colors": [],
      "season": [
        "春",
        "秋"
      ],
      "vibe": "clear / fair",
      "story": "正义正位：干净对称一点，心里会更稳"
    },
    {
      "id": "tarot_hanged",
      "name": "倒吊人",
      "name_en": "The Hanged Man",
      "image": "assets/tarot/hanged.svg",
      "style_tags": [
        "慵懒",
        "文艺"
      ],
      "must_colors": [
        "浅蓝",
        "银灰",
        "雾紫",
        "米白"
      ],
      "avoid_colors": [
        "正红"
      ],
      "season": [
        "春",
        "秋"
      ],
      "vibe": "pause / soft",
      "story": "倒吊人正位：今天可以慢半拍，穿松一点"
    },
    {
      "id": "tarot_death",
      "name": "死神",
      "name_en": "Death",
      "image": "assets/tarot/death.svg",
      "style_tags": [
        "极简",
        "明艳"
      ],
      "must_colors": [
        "纯黑",
        "纯白",
        "酒红",
        "炭灰"
      ],
      "avoid_colors": [],
      "season": [
        "秋",
        "冬"
      ],
      "vibe": "end / begin",
      "story": "死神正位：旧的翻篇，穿一件像重新开始的"
    },
    {
      "id": "tarot_temperance",
      "name": "节制",
      "name_en": "Temperance",
      "image": "assets/tarot/temperance.svg",
      "style_tags": [
        "简约",
        "文艺"
      ],
      "must_colors": [
        "浅蓝",
        "米白",
        "雾紫",
        "燕麦"
      ],
      "avoid_colors": [],
      "season": [
        "春",
        "秋"
      ],
      "vibe": "balance / calm",
      "story": "节制正位：刚好就好，别用力过猛"
    },
    {
      "id": "tarot_devil",
      "name": "恶魔",
      "name_en": "The Devil",
      "image": "assets/tarot/devil.svg",
      "style_tags": [
        "明艳",
        "复古"
      ],
      "must_colors": [
        "酒红",
        "纯黑",
        "焦糖",
        "砖红"
      ],
      "avoid_colors": [],
      "season": [
        "秋",
        "冬"
      ],
      "vibe": "dare / rich",
      "story": "恶魔正位：今天可以大胆一点，穿点有戏的"
    },
    {
      "id": "tarot_tower",
      "name": "高塔",
      "name_en": "The Tower",
      "image": "assets/tarot/tower.svg",
      "style_tags": [
        "运动",
        "简约"
      ],
      "must_colors": [
        "炭灰",
        "纯黑",
        "正红",
        "银灰"
      ],
      "avoid_colors": [],
      "season": [
        "秋",
        "冬"
      ],
      "vibe": "shake / clear",
      "story": "高塔正位：计划会变，穿好活动方便的那身"
    },
    {
      "id": "tarot_star",
      "name": "星星",
      "name_en": "The Star",
      "image": "assets/tarot/star.svg",
      "style_tags": [
        "温柔",
        "简约"
      ],
      "must_colors": [
        "奶油白",
        "浅紫",
        "白",
        "米"
      ],
      "avoid_colors": [
        "黑"
      ],
      "season": [
        "春",
        "秋"
      ],
      "vibe": "soft / cozy",
      "story": "星星正位：今天适合温柔地对待自己"
    },
    {
      "id": "tarot_moon",
      "name": "月亮",
      "name_en": "The Moon",
      "image": "assets/tarot/moon.svg",
      "style_tags": [
        "复古",
        "极简"
      ],
      "must_colors": [
        "蓝",
        "灰",
        "银"
      ],
      "avoid_colors": [],
      "season": [
        "秋",
        "冬"
      ],
      "vibe": "dreamy / mysterious",
      "story": "月亮正位：直觉会带你走对的那条路，穿得放松一点"
    },
    {
      "id": "tarot_sun",
      "name": "太阳",
      "name_en": "The Sun",
      "image": "assets/tarot/sun.svg",
      "style_tags": [
        "甜美",
        "运动"
      ],
      "must_colors": [
        "黄",
        "橙",
        "奶油"
      ],
      "avoid_colors": [],
      "season": [
        "春",
        "夏"
      ],
      "vibe": "bright / warm",
      "story": "太阳正位：把光穿在身上，今天会顺"
    },
    {
      "id": "tarot_judgement",
      "name": "审判",
      "name_en": "Judgement",
      "image": "assets/tarot/judgement.svg",
      "style_tags": [
        "明艳",
        "通勤"
      ],
      "must_colors": [
        "纯白",
        "亮黄",
        "雾紫",
        "正红"
      ],
      "avoid_colors": [],
      "season": [
        "春",
        "秋"
      ],
      "vibe": "wake / clear",
      "story": "审判正位：听清自己真正想穿的那件"
    },
    {
      "id": "tarot_world",
      "name": "世界",
      "name_en": "The World",
      "image": "assets/tarot/world.svg",
      "style_tags": [
        "文艺",
        "明艳"
      ],
      "must_colors": [
        "雾紫",
        "墨绿",
        "亮黄",
        "米白"
      ],
      "avoid_colors": [],
      "season": [
        "春",
        "秋"
      ],
      "vibe": "whole / arrive",
      "story": "世界正位：这一身就是完整的你，出门吧"
    }
  ]
};
