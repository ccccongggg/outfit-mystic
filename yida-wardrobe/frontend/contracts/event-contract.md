# UI Event Contract V1

这些事件用于行为日志/分析；不要求本次黑客松全部上报。

| event | payload |
|---|---|
| `target_date_changed` | `target_date` |
| `game_opened` | `source_type` |
| `home_game_removed` | `source_type` |
| `home_game_added` | `source_type` |
| `tarot_card_drawn` | `card_no`, `reversed`, `draw_index` |
| `energy_changed` | `value` |
| `identity_selected` | `identity`, `channel` |
| `intent_parsed` | `raw_text`, `parsed_summary` |
| `recommendation_created` | `session_id`, `source_type`, `target_date` |
| `outfit_swiped` | `session_id`, `outfit_id`, `direction` |
| `outfit_confirmed` | `outfit_id`, `target_date` |
| `outfit_overwritten` | `old_outfit_id`, `new_outfit_id`, `target_date` |
| `ai_reference_viewed` | `outfit_id` |
