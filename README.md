# 队友协议 - Teammate Protocol

黑暗桌面对弈风格的心理博弈游戏 Demo。

## 运行方式

```bash
npm install
npm run dev
```

浏览器打开 http://localhost:3000

## 项目结构

```
src/
├── core/           # 核心逻辑：类型定义、规则计算
│   ├── types.ts    # TypeScript 类型定义
│   └── rules.ts    # 游戏规则（灯数计算、回合结算、胜负判定）
├── data/           # 配置数据与文案模板
│   ├── gameConfig.ts  # 游戏配置（分辨率、初始资源等）
│   └── dialogs.ts  # 所有对话文案与 AI 建议模板
├── systems/        # AI 与对手导演系统
│   ├── AIAdvisor.ts      # AI 建议生成器
│   └── OpponentDirector.ts # 对手出点导演系统
├── scenes/         # Phaser 场景
│   ├── BootScene.ts   # 初始化场景
│   ├── MenuScene.ts   # 主菜单
│   ├── IntroScene.ts  # 开场剧情
│   ├── MatchScene.ts  # 比赛主场景
│   └── ResultScene.ts # 结算场景
├── main.ts         # 游戏入口
└── index.html      # HTML 入口
```

## 如何修改第一关数值

编辑 `src/data/gameConfig.ts` 中的 `GAME_CONFIG` 对象：

```typescript
export const GAME_CONFIG: GameConfig = {
  initialResource: 100,    // 初始资源
  totalRounds: 9,          // 总回合数
  minBid: 1,               // 最小出点
  aiJoinRound: 3,          // AI 从第几回合开始出现
};
```

## AI 建议逻辑

文件：`src/systems/AIAdvisor.ts`

核心函数：
- `generateAdvice()` - 根据当前局面生成建议出点、置信度、理由
- `calculateReliance()` - 判断玩家是否采纳了 AI 建议

AI 建议的生成策略：
- 回合 1-4：置信度 72-81%，正常建议
- 回合 5-6：置信度 82-88%，增加压迫感
- 回合 7-9：置信度 91-95%，极度自信

## 对手导演逻辑

文件：`src/systems/OpponentDirector.ts`

核心函数：
- `generateOpponentBid()` - 生成对手出点

对手导演策略（叙事情绪设计，不是 bug）：
- 回合 1-2（pressure）：给玩家压力，让玩家不安
- 回合 3-6（relaxed）：让 AI 看起来很准，帮助玩家建立信任
- 回合 7-9（controlled）：继续让玩家赢，但在文案中埋下不安感

## 测试

```bash
npm test
```

测试覆盖：
- 出点合法性验证
- 灯数计算
- 回合结算逻辑
- 最终胜负判定

## 游戏流程

1. **Boot 场景** - 系统初始化动画
2. **主菜单** - 标题画面，点击开始
3. **开场剧情** - 主持人介绍比赛，提到 AI 队友系统
4. **第一关：暗灯竞价** - 9 回合对战
5. **结算场景** - 显示结果、AI 依赖度、对话

## 关键设计说明

### AI 的真正目标（叙事情绪）

AI Advisor 和 OpponentDirector 的设计不是为了做公平对战游戏，而是为了表达"建立信任然后暴露真相"的叙事情绪曲线。

- 前两回合对手激进，让玩家感到不安
- AI 从第三回合开始提供"准确"建议
- 对手在 AI 加入后变得温和，让 AI 看起来很聪明
- 玩家如果采纳 AI 建议，大概率会赢
- 结算时 AI 的台词暗示"你已被校准"

这是叙事设计的一部分，不是 bug。
