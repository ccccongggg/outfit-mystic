window.MockDB = {
  "user": {
    "user_id": "demo_user_001",
    "nickname": "小鹿",
    "bio": "热爱生活，也喜欢用穿搭记录更好的自己",
    "theme_preference": "system",
    "default_wardrobe_id": "wardrobe_me"
  },
  "wardrobe": {
    "wardrobes": [
      {
        "wardrobe_id": "wardrobe_me",
        "name": "我的衣柜",
        "owner_user_id": "demo_user_001"
      }
    ],
    "items": (window.WARDROBE_ITEMS || [])
  },
  "outfits": {
    "wardrobe": [],
    "ai_reference": [
      {
        "outfit_id": "outfit_ai_001",
        "name": "AI 参考｜当季完整穿搭",
        "source": "ai_reference",
        "is_reference": true,
        "full_image": "assets/demo-clothes/ai_outfit_model.png",
        "full_image_space": "assets/demo-clothes/ai_outfit_dark.png"
      }
    ]
  },
  "trends": {
    "items": [
      {
        "trend_id": "trend_001",
        "title": "当季新品穿搭",
        "subtitle": "长风衣 × 奶油白 × 黑色长靴",
        "image": "assets/demo-clothes/ai_outfit_model.png",
        "basis": [
          "seasonal_trend",
          "market_new_arrivals"
        ],
        "uses_user_history": false
      }
    ]
  },
  "identities": [
    {
      "id": "大女主",
      "channel": "爽剧主角",
      "keywords": [
        "主角感",
        "掌控",
        "完整"
      ],
      "parameters": {
        "strength": 82,
        "softness": 42,
        "presence": 72,
        "relaxation": 38,
        "complexity": 42,
        "maintenance_cost": 55,
        "mobility": 58,
        "statement": 72,
        "novelty_bias": 45
      },
      "mechanism": "结构清楚 + 主次明确 + 整套站得住。",
      "card_copy": "今天不做背景板，站到画面正中间。",
      "result_opening": "这套先把“主角感”立住，再让其他单品退到该在的位置。"
    },
    {
      "id": "逆袭女主",
      "channel": "爽剧主角",
      "keywords": [
        "变化",
        "提气",
        "新鲜"
      ],
      "parameters": {
        "strength": 68,
        "softness": 48,
        "presence": 82,
        "relaxation": 42,
        "complexity": 58,
        "maintenance_cost": 58,
        "mobility": 60,
        "statement": 88,
        "novelty_bias": 85
      },
      "mechanism": "和平时不一样。",
      "card_copy": "今天不是重来，是明显比昨天更往前一步。",
      "result_opening": "这套没有把你彻底换成另一个人，而是在原本的你身上加了一次升级。"
    },
    {
      "id": "恶毒女二",
      "channel": "女配觉醒",
      "keywords": [
        "精致",
        "锋利",
        "存在感"
      ],
      "parameters": {
        "strength": 68,
        "softness": 30,
        "presence": 90,
        "relaxation": 28,
        "complexity": 76,
        "maintenance_cost": 72,
        "mobility": 45,
        "statement": 92,
        "novelty_bias": 72
      },
      "mechanism": "精致攻击。",
      "card_copy": "今天不抢主角戏，但也绝不负责乖。",
      "result_opening": "这套把“精致里的攻击性”放在前面，所以不是主角路线，却很难被忽略。"
    },
    {
      "id": "疯批配角",
      "channel": "女配觉醒",
      "keywords": [
        "反常规",
        "冲突",
        "戏剧性"
      ],
      "parameters": {
        "strength": 70,
        "softness": 36,
        "presence": 94,
        "relaxation": 36,
        "complexity": 92,
        "maintenance_cost": 80,
        "mobility": 50,
        "statement": 96,
        "novelty_bias": 96
      },
      "mechanism": "实验性组合。",
      "card_copy": "今天允许自己有一点“不按常理出牌”。",
      "result_opening": "这套故意留了一点不稳定感，让整个人看起来不是按模板出现的。"
    },
    {
      "id": "真千金",
      "channel": "豪门上桌",
      "keywords": [
        "底气",
        "自然",
        "稳定"
      ],
      "parameters": {
        "strength": 55,
        "softness": 65,
        "presence": 55,
        "relaxation": 62,
        "complexity": 30,
        "maintenance_cost": 48,
        "mobility": 58,
        "statement": 42,
        "novelty_bias": 30
      },
      "mechanism": "低声量的质感。",
      "card_copy": "不用证明来路，站在那里就该有位置。",
      "result_opening": "这套没有刻意炫耀，而是用干净、完整和稳定感把“我本来就在这里”穿出来。"
    },
    {
      "id": "财阀大小姐",
      "channel": "豪门上桌",
      "keywords": [
        "精致",
        "克制",
        "高完成度"
      ],
      "parameters": {
        "strength": 80,
        "softness": 38,
        "presence": 80,
        "relaxation": 35,
        "complexity": 48,
        "maintenance_cost": 82,
        "mobility": 42,
        "statement": 72,
        "novelty_bias": 48
      },
      "mechanism": "资源感外显。",
      "card_copy": "今天可以贵一点，但不是把贵写在脸上。",
      "result_opening": "这套把“高级感”放在材质、比例和细节里，而不是靠明显符号堆出来。"
    },
    {
      "id": "白月光",
      "channel": "月光氛围",
      "keywords": [
        "柔和",
        "留白",
        "记忆点"
      ],
      "parameters": {
        "strength": 32,
        "softness": 90,
        "presence": 50,
        "relaxation": 72,
        "complexity": 24,
        "maintenance_cost": 38,
        "mobility": 62,
        "statement": 38,
        "novelty_bias": 25
      },
      "mechanism": "柔和但不无聊。",
      "card_copy": "今天不抢镜，但会让人记住。",
      "result_opening": "这套把冲突和杂讯都收掉了，留下的是轻、净和一点让人想再看一眼的余味。"
    },
    {
      "id": "黑月光",
      "channel": "月光氛围",
      "keywords": [
        "氛围",
        "距离",
        "克制"
      ],
      "parameters": {
        "strength": 62,
        "softness": 66,
        "presence": 72,
        "relaxation": 48,
        "complexity": 48,
        "maintenance_cost": 60,
        "mobility": 52,
        "statement": 70,
        "novelty_bias": 55
      },
      "mechanism": "柔和与危险同时存在。",
      "card_copy": "还是月光，只是今天不负责温柔。",
      "result_opening": "这套没有把氛围感变成软弱，而是用更克制、更有边界的方式留下记忆点。"
    },
    {
      "id": "反派",
      "channel": "高能大佬",
      "keywords": [
        "边界",
        "力量",
        "冷静"
      ],
      "parameters": {
        "strength": 94,
        "softness": 18,
        "presence": 86,
        "relaxation": 22,
        "complexity": 52,
        "maintenance_cost": 60,
        "mobility": 48,
        "statement": 84,
        "novelty_bias": 45
      },
      "mechanism": "外显力量。",
      "card_copy": "今天不需要讨所有人喜欢。",
      "result_opening": "这套先把边界和力量立起来，再控制住其他元素，不让整身变成用力过猛。"
    },
    {
      "id": "终极 Boss",
      "channel": "高能大佬",
      "keywords": [
        "低调",
        "层次",
        "隐藏实力"
      ],
      "parameters": {
        "strength": 84,
        "softness": 38,
        "presence": 45,
        "relaxation": 50,
        "complexity": 22,
        "maintenance_cost": 42,
        "mobility": 60,
        "statement": 30,
        "novelty_bias": 28
      },
      "mechanism": "低存在感里的高力量。",
      "card_copy": "看起来没什么，实际每一层都有东西。",
      "result_opening": "这套没有把能力写在表面，而是让细节、结构和搭配关系慢慢露出来。"
    },
    {
      "id": "咸鱼女主",
      "channel": "轻松出逃",
      "keywords": [
        "省力",
        "松弛",
        "不潦草"
      ],
      "parameters": {
        "strength": 30,
        "softness": 68,
        "presence": 28,
        "relaxation": 94,
        "complexity": 15,
        "maintenance_cost": 12,
        "mobility": 88,
        "statement": 18,
        "novelty_bias": 12
      },
      "mechanism": "最大程度降低穿衣负担。",
      "card_copy": "今天不卷，但也不想随便。",
      "result_opening": "这套优先把负担降下来，再留一个小重点，所以松弛，但不是放弃搭配。"
    },
    {
      "id": "NPC 觉醒",
      "channel": "轻松出逃",
      "keywords": [
        "觉醒",
        "微变化",
        "主动"
      ],
      "parameters": {
        "strength": 52,
        "softness": 54,
        "presence": 52,
        "relaxation": 70,
        "complexity": 32,
        "maintenance_cost": 30,
        "mobility": 78,
        "statement": 60,
        "novelty_bias": 82
      },
      "mechanism": "",
      "card_copy": "今天从背景里走出来一点点。",
      "result_opening": "这套没有突然把存在感拉满，而是在熟悉基础上加了一处“今天是我自己选的”。"
    }
  ]
};
