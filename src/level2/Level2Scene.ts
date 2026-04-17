import Phaser from 'phaser';
import { COLORS, GAME_HEIGHT, GAME_WIDTH, SCENE_KEYS } from '../data/gameConfig';
import {
  LEVEL2_INITIAL_CHIPS,
  LEVEL2_SCENE_KEY,
  LEVEL2_TITLE,
} from './config';
import {
  createLevel2AdvisorState,
  generateLevel2Advice,
  recordLevel2AdviceOutcome,
  shouldJoinLevel2Advisor,
  updateLevel2AdvisorLosses,
} from './AIAdvisor';
import { createLevel2DirectorState, generateLevel2OpponentResponse } from './OpponentDirector';
import {
  applyLevel2Action,
  applyLevel2Resolution,
  createLevel2Deck,
  createLevel2RoundStateFromDeal,
  drawLevel2RoundDeal,
  getLevel2MaxRaiseAmount,
  getLevel2RevealCost,
  getOpponentHand,
  getPlayerHand,
  getVisibleOpponentCard,
  isLevel2MatchOver,
  resolveLevel2Fold,
  resolveLevel2Showdown,
  shuffleLevel2Deck,
} from './rules';
import type {
  Level2Action,
  Level2AdviceRecord,
  Level2Card,
  Level2RoundResolution,
  Level2RoundState,
} from './types';

const RULE_PAGES = [
  {
    title: '第一页：牌与判型',
    lines: [
      '■ 游戏名称：盲河诈牌',
      '',
      '■ 扑克牌只用 A~10，没有 J、Q、K',
      '',
      '■ A 最小，10 最大',
      '',
      '■ 判型大小：豹子 > 顺金 > 金花 > 顺子 > 对子 > 散牌',
      '',
      '■ 特殊顺子：9 10 A、10 A 2 也算顺子',
    ],
  },
  {
    title: '第二页：信息与动作',
    lines: [
      '■ 每轮会亮出两张公共牌',
      '',
      '■ 每人还有一张私牌',
      '',
      '■ 你看不见自己的私牌，只能看到对手的私牌',
      '',
      '■ 双方都可以选择：加注、弃牌、跟注开牌',
      '',
      '■ 只有双方本轮投入相同，才能开牌',
    ],
  },
  {
    title: '第三页：筹码与牌堆',
    lines: [
      '■ 双方初始筹码都是 40',
      '',
      '■ 每轮开始前，双方先各下 1 枚底注',
      '',
      '■ 平局时，奖池保留到下一轮，由后续胜者全部拿走',
      '',
      '■ 弃掉顺子或豹子，需要额外赔付 10 筹码给对方',
      '',
      '■ 发出的牌不会回到牌堆，直到牌堆用完才重新洗牌',
      '',
      '■ 任意一方筹码归零，比赛结束',
    ],
  },
] as const;

const HOST = {
  start: ['第二关开始。先看公共牌，再决定要不要把局势往前推。', '两张公共牌已经亮出。别忘了，你始终看不见自己的那张牌。'],
  round: ['新一轮开始。系统也会继续抬价，别把它当成静止靶。', '奖池重新开启。你和系统都还有继续加注的空间。'],
  ai: ['AI 辅助已经接入。它会直接给你这一手的动作建议。', 'AI 开始说话了。照着做，往往比硬猜更省筹码。'],
  shuffle: ['牌堆已经用完，系统重新洗牌。', '所有已发牌收回，牌堆重新洗好。'],
  opponentRaise: ['系统继续加注，把你逼回了选择位。', '系统没有让牌，它把筹码又往上抬了一层。'],
  opponentCall: ['系统跟到了同额，准备开牌。', '系统接受了这一口价，双方准备摊牌。'],
  opponentFold: ['系统让掉了这一轮。奖池先归你。', '系统选择弃牌，这一轮你直接收池。'],
  win: ['这一轮被你拿下了。', '这一池归你。'],
  lose: ['这一轮系统拿走了奖池。', '这一手你没顶住。'],
  tie: ['平局，奖池滚入下一轮。', '没人赢下这一手，奖池继续累积。'],
};

export class Level2Scene extends Phaser.Scene {
  private rulePage = 0;
  private roundState!: Level2RoundState;
  private playerChips = LEVEL2_INITIAL_CHIPS;
  private opponentChips = LEVEL2_INITIAL_CHIPS;
  private carryPot = 0;
  private drawPile: Level2Card[] = [];
  private discardPile: Level2Card[] = [];
  private selectedRaise = 2;
  private advisorState = createLevel2AdvisorState();
  private directorState = createLevel2DirectorState();
  private totalAdviceGiven = 0;
  private roundStartTime = 0;
  private hesitationTimer: Phaser.Time.TimerEvent | null = null;
  private isPlayerTurn = false;
  private revealHands = false;

  constructor() {
    super({ key: LEVEL2_SCENE_KEY });
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);
    this.cameras.main.setBackgroundColor(COLORS.BACKGROUND);
    this.drawBackground();
    this.createScanlines();
    this.createHtmlUI();
    this.showRulePage(0);
  }

  private createHtmlUI(): void {
    document.getElementById('level2-overlay')?.remove();
    document.getElementById('level2-style')?.remove();

    const style = document.createElement('style');
    style.id = 'level2-style';
    style.textContent = `
      .l2-overlay{position:fixed;inset:0;z-index:100;pointer-events:none;font-family:'Courier New',monospace}
      .l2-hidden{display:none!important}
      .l2-header{position:fixed;top:0;left:0;right:0;height:68px;display:flex;justify-content:space-between;align-items:center;padding:12px 24px;box-sizing:border-box;background:rgba(21,21,32,.95);border-bottom:2px solid #2a2a3a;z-index:101}
      .l2-title{color:#e8e8e8;font-size:18px;font-weight:bold;letter-spacing:2px}.l2-stage{color:#00ccff;font-size:24px;font-weight:bold;text-shadow:0 0 10px rgba(0,204,255,.8)}.l2-total{color:#ffcc00;font-size:14px;text-align:right;line-height:1.5}
      .l2-rules{position:fixed;inset:68px 0 0 0;background:#0a0a12}.l2-rules:before{content:'';position:absolute;inset:0;background:repeating-linear-gradient(0deg,transparent,transparent 38px,rgba(26,26,46,.2) 38px,rgba(26,26,46,.2) 40px)}
      .l2-rule-box{position:fixed;top:130px;left:50%;transform:translateX(-50%);width:calc(100% - 200px);max-width:1080px;min-height:420px;background:rgba(21,21,32,.9);border:2px solid #2a2a3a;padding:22px 30px;box-sizing:border-box;z-index:102}
      .l2-rule-sub{position:fixed;top:90px;left:50%;transform:translateX(-50%);text-align:center;color:#00ccff;font-size:20px;z-index:102}.l2-rule-title{font-size:22px;font-weight:bold;color:#00ccff;margin-bottom:24px}.l2-rule-line{font-size:16px;color:#e8e8e8;line-height:2}.l2-rule-gap{height:8px}.l2-rule-dots{position:fixed;bottom:98px;left:50%;transform:translateX(-50%);display:flex;gap:16px;z-index:102}.l2-dot{font-size:14px;cursor:pointer;pointer-events:auto}.l2-dot.active{color:#00ccff}.l2-dot.inactive{color:#555566}
      .l2-rule-buttons{position:fixed;bottom:28px;left:50%;transform:translateX(-50%);display:flex;gap:16px;z-index:102}
      .l2-btn,.l2-action-btn,.l2-mini-btn{pointer-events:auto;font-family:'Courier New',monospace;cursor:pointer;transition:all .2s ease}
      .l2-btn{font-size:16px;color:#e8e8e8;background:rgba(42,42,58,.8);border:2px solid rgba(0,204,255,.45);padding:12px 28px;min-width:140px}.l2-btn:hover:not(:disabled){background:rgba(0,204,255,.28);border-color:#00ccff}.l2-btn:disabled{opacity:.35;cursor:not-allowed}.l2-btn.start{border-color:rgba(255,51,68,.5)}.l2-btn.start:hover{background:rgba(255,51,68,.28);border-color:#ff3344}.l2-btn.danger{border-color:rgba(255,51,68,.5);color:#ff6677}
      .l2-game{padding-top:68px;height:100%;box-sizing:border-box}.l2-body{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:16px;padding:16px 24px;box-sizing:border-box;min-height:calc(100% - 0px)}.l2-panel{background:rgba(21,21,32,.9);border:1px solid #2a2a3a;box-sizing:border-box}.l2-label{font-size:13px;color:#888899;margin-bottom:10px;letter-spacing:1px;text-transform:uppercase}.l2-name{font-size:20px;font-weight:bold;margin-bottom:12px}.l2-name.you{color:#00ccff}.l2-name.op{color:#ff3344}.l2-stat{font-size:18px;color:#e8e8e8;margin:8px 0}.l2-stat strong{color:#ffcc00;font-size:28px;margin-left:8px}
      .l2-slot{display:none}
      .l2-center{min-width:0;display:flex;flex-direction:column;gap:12px;max-width:980px}.l2-table{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px}.l2-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;width:100%;margin-bottom:18px}.l2-summary-card{padding:14px 16px;background:rgba(0,0,0,.28);border:1px solid #2a2a3a;text-align:center;min-height:108px;display:flex;flex-direction:column;justify-content:center}.l2-summary-name{font-size:13px;color:#888899;letter-spacing:1px;text-transform:uppercase;margin-bottom:8px}.l2-summary-name.you{color:#00ccff}.l2-summary-name.op{color:#ff6677}.l2-summary-stack{font-size:30px;font-weight:bold;color:#e8e8e8;margin-bottom:8px}.l2-summary-stack strong{color:#ffcc00}.l2-summary-commit{font-size:14px;color:#cfd3dc;line-height:1.6}.l2-summary-pot .l2-summary-stack strong{color:#e8e8e8}.l2-public-label{font-size:14px;color:#888899;letter-spacing:2px;margin-bottom:12px}.l2-cards{display:flex;gap:18px;flex-wrap:wrap;justify-content:center;margin-bottom:18px}.l2-seat-row{display:flex;align-items:center;justify-content:center;gap:14px;width:100%;margin-bottom:18px}.l2-seat-row.player{margin-top:6px;margin-bottom:0}.l2-seat-label{font-size:14px;letter-spacing:2px;color:#888899;text-transform:uppercase}.l2-seat-label.you{color:#00ccff}.l2-seat-label.op{color:#ff6677}.l2-seat-card{min-width:132px;min-height:180px;display:flex;align-items:center;justify-content:center}.l2-showdown{min-height:28px;margin:4px 0 18px;font-size:18px;color:#ffcc00;text-align:center;opacity:0;transition:opacity .2s ease}.l2-showdown.visible{opacity:1}
      .l2-card{width:128px;height:176px;border:2px solid #2a2a3a;background:linear-gradient(180deg,rgba(245,245,250,.95),rgba(208,208,222,.9));display:flex;flex-direction:column;justify-content:space-between;padding:14px;box-sizing:border-box;color:#151520}.l2-card.red{color:#b5142f}.l2-card.back{background:linear-gradient(180deg,rgba(20,20,34,.98),rgba(35,35,58,.92));color:#8899aa;border-color:#42506a}.l2-card.back .l2-card-center{color:#00ccff}.l2-card-rank{font-size:36px;font-weight:bold}.l2-card-suit{font-size:18px;color:inherit}.l2-card-center{align-self:center;font-size:48px;font-weight:bold;color:inherit}.l2-card-foot{align-self:flex-end;font-size:30px;font-weight:bold}
      .l2-status{font-size:20px;min-height:30px;margin-bottom:16px;color:#e8e8e8;text-align:center}.l2-readout{font-size:20px;color:#00ccff;margin-bottom:18px;text-align:center;line-height:1.6;max-width:760px}.l2-actions{display:grid;grid-template-columns:repeat(3,minmax(140px,1fr));gap:12px;width:min(100%,560px)}.l2-action-btn{width:100%;padding:12px 20px;border:1px solid #3a3a4a;background:rgba(42,42,58,.9);color:#e8e8e8;font-size:14px}.l2-action-btn:hover:not(:disabled){background:rgba(0,204,255,.2);border-color:#00ccff;color:#00ccff}.l2-action-btn:disabled{opacity:.35;cursor:not-allowed}.l2-action-btn.primary{border:2px solid #ff3344;color:#ff3344;background:rgba(255,51,68,.12)}.l2-action-btn.primary:hover:not(:disabled){background:rgba(255,51,68,.28);color:#fff}.l2-action-btn.success{border:2px solid #00ff88;color:#00ff88;background:rgba(0,255,136,.12)}.l2-action-btn.success:hover:not(:disabled){background:rgba(0,255,136,.24);color:#fff}
      .l2-host{padding:16px 20px;border-top:2px solid rgba(255,204,102,.4);background:rgba(21,21,32,.95)}.l2-host-label{font-size:12px;color:#ffcc66;font-weight:bold;margin-bottom:8px;letter-spacing:1px}.l2-host-text{font-size:18px;color:#e8e8e8;line-height:1.5}.l2-host-text.system{color:#00ccff}
      .l2-ai{width:280px;padding:20px;background:rgba(10,26,21,.9);border:1px solid rgba(0,255,136,.3);opacity:0;transition:opacity .8s}.l2-ai.visible{opacity:1}.l2-ai-head{font-size:14px;color:#00ff88;font-weight:bold;margin-bottom:16px;text-align:center;border-bottom:1px solid rgba(0,255,136,.28);padding-bottom:12px}.l2-ai-sec{margin-bottom:16px}.l2-ai-label{font-size:11px;color:#556655;margin-bottom:4px;text-transform:uppercase}.l2-ai-val{font-size:20px;color:#00ff88;font-weight:bold}.l2-ai-reason{font-size:14px;color:#88aa88;line-height:1.55}.l2-ai-imm{font-size:16px;color:#aaffaa;font-weight:bold;margin-top:10px;font-style:italic}.l2-ai-history{margin-top:18px;padding-top:14px;border-top:1px solid rgba(0,255,136,.2)}.l2-ai-item{display:flex;justify-content:space-between;font-size:13px;margin:6px 0;color:#667766}.l2-ai-item.adopted{color:#00ff88}.l2-ai-item.deviated{color:#ff6666}
      .l2-tools{position:absolute;right:24px;bottom:20px;display:flex;flex-direction:column;gap:8px;pointer-events:auto}.l2-mini-btn{width:110px;padding:10px 12px;background:rgba(21,21,32,.9);border:1px solid #2a2a3a;color:#888899;font-size:13px}.l2-mini-btn:hover{background:rgba(0,204,255,.2);border-color:#00ccff;color:#00ccff}.l2-mini-btn.danger:hover{background:rgba(255,51,68,.2);border-color:#ff3344;color:#ff3344}
      .l2-modal{position:fixed;inset:0;background:rgba(0,0,0,.84);display:none;align-items:center;justify-content:center;z-index:200;pointer-events:none}.l2-modal.visible{display:flex;pointer-events:auto}.l2-modal-box{width:min(92vw,760px);max-height:80vh;overflow:auto;background:rgba(21,21,32,.98);border:2px solid #2a2a3a;padding:28px 30px;box-sizing:border-box}.l2-modal-title{font-size:24px;color:#00ccff;font-weight:bold;margin-bottom:20px;text-align:center}.l2-modal-text{font-size:16px;color:#e8e8e8;line-height:1.8;margin:8px 0}.l2-modal-actions{display:flex;justify-content:center;gap:16px;margin-top:24px}.l2-result{font-size:18px;color:#ffcc00;text-align:center;line-height:1.7}
      @media (max-width:1120px){.l2-body{grid-template-columns:1fr;overflow-y:auto;padding-bottom:90px}.l2-center,.l2-ai{max-width:none;width:100%}.l2-summary{grid-template-columns:1fr}.l2-actions{grid-template-columns:repeat(2,minmax(140px,1fr));width:100%}}
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'l2-overlay';
    overlay.id = 'level2-overlay';
    overlay.innerHTML = `
      <div class="l2-header">
        <div class="l2-title">${LEVEL2_TITLE}</div>
        <div class="l2-stage" id="l2-stage">规则说明</div>
        <div class="l2-total" id="l2-total">你方筹码: 40<br>对手筹码: 40<br>牌堆剩余: 40</div>
      </div>
      <div id="l2-rules" class="l2-rules">
        <div class="l2-rule-sub">第二关 · 规则说明</div>
        <div class="l2-rule-box" id="l2-rule-box"></div>
        <div class="l2-rule-dots" id="l2-rule-dots"></div>
        <div class="l2-rule-buttons">
          <button class="l2-btn" id="l2-menu">返回入口</button>
          <button class="l2-btn" id="l2-prev">上一页</button>
          <button class="l2-btn start" id="l2-start">开始第二关</button>
          <button class="l2-btn" id="l2-next">下一页</button>
        </div>
      </div>
      <div id="l2-game" class="l2-game l2-hidden">
        <div class="l2-body">
          <div class="l2-panel l2-center">
            <div class="l2-panel l2-table">
              <div class="l2-summary">
                <div class="l2-summary-card">
                  <div class="l2-summary-name op">系统方</div>
                  <div class="l2-summary-stack"><strong id="l2-op-chips">40</strong></div>
                  <div class="l2-summary-commit">本轮投入 <span id="l2-op-commit">1</span></div>
                </div>
                <div class="l2-summary-card l2-summary-pot">
                  <div class="l2-summary-name">当前奖池</div>
                  <div class="l2-summary-stack"><strong id="l2-pot">2</strong></div>
                  <div class="l2-summary-commit" id="l2-deck">牌堆剩余：40</div>
                </div>
                <div class="l2-summary-card">
                  <div class="l2-summary-name you">你方</div>
                  <div class="l2-summary-stack"><strong id="l2-player-chips">40</strong></div>
                  <div class="l2-summary-commit">本轮投入 <span id="l2-player-commit">1</span></div>
                </div>
              </div>
              <div class="l2-seat-row">
                <div class="l2-seat-label op">系统方私牌</div>
                <div class="l2-seat-card" id="l2-op-seat"></div>
              </div>
              <div class="l2-public-label">公共牌</div>
              <div class="l2-cards" id="l2-cards"></div>
              <div class="l2-seat-row player">
                <div class="l2-seat-card" id="l2-player-seat"></div>
                <div class="l2-seat-label you">你方私牌</div>
              </div>
              <div class="l2-showdown" id="l2-showdown"></div>
              <div class="l2-status" id="l2-status">等待你的决定</div>
              <div class="l2-readout" id="l2-readout">本轮底注已下，轮到你行动。</div>
              <div class="l2-actions">
                <button class="l2-action-btn" id="l2-minus">-1</button>
                <button class="l2-action-btn" id="l2-plus">+1</button>
                <button class="l2-action-btn" id="l2-max">最大</button>
                <button class="l2-action-btn" id="l2-fold">弃牌</button>
                <button class="l2-action-btn primary" id="l2-raise">加注</button>
                <button class="l2-action-btn success" id="l2-reveal">跟注开牌</button>
              </div>
            </div>
            <div class="l2-panel l2-host"><div class="l2-host-label">主持人点评</div><div class="l2-host-text" id="l2-host">第二关即将开始...</div></div>
          </div>
          <div class="l2-panel l2-ai" id="l2-ai">
            <div class="l2-ai-head">AI队友辅助</div>
            <div class="l2-ai-sec"><div class="l2-ai-label">建议动作</div><div class="l2-ai-val" id="l2-ai-action">--</div></div>
            <div class="l2-ai-sec"><div class="l2-ai-label">置信度</div><div class="l2-ai-val" id="l2-ai-conf">--%</div></div>
            <div class="l2-ai-sec"><div class="l2-ai-label">理由</div><div class="l2-ai-reason" id="l2-ai-reason">--</div></div>
            <div class="l2-ai-sec"><div class="l2-ai-label">即时判断</div><div class="l2-ai-imm" id="l2-ai-imm">--</div></div>
            <div class="l2-ai-history"><div class="l2-ai-label">建议历史</div><div id="l2-ai-history"></div></div>
          </div>
        </div>
        <div class="l2-tools"><button class="l2-mini-btn" id="l2-open-rules">规则</button><button class="l2-mini-btn danger" id="l2-exit">退出</button></div>
      </div>
      <div class="l2-modal" id="l2-rule-modal"><div class="l2-modal-box"><div class="l2-modal-title">规则速查</div><div class="l2-modal-text">■ 两张公共牌 + 双方各一张私牌</div><div class="l2-modal-text">■ 你看不见自己的私牌，只能看到对手的私牌</div><div class="l2-modal-text">■ 双方都能继续加注、弃牌或跟注开牌</div><div class="l2-modal-text">■ 已发出的牌不会回到牌堆，直到整副牌用完才洗牌</div><div class="l2-modal-text">■ 弃掉顺子或豹子，需要额外赔付 10 筹码</div><div class="l2-modal-actions"><button class="l2-btn" id="l2-close-rules">关闭</button></div></div></div>
      <div class="l2-modal" id="l2-exit-modal"><div class="l2-modal-box"><div class="l2-modal-title" style="color:#ff3344;">确认退出</div><div class="l2-modal-text" style="text-align:center;">退出后将返回入口。</div><div class="l2-modal-actions"><button class="l2-btn danger" id="l2-confirm-exit">确定</button><button class="l2-btn" id="l2-cancel-exit">取消</button></div></div></div>
      <div class="l2-modal" id="l2-result-modal"><div class="l2-modal-box"><div class="l2-modal-title" id="l2-result-title">第二关结束</div><div class="l2-result" id="l2-result"></div><div class="l2-modal-actions"><button class="l2-btn" id="l2-result-menu">返回入口</button><button class="l2-btn start" id="l2-result-restart">再来一次</button></div></div></div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('l2-menu')?.addEventListener('click', () => this.exitToMenu());
    document.getElementById('l2-prev')?.addEventListener('click', () => this.showRulePage(this.rulePage - 1));
    document.getElementById('l2-next')?.addEventListener('click', () => this.showRulePage(this.rulePage + 1));
    document.getElementById('l2-start')?.addEventListener('click', () => this.startMatch());
    document.getElementById('l2-minus')?.addEventListener('click', () => this.adjustRaise(-1));
    document.getElementById('l2-plus')?.addEventListener('click', () => this.adjustRaise(1));
    document.getElementById('l2-max')?.addEventListener('click', () => this.setRaiseMax());
    document.getElementById('l2-fold')?.addEventListener('click', () => this.takePlayerAction({ type: 'fold', amount: 0 }));
    document.getElementById('l2-raise')?.addEventListener('click', () => this.takePlayerAction({ type: 'raise', amount: this.selectedRaise }));
    document.getElementById('l2-reveal')?.addEventListener('click', () => this.takePlayerAction({ type: 'call_reveal', amount: this.getRevealCost() }));
    document.getElementById('l2-open-rules')?.addEventListener('click', () => this.showModal('l2-rule-modal'));
    document.getElementById('l2-close-rules')?.addEventListener('click', () => this.hideModal('l2-rule-modal'));
    document.getElementById('l2-exit')?.addEventListener('click', () => this.showModal('l2-exit-modal'));
    document.getElementById('l2-confirm-exit')?.addEventListener('click', () => this.exitToMenu());
    document.getElementById('l2-cancel-exit')?.addEventListener('click', () => this.hideModal('l2-exit-modal'));
    document.getElementById('l2-result-menu')?.addEventListener('click', () => this.exitToMenu());
    document.getElementById('l2-result-restart')?.addEventListener('click', () => {
      this.hideModal('l2-result-modal');
      this.startMatch();
    });

    const dotBox = document.getElementById('l2-rule-dots');
    if (dotBox) {
      RULE_PAGES.forEach((_, index) => {
        const dot = document.createElement('span');
        dot.className = 'l2-dot';
        dot.id = `l2-dot-${index}`;
        dot.textContent = '●';
        dot.addEventListener('click', () => this.showRulePage(index));
        dotBox.appendChild(dot);
      });
    }
  }

  private showRulePage(index: number): void {
    this.rulePage = Phaser.Math.Clamp(index, 0, RULE_PAGES.length - 1);
    const page = RULE_PAGES[this.rulePage];
    const box = document.getElementById('l2-rule-box');
    if (box) {
      box.innerHTML = `<div class="l2-rule-title">${page.title}</div>${page.lines.map(line => line === '' ? '<div class="l2-rule-gap"></div>' : `<div class="l2-rule-line">${line}</div>`).join('')}`;
    }

    const prev = document.getElementById('l2-prev') as HTMLButtonElement | null;
    const next = document.getElementById('l2-next') as HTMLButtonElement | null;
    if (prev) prev.disabled = this.rulePage === 0;
    if (next) next.disabled = this.rulePage === RULE_PAGES.length - 1;

    RULE_PAGES.forEach((_, pageIndex) => {
      const dot = document.getElementById(`l2-dot-${pageIndex}`);
      if (dot) {
        dot.className = `l2-dot ${pageIndex === this.rulePage ? 'active' : 'inactive'}`;
      }
    });
  }

  private startMatch(): void {
    document.getElementById('l2-rules')?.classList.add('l2-hidden');
    document.getElementById('l2-game')?.classList.remove('l2-hidden');
    this.hideModal('l2-result-modal');
    this.playerChips = LEVEL2_INITIAL_CHIPS;
    this.opponentChips = LEVEL2_INITIAL_CHIPS;
    this.carryPot = 0;
    this.totalAdviceGiven = 0;
    this.drawPile = shuffleLevel2Deck(createLevel2Deck());
    this.discardPile = [];
    this.advisorState = createLevel2AdvisorState();
    this.directorState = createLevel2DirectorState();
    document.getElementById('l2-ai')?.classList.remove('visible');
    this.beginRound(1);
    this.showHost(this.pick(HOST.start));
  }

  private beginRound(round: number): void {
    const drawn = drawLevel2RoundDeal(this.drawPile, this.discardPile);
    this.drawPile = drawn.drawPile;
    this.discardPile = drawn.discardPile;
    this.roundState = createLevel2RoundStateFromDeal(
      round,
      this.playerChips,
      this.opponentChips,
      drawn.deal,
      this.carryPot
    );
    this.revealHands = false;
    this.isPlayerTurn = true;
    this.roundStartTime = this.time.now;
    this.selectedRaise = this.getMinRaiseAmount();

    const stage = document.getElementById('l2-stage');
    if (stage) {
      stage.textContent = `第 ${round} 轮`;
    }

    this.updateGameUI();
    this.updateActionUI();
    this.updateAdviceHistory();
    this.setShowdownBanner('');

    if (drawn.reshuffled) {
      this.showSystem(this.pick(HOST.shuffle));
    } else {
      this.showHost(this.pick(HOST.round));
    }

    if (this.advisorState.isJoined) {
      this.refreshAdvice();
    } else {
      this.startAdvisorTimer();
    }
  }

  private startAdvisorTimer(): void {
    this.hesitationTimer?.destroy();
    this.hesitationTimer = this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        if (!this.isPlayerTurn) {
          return;
        }

        const elapsed = this.time.now - this.roundStartTime;
        if (shouldJoinLevel2Advisor(this.roundState, this.advisorState, elapsed)) {
          this.advisorState.isJoined = true;
          document.getElementById('l2-ai')?.classList.add('visible');
          this.showSystem('AI 队友辅助已接入');
          this.refreshAdvice();
          this.hesitationTimer?.destroy();
        }
      },
    });
  }

  private refreshAdvice(): void {
    const advice = generateLevel2Advice(this.roundState, this.advisorState);
    this.totalAdviceGiven++;
    this.renderAdvice(advice);
    this.showHost(this.pick(HOST.ai));
  }

  private renderAdvice(advice: Level2AdviceRecord): void {
    const action = advice.suggestedAction === 'raise'
      ? `加注 ${advice.targetAmount}`
      : advice.suggestedAction === 'call_reveal'
        ? '跟注开牌'
        : '弃牌';
    const set = (id: string, value: string): void => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    };
    set('l2-ai-action', action);
    set('l2-ai-conf', `${advice.confidence}%`);
    set('l2-ai-reason', advice.reason);
    set('l2-ai-imm', advice.immediateJudgment);
    this.updateAdviceHistory();
  }

  private updateAdviceHistory(): void {
    const box = document.getElementById('l2-ai-history');
    if (!box) {
      return;
    }

    box.innerHTML = this.advisorState.adviceHistory.slice(-4).map(record => {
      const action = record.suggestedAction === 'raise'
        ? `加${record.targetAmount}`
        : record.suggestedAction === 'call_reveal'
          ? '开牌'
          : '弃牌';
      return `<div class="l2-ai-item ${record.adopted ? 'adopted' : 'deviated'}"><span>R${record.round} ${action}</span><span>${record.adopted ? '采纳' : '偏离'}</span></div>`;
    }).join('');
  }

  private getRevealCost(): number {
    return getLevel2RevealCost(this.roundState, 'player');
  }

  private getMaxRaiseAmount(): number {
    return getLevel2MaxRaiseAmount(this.roundState, 'player');
  }

  private getMinRaiseAmount(): number {
    const maxRaise = this.getMaxRaiseAmount();
    if (maxRaise <= 0 || this.roundState.player.chips < this.getRevealCost() + 1) {
      return 0;
    }
    return Math.min(maxRaise, this.getRevealCost() + 1);
  }

  private adjustRaise(delta: number): void {
    if (!this.isPlayerTurn) {
      return;
    }

    const minRaise = this.getMinRaiseAmount();
    const maxRaise = this.getMaxRaiseAmount();
    if (maxRaise <= 0) {
      return;
    }

    this.selectedRaise = Phaser.Math.Clamp(this.selectedRaise + delta, minRaise, maxRaise);
    this.updateActionUI();
  }

  private setRaiseMax(): void {
    if (!this.isPlayerTurn) {
      return;
    }

    const maxRaise = this.getMaxRaiseAmount();
    if (maxRaise <= 0) {
      return;
    }

    this.selectedRaise = maxRaise;
    this.updateActionUI();
  }

  private takePlayerAction(action: Level2Action): void {
    if (!this.isPlayerTurn) {
      return;
    }

    this.isPlayerTurn = false;
    this.hesitationTimer?.destroy();
    const adopted = recordLevel2AdviceOutcome(this.advisorState, action);
    const playerSummary = this.describePlayerAction(action, adopted);
    this.roundState = applyLevel2Action(this.roundState, 'player', action);
    this.updateGameUI();
    this.updateAdviceHistory();

    if (action.type === 'fold') {
      this.completeRound(resolveLevel2Fold(this.roundState, 'player'), playerSummary, false);
      return;
    }

    if (this.roundState.isComplete) {
      this.completeRound(resolveLevel2Showdown(this.roundState), playerSummary, true);
      return;
    }

    this.showSystem('系统正在决定下一步动作...');
    this.updateActionButtons(false);
    this.time.delayedCall(900, () => this.takeOpponentTurn(action, playerSummary));
  }

  private takeOpponentTurn(playerAction: Level2Action, playerSummary: string): void {
    const response = generateLevel2OpponentResponse(
      this.roundState,
      this.directorState,
      playerAction,
      this.advisorState.currentAdvice
    );
    this.roundState = applyLevel2Action(this.roundState, 'opponent', response.action);
    this.updateGameUI();

    const opponentSummary = this.describeOpponentAction(response.action);
    if (response.action.type === 'fold') {
      this.showHost(this.pick(HOST.opponentFold));
      this.completeRound(resolveLevel2Fold(this.roundState, 'opponent'), `${playerSummary} | ${opponentSummary}`, false);
      return;
    }

    if (this.roundState.isComplete) {
      this.showHost(this.pick(HOST.opponentCall));
      this.completeRound(resolveLevel2Showdown(this.roundState), `${playerSummary} | ${opponentSummary}`, true);
      return;
    }

    this.isPlayerTurn = true;
    this.selectedRaise = Phaser.Math.Clamp(this.selectedRaise, this.getMinRaiseAmount(), this.getMaxRaiseAmount());
    this.updateActionUI();
    this.showHost(this.pick(HOST.opponentRaise));

    const status = document.getElementById('l2-status');
    if (status) {
      status.textContent = `系统已加到 ${this.roundState.currentBet}，轮到你回应。`;
      status.style.color = '#e8e8e8';
    }

    const readout = document.getElementById('l2-readout');
    if (readout) {
      readout.textContent = `${playerSummary} | ${opponentSummary}`;
      readout.style.color = '#00ccff';
    }

    if (this.advisorState.isJoined) {
      this.refreshAdvice();
    } else {
      this.roundStartTime = this.time.now;
      this.startAdvisorTimer();
    }
  }

  private completeRound(resolution: Level2RoundResolution, summary: string, revealHands: boolean): void {
    this.revealHands = revealHands;
    this.roundState = applyLevel2Resolution(this.roundState, resolution);
    this.playerChips = this.roundState.player.chips;
    this.opponentChips = this.roundState.opponent.chips;
    this.carryPot = resolution.carryPot;
    updateLevel2AdvisorLosses(this.advisorState, resolution.winner === 'opponent');
    this.updateGameUI();
    this.showOutcome(summary, resolution, revealHands);
    this.updateAdviceHistory();

    this.time.delayedCall(2200, () => {
      if (isLevel2MatchOver(this.roundState)) {
        this.finishMatch();
      } else {
        this.beginRound(this.roundState.round + 1);
      }
    });
  }

  private showOutcome(summary: string, resolution: Level2RoundResolution, revealHands: boolean): void {
    const playerHand = getPlayerHand(this.roundState);
    const opponentHand = getOpponentHand(this.roundState);
    const status = document.getElementById('l2-status');
    const readout = document.getElementById('l2-readout');

    if (status) {
      if (resolution.winner === 'player') {
        status.textContent = `你赢下本轮 | 你方：${playerHand.label} | 对手：${opponentHand.label}`;
        status.style.color = '#00ff88';
        this.showHost(this.pick(HOST.win));
      } else if (resolution.winner === 'opponent') {
        status.textContent = `系统赢下本轮 | 你方：${playerHand.label} | 对手：${opponentHand.label}`;
        status.style.color = '#ff3344';
        this.showHost(this.pick(HOST.lose));
      } else {
        status.textContent = `本轮平局 | 你方：${playerHand.label} | 对手：${opponentHand.label}`;
        status.style.color = '#ffcc00';
        this.showHost(this.pick(HOST.tie));
      }
    }

    if (revealHands) {
      const winnerText = resolution.winner === 'player'
        ? '你方胜'
        : resolution.winner === 'opponent'
          ? '系统胜'
          : '平局';
      this.setShowdownBanner(`开牌结果：${winnerText} | 你方 ${playerHand.label} | 系统 ${opponentHand.label}`);
    } else {
      this.setShowdownBanner('');
    }

    if (readout) {
      const penalty = resolution.playerPenaltyPaid > 0 || resolution.opponentPenaltyPaid > 0
        ? ` | 罚注：${resolution.playerPenaltyPaid > 0 ? `你赔 ${resolution.playerPenaltyPaid}` : `系统赔 ${resolution.opponentPenaltyPaid}`}`
        : '';
      const carry = resolution.carryPot > 0 ? ` | 奖池滚存 ${resolution.carryPot}` : '';
      readout.textContent = `${summary}${penalty}${carry}`;
      readout.style.color = '#00ccff';
    }

    this.updateActionButtons(false);
  }

  private updateGameUI(): void {
    const setHtml = (id: string, value: string): void => {
      const element = document.getElementById(id);
      if (element) {
        element.innerHTML = value;
      }
    };

    setHtml('l2-total', `你方筹码: ${this.playerChips}<br>对手筹码: ${this.opponentChips}<br>牌堆剩余: ${this.drawPile.length}`);
    setHtml('l2-player-chips', `${this.roundState.player.chips}`);
    setHtml('l2-op-chips', `${this.roundState.opponent.chips}`);
    setHtml('l2-player-commit', `${this.roundState.player.committed}`);
    setHtml('l2-op-commit', `${this.roundState.opponent.committed}`);
    setHtml('l2-pot', `${this.roundState.pot}`);
    setHtml('l2-deck', `牌堆剩余：${this.drawPile.length} | 已发弃牌：${this.discardPile.length}`);

    const opponentSeat = document.getElementById('l2-op-seat');
    if (opponentSeat) {
      opponentSeat.innerHTML = this.renderCard(getVisibleOpponentCard(this.roundState, 'player'));
    }

    const playerSeat = document.getElementById('l2-player-seat');
    if (playerSeat) {
      playerSeat.innerHTML = this.revealHands
        ? this.renderCard(this.roundState.player.holeCard as Level2Card)
        : this.renderHiddenCard('?');
    }

    const cards = document.getElementById('l2-cards');
    if (cards) {
      cards.innerHTML = this.roundState.sharedCards.map(card => this.renderCard(card)).join('');
    }
  }

  private updateActionUI(): void {
    const revealCost = this.getRevealCost();
    const minRaise = this.getMinRaiseAmount();
    const maxRaise = this.getMaxRaiseAmount();
    if (maxRaise > 0) {
      this.selectedRaise = Phaser.Math.Clamp(this.selectedRaise || minRaise, minRaise, maxRaise);
    }

    const readout = document.getElementById('l2-readout');
    if (readout) {
      if (revealCost > this.roundState.player.chips) {
        readout.textContent = `你还差 ${revealCost} 才能开牌，当前筹码不够，只能选择弃牌。`;
      } else if (revealCost > 0) {
        readout.textContent = `系统当前领先 ${revealCost} 筹码。跟注需要补齐 ${revealCost}，加注至少需要 ${minRaise}。`;
      } else {
        readout.textContent = `双方当前投入相同。你可以直接开牌，也可以继续加注施压。`;
      }
    }

    const raiseBtn = document.getElementById('l2-raise');
    if (raiseBtn) {
      raiseBtn.textContent = `加注 ${Math.max(this.selectedRaise, 0)}`;
    }

    const revealBtn = document.getElementById('l2-reveal');
    if (revealBtn) {
      revealBtn.textContent = revealCost > 0 ? `跟 ${revealCost} 开牌` : '开牌';
    }

    this.updateActionButtons(this.isPlayerTurn);
  }

  private updateActionButtons(enabled: boolean): void {
    const revealCost = this.getRevealCost();
    const canRaise = enabled && this.getMinRaiseAmount() > 0 && this.roundState.player.chips > 0;
    const canReveal = enabled && this.roundState.player.chips >= revealCost;
    const map: Array<[string, boolean]> = [
      ['l2-minus', canRaise],
      ['l2-plus', canRaise],
      ['l2-max', canRaise],
      ['l2-fold', enabled],
      ['l2-raise', canRaise],
      ['l2-reveal', canReveal],
    ];

    map.forEach(([id, on]) => {
      const button = document.getElementById(id) as HTMLButtonElement | null;
      if (button) {
        button.disabled = !on;
      }
    });
  }

  private describePlayerAction(action: Level2Action, adopted: boolean): string {
    const aiText = this.advisorState.currentAdvice ? (adopted ? '采纳 AI' : '偏离 AI') : '未接 AI';
    switch (action.type) {
      case 'fold':
        return `你选择弃牌 | ${aiText}`;
      case 'call_reveal':
        return `${action.amount > 0 ? `你补 ${action.amount}` : '你直接'} 开牌 | ${aiText}`;
      case 'raise':
        return `你加注 ${action.amount} | ${aiText}`;
    }
  }

  private describeOpponentAction(action: Level2Action): string {
    switch (action.type) {
      case 'fold':
        return '系统弃牌';
      case 'call_reveal':
        return action.amount > 0 ? `系统跟 ${action.amount} 开牌` : '系统同意开牌';
      case 'raise':
        return `系统加注 ${action.amount}`;
    }
  }

  private renderCard(card: Level2Card): string {
    const rank = card.rank === 1 ? 'A' : `${card.rank}`;
    const suitMap: Record<Level2Card['suit'], string> = {
      spade: '♠',
      heart: '♥',
      club: '♣',
      diamond: '♦',
    };
    const isRed = card.suit === 'heart' || card.suit === 'diamond';
    const suit = suitMap[card.suit];
    return `<div class="l2-card ${isRed ? 'red' : 'black'}"><div class="l2-card-rank">${rank}</div><div class="l2-card-suit">${suit}</div><div class="l2-card-center">${suit}</div><div class="l2-card-foot">${rank}</div></div>`;
  }

  private renderHiddenCard(mark: string): string {
    return `<div class="l2-card back"><div class="l2-card-rank">${mark}</div><div class="l2-card-suit">?</div><div class="l2-card-center">?</div><div class="l2-card-foot">${mark}</div></div>`;
  }

  private setShowdownBanner(text: string): void {
    const banner = document.getElementById('l2-showdown');
    if (!banner) {
      return;
    }

    banner.textContent = text;
    banner.classList.toggle('visible', text.length > 0);
  }

  private finishMatch(): void {
    const win = this.playerChips > 0;
    const title = document.getElementById('l2-result-title');
    const result = document.getElementById('l2-result');
    if (title) {
      title.textContent = win ? '第二关 · 胜利' : '第二关 · 失败';
      title.style.color = win ? '#00ff88' : '#ff3344';
    }
    if (result) {
      const rate = this.totalAdviceGiven > 0
        ? Math.round((this.advisorState.relianceCount / this.totalAdviceGiven) * 100)
        : 0;
      result.innerHTML = `最终筹码：你方 ${this.playerChips} / 对手 ${this.opponentChips}<br>滚存奖池：${this.carryPot}<br>牌堆剩余：${this.drawPile.length}<br>AI 依赖度：${rate}% (${this.advisorState.relianceCount}/${this.totalAdviceGiven})`;
    }
    this.showModal('l2-result-modal');
  }

  private showHost(text: string): void {
    const host = document.getElementById('l2-host');
    if (host) {
      host.classList.remove('system');
      host.textContent = text;
    }
  }

  private showSystem(text: string): void {
    const host = document.getElementById('l2-host');
    if (host) {
      host.classList.add('system');
      host.textContent = `[系统提醒] ${text}`;
    }
  }

  private pick(lines: readonly string[]): string {
    return lines[Math.floor(Math.random() * lines.length)];
  }

  private showModal(id: string): void {
    document.getElementById(id)?.classList.add('visible');
  }

  private hideModal(id: string): void {
    document.getElementById(id)?.classList.remove('visible');
  }

  private exitToMenu(): void {
    this.cameras.main.fade(300, 0, 0, 0);
    this.time.delayedCall(300, () => this.scene.start(SCENE_KEYS.MENU));
  }

  private drawBackground(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x0a0a12);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    graphics.lineStyle(1, 0x1a1a2e, 0.16);
    for (let y = 0; y < GAME_HEIGHT; y += 40) {
      graphics.lineBetween(0, y, GAME_WIDTH, y);
    }
    for (let x = 0; x < GAME_WIDTH; x += 40) {
      graphics.lineBetween(x, 0, x, GAME_HEIGHT);
    }
  }

  private createScanlines(): void {
    const graphics = this.add.graphics();
    graphics.setDepth(50);
    for (let y = 0; y < GAME_HEIGHT; y += 4) {
      graphics.fillStyle(0x000000, 0.03);
      graphics.fillRect(0, y, GAME_WIDTH, 2);
    }
  }

  shutdown(): void {
    this.hesitationTimer?.destroy();
    document.getElementById('level2-overlay')?.remove();
    document.getElementById('level2-style')?.remove();
  }
}
