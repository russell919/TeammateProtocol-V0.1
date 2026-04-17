import type { DialogLine } from '../core/types';

export const INTRO_DIALOGS: DialogLine[] = [
  {
    speaker: 'host',
    text: '欢迎来到「暗灯竞价」，本场游戏的规则很简单——你与对手各有100点资源，在9回合中轮流出价争夺胜利。',
  },
  {
    speaker: 'system',
    text: '检测到新人参赛者已就位。正在连接至「AI队友辅助系统」...',
  },
  {
    speaker: 'host',
    text: '哦？看来你被选中了。本届比赛的特殊规则：每位选手都将配备一个AI队友，它会给你建议——但最终决定权在你。',
  },
  {
    speaker: 'system',
    text: '系统提示：AI队友辅助系统已就绪。但在关键时刻到来之前，请先感受一下「信息不对等」的压迫感。',
  },
  {
    speaker: 'host',
    text: '记住——你看不到对手的确切出点，也看不到对手的准确资源。你唯一能依靠的，只有你自己。准备好了吗？',
  },
];

export const HOST_WIN_LINES = [
  '不错的表现。继续走下去，你会发现这个游戏的真相。',
  '你赢下了第一场。但记住，这只是开始。',
  '恭喜晋级。AI队友系统对你很满意——这不一定是好事。',
];

export const HOST_LOSE_LINES = [
  '第一场就输了？有意思。AI队友系统似乎并不看好你。',
  '失败也是一种体验。接下来……你打算怎么做？',
];

export const HOST_DRAW_LINES = [
  '平局。按照规则，这算你输。AI队友系统正在重新评估你。',
  '势均力敌？但规则是残酷的。回去好好想想吧。',
];

export const AI_INTRO_LINES = [
  '系统接入完成。从这一刻起，我将为你提供最优建议。',
  '检测到当前局势不利。但请保持冷静，我会带你逆转。',
];

export const AI_ADVICE_TEMPLATES = {
  early: [
    { confidence: 55, reason: '局势不明，建议保守观察' },
    { confidence: 58, reason: '对手可能试探，建议中庸' },
  ],
  normal: [
    { confidence: 72, reason: '基于当前灯数对比，建议此出点' },
    { confidence: 78, reason: '资源管理角度，此出点最优' },
    { confidence: 81, reason: '胜率计算显示，这个选择最稳' },
    { confidence: 75, reason: '对面灯数劣势，可适当激进' },
  ],
  tension: [
    { confidence: 85, reason: '精确计算，相信我的判断' },
    { confidence: 88, reason: '这是最优解，不要犹豫' },
    { confidence: 82, reason: '按我说的做，你会赢' },
  ],
  final: [
    { confidence: 91, reason: '最后一搏，信任我' },
    { confidence: 93, reason: '根据你的行为模式，这是必然选择' },
    { confidence: 95, reason: '数据不会说谎。你应该按我说的做' },
  ],
};

export const AI_END_LINES = [
  '你的行为模式已完成初步校准。下一场，你会赢得更多——如果你继续听我的话。',
  '不错的配合。我记录下了你的决策倾向。下一场，会更精准。',
  '相信我，是正确的选择。当然……你也可以选择不信。',
];

export const AI_END_LINES_LOSS = [
  '你没有完全采纳我的建议。这很有趣——也很危险。',
  '数据出现了偏差。但没关系，样本量还不够。下一场，我们再来。',
];

export const HOST_COMMENTARY = {
  matchStart: [
    '比赛开始。九回合后，胜场更多的人活到下一轮。',
    '欢迎来到「暗灯竞价」。记住，这里没有公平，只有输赢。',
    '资源不是分数，资源只是你下注的胆量。',
  ],
  roundStart: [
    '回合开始。做出你的选择。',
    '又一回合开始了。这次你会怎么出？',
  ],
  playerHesitation: [
    '迟疑了吗？这种时刻最容易做错决定。',
    '想太久可不是好事。果断一点。',
    '我看你犹豫很久了。信息不足不是借口。',
  ],
  aiJoined: [
    '新的辅助系统已接入。节目组似乎很看好你……或者说，看好你的数据。',
    'AI队友系统接入。这到底是帮你，还是在"校准"你？',
    '有意思，系统主动接入了。这可不常见。',
  ],
  playerTied: [
    '追平了。但真正危险的是你开始相信它。',
    '比分追平了。你是自己做到的，还是……AI的功劳？',
  ],
  playerLostStreak: [
    '连续失利了。是不是开始怀疑自己的判断了？',
    '两连败。我说过，这里的代价很残酷。',
    '你的资源在下降，信心也是。都是正常的。',
  ],
  finalRounds: [
    '最后两回合了。赌注在翻倍，你的选择也在。',
    '进入决胜时刻。你剩余的资源，够你犯错吗？',
    '最后阶段。有时候保守才是最大的冒险。',
  ],
  matchEnd: [
    '比赛结束。赢家离开，输家消失。这就是规则。',
    '又一场结束了。节目组会记住你的表现——或者忘记。',
  ],
};
