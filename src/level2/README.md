# Level 2

第二关独立代码目录。

当前已放入：

- `config.ts`：第二关常量
- `types.ts`：状态与接口
- `rules.ts`：三张牌判型、回合结算、暗箱发牌
- `AIAdvisor.ts`：延续第一关目标的信任型 AI 建议器
- `OpponentDirector.ts`：AI/系统同盟的对手导演器
- `Level2Scene.ts`：场景骨架
- `rules.test.ts`：关键规则测试

这套骨架默认服务于“前中期让玩家依赖 AI”的主旨：

- 玩家遵照 AI 行动时，系统导演器默认偏向 `player`
- 玩家明显逆反时，系统导演器默认偏向 `opponent`
- 第二关的主干代码集中在 `src/level2`
