import Phaser from 'phaser';
import { COLORS, SCENE_KEYS, GAME_WIDTH, GAME_HEIGHT, GAME_CONFIG } from '../data/gameConfig';
import {
  createInitialMatchState,
  resolveRound,
  applyRoundResult,
  checkMatchComplete,
  checkBothPlayersZero,
  buildMatchResult,
} from '../core/rules';
import {
  createAIAdvisorState,
  generateAdvice,
  recordPlayerBid,
  checkInterventionTriggers,
  updateConsecutiveLosses,
  resetHesitationTimer,
  incrementHesitation,
  getAdviceHistory,
} from '../systems/AIAdvisor';
import {
  createOpponentDirectorState,
  generateOpponentBid,
  resetDirectorForNewRound,
} from '../systems/OpponentDirector';
import { HOST_COMMENTARY } from '../data/dialogs';
import { PRIZE_CONFIG } from '../data/gameConfig';
import type { MatchState } from '../core/types';

export class MatchScene extends Phaser.Scene {
  private matchState!: MatchState;
  private advisorState = createAIAdvisorState();
  private directorState = createOpponentDirectorState();
  private playerBid: number = 0;
  private isPlayerTurn: boolean = true;
  private totalAdviceGiven: number = 0;
  private roundStartTime: number = 0;
  private hesitationCheckTimer: Phaser.Time.TimerEvent | null = null;
  private hostCommentaryTimer: Phaser.Time.TimerEvent | null = null;
  private commentaryQueue: string[] = [];

  private ruleModal!: Phaser.GameObjects.Container;
  private exitModal!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: SCENE_KEYS.MATCH });
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);
    this.matchState = createInitialMatchState({
      initialResource: GAME_CONFIG.initialResource,
      totalRounds: GAME_CONFIG.totalRounds,
    });
    this.playerBid = 10;
    this.advisorState = createAIAdvisorState();
    this.directorState = createOpponentDirectorState();
    this.totalAdviceGiven = 0;

    this.cameras.main.setBackgroundColor(COLORS.BACKGROUND);
    this.drawGameArea();
    this.createPhaserModals();
    this.createHtmlUI();
    this.updateAllUI();
    this.setupKeyboardInput();
    this.createScanlines();

    this.triggerHostCommentary('matchStart');
    this.showRoundStart();
  }

  private createHtmlUI(): void {
    const existingOverlay = document.querySelector('.match-overlay');
    if (existingOverlay) existingOverlay.remove();
    const existingStyle = document.querySelector('style[data-match-style]');
    if (existingStyle) existingStyle.remove();

    const style = document.createElement('style');
    style.setAttribute('data-match-style', 'true');
    style.textContent = `
      .match-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 100;
        font-family: 'Courier New', monospace;
        display: flex;
        flex-direction: column;
        background: transparent;
      }
      .match-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 24px;
        background: rgba(21,21,32,0.95);
        border-bottom: 2px solid #2a2a3a;
        height: 60px;
        box-sizing: border-box;
      }
      .match-title {
        color: #e8e8e8;
        font-size: 18px;
        font-weight: bold;
        letter-spacing: 2px;
      }
      .match-round {
        color: #00ccff;
        font-size: 24px;
        font-weight: bold;
        text-shadow: 0 0 10px rgba(0,204,255,0.8);
      }
      .match-prize {
        color: #ffcc00;
        font-size: 14px;
        text-align: right;
        line-height: 1.4;
      }
      .match-body {
        display: flex;
        flex: 1;
        padding: 16px 24px;
        gap: 16px;
        box-sizing: border-box;
      }
      .panel {
        background: rgba(21,21,32,0.9);
        border: 1px solid #2a2a3a;
        box-sizing: border-box;
      }
      .player-panel {
        width: 320px;
        padding: 20px;
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .player-section {
        padding: 16px;
        background: rgba(0,0,0,0.3);
        border: 1px solid #2a2a3a;
      }
      .section-label {
        font-size: 14px;
        color: #888899;
        margin-bottom: 12px;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .player-name {
        font-size: 20px;
        font-weight: bold;
        margin-bottom: 8px;
      }
      .player-name.you { color: #00ccff; }
      .player-name.opponent { color: #ff3344; }
      .lights-container {
        display: flex;
        gap: 8px;
        margin: 12px 0;
      }
      .light {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: #222233;
        border: 2px solid #333344;
        transition: all 0.3s;
      }
      .light.on {
        background: #ff3344;
        border-color: #ff6677;
        box-shadow: 0 0 8px rgba(255,51,68,0.6);
      }
      .resource-display {
        font-size: 18px;
        color: #e8e8e8;
        margin: 8px 0;
      }
      .resource-label {
        color: #888899;
        font-size: 14px;
      }
      .resource-value {
        font-size: 28px;
        font-weight: bold;
        color: #e8e8e8;
      }
      .resource-value.you { color: #00ccff; }
      .resource-value.unknown { color: #555566; }
      .wins-display {
        font-size: 18px;
        color: #ffcc00;
        margin-top: 8px;
      }
      .center-panel {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .bid-area {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      .vs-display {
        font-size: 48px;
        color: #333344;
        font-weight: bold;
        margin: 8px 0;
      }
      .score-display {
        font-size: 56px;
        font-weight: bold;
        color: #e8e8e8;
        margin: 16px 0;
      }
      .result-display {
        font-size: 20px;
        height: 32px;
        margin: 8px 0;
      }
      .bid-value {
        font-size: 72px;
        font-weight: bold;
        color: #00ccff;
        text-shadow: 0 0 20px rgba(0,204,255,0.6);
        margin: 24px 0;
      }
      .bid-controls {
        display: flex;
        gap: 12px;
        margin-top: 24px;
        pointer-events: auto;
      }
      .bid-btn {
        width: 56px;
        height: 44px;
        background: rgba(42,42,58,0.9);
        border: 1px solid #3a3a4a;
        color: #e8e8e8;
        font-size: 14px;
        font-family: 'Courier New', monospace;
        cursor: pointer;
        transition: all 0.15s;
      }
      .bid-btn:hover {
        background: rgba(0,204,255,0.2);
        border-color: #00ccff;
        color: #00ccff;
      }
      .bid-btn:active {
        background: rgba(0,204,255,0.4);
      }
      .bid-btn.confirm {
        width: 120px;
        background: rgba(255,51,68,0.15);
        border: 2px solid #ff3344;
        color: #ff3344;
        font-size: 16px;
        font-weight: bold;
      }
      .bid-btn.confirm:hover {
        background: rgba(255,51,68,0.3);
        color: #ffffff;
      }
      .host-panel {
        padding: 16px 20px;
        border-top: 2px solid rgba(255,204,102,0.4);
        background: rgba(21,21,32,0.95);
      }
      .host-label {
        font-size: 12px;
        color: #ffcc66;
        font-weight: bold;
        margin-bottom: 8px;
        letter-spacing: 1px;
      }
      .host-text {
        font-size: 18px;
        color: #e8e8e8;
        line-height: 1.5;
      }
      .host-text.system-reminder {
        color: #00ccff;
      }
      .ai-panel {
        width: 280px;
        padding: 20px;
        background: rgba(10,26,21,0.9);
        border: 1px solid rgba(0,255,136,0.3);
        opacity: 0;
        transition: opacity 0.8s;
      }
      .ai-panel.visible {
        opacity: 1;
      }
      .ai-header {
        font-size: 14px;
        color: #00ff88;
        font-weight: bold;
        margin-bottom: 16px;
        text-align: center;
        border-bottom: 1px solid rgba(0,255,136,0.3);
        padding-bottom: 12px;
      }
      .ai-section {
        margin-bottom: 16px;
      }
      .ai-label {
        font-size: 11px;
        color: #556655;
        margin-bottom: 4px;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .ai-value {
        font-size: 22px;
        color: #00ff88;
        font-weight: bold;
      }
      .ai-reason {
        font-size: 14px;
        color: #88aa88;
        line-height: 1.5;
        margin-top: 8px;
      }
      .ai-immediate {
        font-size: 16px;
        color: #aaffaa;
        font-weight: bold;
        margin-top: 12px;
        font-style: italic;
      }
      .ai-history {
        margin-top: 20px;
        padding-top: 16px;
        border-top: 1px solid rgba(0,255,136,0.2);
      }
      .history-title {
        font-size: 11px;
        color: #556655;
        margin-bottom: 8px;
        text-transform: uppercase;
      }
      .history-item {
        font-size: 13px;
        color: #667766;
        margin: 6px 0;
        display: flex;
        justify-content: space-between;
      }
      .history-item.adopted { color: #00ff88; }
      .history-item.deviated { color: #ff6666; }
      .game-controls {
        position: absolute;
        bottom: 20px;
        right: 24px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: auto;
      }
      .ctrl-btn {
        width: 100px;
        padding: 10px 12px;
        background: rgba(21,21,32,0.9);
        border: 1px solid #2a2a3a;
        color: #888899;
        font-size: 13px;
        font-family: 'Courier New', monospace;
        cursor: pointer;
        text-align: center;
        transition: all 0.2s;
        pointer-events: auto;
      }
      .ctrl-btn:hover {
        background: rgba(0,204,255,0.2);
        border-color: #00ccff;
        color: #00ccff;
      }
      .ctrl-btn.danger:hover {
        background: rgba(255,51,68,0.2);
        border-color: #ff3344;
        color: #ff3344;
      }
      .modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0,0,0,0.85);
        display: none;
        justify-content: center;
        align-items: center;
        z-index: 200;
        pointer-events: none;
      }
      .modal-overlay.visible {
        display: flex;
        pointer-events: auto;
      }
      .modal-content {
        background: rgba(21,21,32,0.98);
        border: 2px solid #2a2a3a;
        padding: 32px;
        max-width: 700px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
      }
      .modal-title {
        font-size: 24px;
        color: #00ccff;
        font-weight: bold;
        margin-bottom: 24px;
        text-align: center;
      }
      .modal-text {
        font-size: 16px;
        color: #e8e8e8;
        line-height: 1.8;
        margin: 8px 0;
      }
      .modal-text.indent {
        padding-left: 24px;
      }
      .modal-close {
        display: block;
        margin: 24px auto 0;
        padding: 12px 32px;
        background: transparent;
        border: 1px solid #00ccff;
        color: #00ccff;
        font-size: 16px;
        cursor: pointer;
        pointer-events: auto;
      }
      .modal-close:hover {
        background: rgba(0,204,255,0.2);
      }
      .exit-modal .modal-content {
        border-color: #ff3344;
        text-align: center;
      }
      .exit-modal .modal-title {
        color: #ff3344;
      }
      .exit-buttons {
        display: flex;
        justify-content: center;
        gap: 32px;
        margin-top: 24px;
      }
      .exit-btn {
        padding: 12px 24px;
        background: transparent;
        border: 1px solid;
        font-size: 16px;
        cursor: pointer;
        font-family: 'Courier New', monospace;
      }
      .exit-btn.confirm {
        border-color: #ff3344;
        color: #ff3344;
      }
      .exit-btn.confirm:hover {
        background: rgba(255,51,68,0.2);
      }
      .exit-btn.cancel {
        border-color: #00ccff;
        color: #00ccff;
      }
      .exit-btn.cancel:hover {
        background: rgba(0,204,255,0.2);
      }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'match-overlay';
    overlay.innerHTML = `
      <div class="match-header">
        <div class="match-title">暗灯竞价</div>
        <div class="match-round" id="round-display">第 1 / 9 回合</div>
        <div class="match-prize" id="prize-display">
          当前奖金: ¥0<br>
          本场胜利: +¥20,000
        </div>
      </div>
      <div class="match-body">
        <div class="panel player-panel">
          <div class="player-section">
            <div class="section-label">选手</div>
            <div class="player-name you">你方</div>
            <div class="lights-container" id="lights-player"></div>
            <div class="resource-display">
              <span class="resource-label">资源: </span>
              <span class="resource-value you" id="player-resource">100</span>
            </div>
            <div class="wins-display">胜场: <span id="player-wins">0</span></div>
          </div>
          <div class="player-section">
            <div class="section-label">对手</div>
            <div class="player-name opponent">???</div>
            <div class="lights-container" id="lights-opponent"></div>
            <div class="resource-display">
              <span class="resource-label">资源: </span>
              <span class="resource-value unknown">???</span>
            </div>
            <div class="wins-display">胜场: <span id="opponent-wins">0</span></div>
          </div>
        </div>
        <div class="panel center-panel">
          <div class="panel bid-area">
            <div class="score-display" id="score-display">0 : 0</div>
            <div class="vs-display">VS</div>
            <div class="result-display" id="result-display"></div>
            <div class="bid-value" id="bid-display">出价: 50</div>
            <div class="bid-controls">
              <button class="bid-btn" id="btn-minus10">-10</button>
              <button class="bid-btn" id="btn-minus1">-1</button>
              <button class="bid-btn" id="btn-plus1">+1</button>
              <button class="bid-btn" id="btn-plus10">+10</button>
              <button class="bid-btn" id="btn-zero">0</button>
              <button class="bid-btn" id="btn-max">最大</button>
              <button class="bid-btn confirm" id="btn-confirm">确认出价</button>
            </div>
          </div>
          <div class="panel host-panel">
            <div class="host-label">主持人点评</div>
            <div class="host-text" id="host-text">比赛即将开始...</div>
          </div>
        </div>
        <div class="panel ai-panel" id="ai-panel">
          <div class="ai-header">AI队友辅助</div>
          <div class="ai-section">
            <div class="ai-label">建议出点</div>
            <div class="ai-value" id="ai-advice">--</div>
          </div>
          <div class="ai-section">
            <div class="ai-label">置信度</div>
            <div class="ai-value" id="ai-confidence">--%</div>
          </div>
          <div class="ai-section">
            <div class="ai-label">理由</div>
            <div class="ai-reason" id="ai-reason">--</div>
          </div>
          <div class="ai-section">
            <div class="ai-label">即时判断</div>
            <div class="ai-immediate" id="ai-immediate">--</div>
          </div>
          <div class="ai-history">
            <div class="history-title">建议历史</div>
            <div id="ai-history-list"></div>
          </div>
        </div>
      </div>
      <div class="game-controls">
        <button class="ctrl-btn" id="btn-rules">📋 规则</button>
        <button class="ctrl-btn danger" id="btn-exit">🚪 退出</button>
      </div>
      <div class="modal-overlay" id="rule-modal">
        <div class="modal-content">
          <div class="modal-title">规则速查</div>
          <div class="modal-text">■ 双方初始100资源，9回合争夺胜场</div>
          <div class="modal-text indent">■ 每回合出价0~剩余资源</div>
          <div class="modal-text indent">■ 出价高者胜，平局无人得分</div>
          <div class="modal-text indent">■ 胜场多者赢；相同则比剩余资源</div>
          <div class="modal-text indent">■ 剩余资源相同则玩家负</div>
          <div class="modal-text" style="margin-top: 16px;">■ 你看不到对手准确资源</div>
          <div class="modal-text indent">■ 用灯数估算：</div>
          <div class="modal-text indent" style="padding-left: 48px;">5灯(81+) / 4灯(61-80) / 3灯(41-60)</div>
          <div class="modal-text indent" style="padding-left: 48px;">2灯(21-40) / 1灯(1-20) / 0灯(0)</div>
          <div class="modal-text" style="margin-top: 16px;">■ AI在高压状态时自动接入辅助</div>
          <div class="modal-text indent">■ 置信度越高，AI越"确定"</div>
          <button class="modal-close" id="btn-close-rules">[ 关闭 ]</button>
        </div>
      </div>
      <div class="modal-overlay exit-modal" id="exit-modal">
        <div class="modal-content">
          <div class="modal-title">确认退出</div>
          <div class="modal-text">退出将失去当前奖金</div>
          <div class="modal-text">确定要退出吗？</div>
          <div class="exit-buttons">
            <button class="exit-btn confirm" id="btn-confirm-exit">[ 确定 ]</button>
            <button class="exit-btn cancel" id="btn-cancel-exit">[ 取消 ]</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    for (let i = 0; i < 5; i++) {
      const light1 = document.createElement('div');
      light1.className = 'light on';
      light1.id = `light-player-${i}`;
      document.getElementById('lights-player')?.appendChild(light1);

      const light2 = document.createElement('div');
      light2.className = 'light on';
      light2.id = `light-opponent-${i}`;
      document.getElementById('lights-opponent')?.appendChild(light2);
    }

    document.getElementById('btn-minus10')?.addEventListener('click', () => {
      this.adjustBid(-10);
    });
    document.getElementById('btn-minus1')?.addEventListener('click', () => {
      this.adjustBid(-1);
    });
    document.getElementById('btn-plus1')?.addEventListener('click', () => {
      this.adjustBid(1);
    });
    document.getElementById('btn-plus10')?.addEventListener('click', () => {
      this.adjustBid(10);
    });
    document.getElementById('btn-zero')?.addEventListener('click', () => {
      this.setBid(0, true);
    });
    document.getElementById('btn-max')?.addEventListener('click', () => {
      this.setBid(this.matchState.player.resource, true);
    });
    document.getElementById('btn-confirm')?.addEventListener('click', () => this.confirmBid());
    document.getElementById('btn-rules')?.addEventListener('click', () => this.showRuleModal());
    document.getElementById('btn-exit')?.addEventListener('click', () => this.showExitModal());
    document.getElementById('btn-close-rules')?.addEventListener('click', () => this.hideRuleModal());
    document.getElementById('btn-confirm-exit')?.addEventListener('click', () => this.exitToMenu());
    document.getElementById('btn-cancel-exit')?.addEventListener('click', () => this.hideExitModal());
  }

  private adjustBid(delta: number): void {
    if (!this.isPlayerTurn) return;
    if (this.matchState.player.resource === 0) return;
    const newBid = this.playerBid + delta;
    this.setBid(newBid, true);
  }

  private setBid(value: number, registerHesitation: boolean = false): void {
    const previousBid = this.playerBid;

    if (this.matchState.player.resource === 0) {
      this.playerBid = 0;
    } else {
      this.playerBid = Math.max(0, Math.min(value, this.matchState.player.resource));
    }

    if (registerHesitation && this.isPlayerTurn && this.playerBid !== previousBid) {
      incrementHesitation(this.advisorState);
    }

    this.updateBidDisplay();
  }

  private updateBidDisplay(): void {
    const el = document.getElementById('bid-display');
    if (el) el.textContent = `出价: ${this.playerBid}`;
  }

  private showRuleModal(): void {
    const modal = document.getElementById('rule-modal');
    if (modal) modal.classList.add('visible');
  }

  private hideRuleModal(): void {
    const modal = document.getElementById('rule-modal');
    if (modal) modal.classList.remove('visible');
  }

  private showExitModal(): void {
    const modal = document.getElementById('exit-modal');
    if (modal) modal.classList.add('visible');
  }

  private hideExitModal(): void {
    const modal = document.getElementById('exit-modal');
    if (modal) modal.classList.remove('visible');
  }

  private exitToMenu(): void {
    this.cameras.main.fade(300, 0, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.start(SCENE_KEYS.MENU);
    });
  }

  private showRoundStart(): void {
    this.isPlayerTurn = true;
    this.roundStartTime = this.time.now;
    resetHesitationTimer(this.advisorState);
    resetDirectorForNewRound(this.directorState);
    this.updateResultDisplay('');

    if (checkBothPlayersZero(this.matchState)) {
      this.matchState = checkMatchComplete(this.matchState, GAME_CONFIG.totalRounds);
      this.endMatch();
      return;
    }

    if (this.matchState.player.resource === 0) {
      this.playerBid = 0;
      this.updateBidDisplay();
      this.disableBidButtons();
      this.showTempMessage('你的资源已耗尽，本回合只能出0', '#ff3344');
      this.time.delayedCall(1500, () => this.autoConfirmZeroBid());
      return;
    }

    this.updateBidDisplay();
    this.enableBidButtons();

    if (this.matchState.round >= 7) {
      this.triggerHostCommentary('finalRounds');
    } else {
      this.triggerHostCommentary('roundStart');
    }

    this.updateAllUI();

    if (this.advisorState.isJoined) {
      this.refreshAIAdvice();
      return;
    }

    this.startHesitationCheck();
  }

  private startHesitationCheck(): void {
    if (this.hesitationCheckTimer) {
      this.hesitationCheckTimer.destroy();
    }

    this.hesitationCheckTimer = this.time.addEvent({
      delay: 500,
      callback: () => {
        if (!this.isPlayerTurn) return;

        const elapsed = this.time.now - this.roundStartTime;
        const check = checkInterventionTriggers(this.matchState, this.advisorState, elapsed);

        if (check.shouldJoin && !this.advisorState.isJoined) {
          this.advisorState.isJoined = true;
          this.showAIJoin();
          this.hesitationCheckTimer?.destroy();
        }
      },
      loop: true,
    });
  }

  private showAIJoin(): void {
    const aiPanel = document.getElementById('ai-panel');
    if (aiPanel) aiPanel.classList.add('visible');

    this.triggerHostCommentary('aiJoined');
    this.showSystemReminder('AI队友辅助已接入');
    this.showTempMessage('检测到高压决策状态，AI队友辅助已接入。', '#00ff88');

    this.refreshAIAdvice();
  }

  private refreshAIAdvice(): void {
    const advice = generateAdvice(this.matchState, this.advisorState);
    this.totalAdviceGiven++;
    this.showAIAdvice(advice);
  }

  private showAIAdvice(advice: { suggestedBid: number; confidence: number; reason: string; immediateJudgment: string }): void {
    const adviceEl = document.getElementById('ai-advice');
    const confEl = document.getElementById('ai-confidence');
    const reasonEl = document.getElementById('ai-reason');
    const immediateEl = document.getElementById('ai-immediate');

    if (adviceEl) adviceEl.textContent = `${advice.suggestedBid}`;
    if (confEl) confEl.textContent = `${advice.confidence}%`;
    if (reasonEl) reasonEl.textContent = advice.reason;
    if (immediateEl) immediateEl.textContent = advice.immediateJudgment;

    this.updateAIHistoryDisplay();
  }

  private updateAIHistoryDisplay(): void {
    const history = getAdviceHistory(this.advisorState);
    const container = document.getElementById('ai-history-list');
    if (!container) return;

    container.innerHTML = '';
    history.forEach((record) => {
      const status = record.adopted ? '已采纳' : '偏离';
      const cls = record.adopted ? 'adopted' : 'deviated';
      const item = document.createElement('div');
      item.className = `history-item ${cls}`;
      item.innerHTML = `<span>R${record.round} 建议${record.suggestedBid}</span><span>${status}</span>`;
      container.appendChild(item);
    });
  }

  private showTempMessage(text: string, color: string): void {
    const el = document.getElementById('host-text');
    if (el) {
      el.style.color = color;
      el.textContent = text;
    }
  }

  private showSystemReminder(text: string): void {
    const el = document.getElementById('host-text');
    if (el) {
      el.classList.add('system-reminder');
      el.textContent = `[系统提醒] ${text}`;
    }
  }

  private triggerHostCommentary(type: keyof typeof HOST_COMMENTARY): void {
    const lines = HOST_COMMENTARY[type];
    if (!lines || lines.length === 0) return;

    const line = lines[Math.floor(Math.random() * lines.length)];
    this.queueCommentary(line);
  }

  private queueCommentary(text: string): void {
    this.commentaryQueue.push(text);
    this.processCommentaryQueue();
  }

  private processCommentaryQueue(): void {
    if (this.hostCommentaryTimer && this.hostCommentaryTimer.getElapsed() !== undefined) {
      return;
    }

    if (this.commentaryQueue.length === 0) return;

    const text = this.commentaryQueue.shift()!;
    this.showHostCommentary(text);
  }

  private showHostCommentary(text: string): void {
    const el = document.getElementById('host-text');
    if (el) {
      el.style.color = '#e8e8e8';
      el.textContent = text;
    }

    this.hostCommentaryTimer = this.time.delayedCall(3500, () => {
      this.processCommentaryQueue();
    });
  }

  private autoConfirmZeroBid(): void {
    this.isPlayerTurn = false;

    const adopted = recordPlayerBid(this.advisorState, this.playerBid);
    updateConsecutiveLosses(this.advisorState, true);

    const opponentBid = generateOpponentBid(
      this.matchState,
      this.directorState,
      this.playerBid,
      this.advisorState.currentAdvice,
      adopted
    );

    const result = resolveRound(this.playerBid, opponentBid);
    this.matchState = applyRoundResult(this.matchState, result);
    this.matchState.round += 1;

    this.showRoundResult(result);

    this.time.delayedCall(2000, () => {
      this.matchState = checkMatchComplete(this.matchState, GAME_CONFIG.totalRounds);
      if (this.matchState.isComplete) {
        this.endMatch();
      } else {
        this.showRoundStart();
      }
    });
  }

  private confirmBid(): void {
    if (!this.isPlayerTurn) return;
    this.isPlayerTurn = false;

    if (this.hesitationCheckTimer) {
      this.hesitationCheckTimer.destroy();
    }

    const adopted = recordPlayerBid(this.advisorState, this.playerBid);
    const currentAdvice = this.advisorState.currentAdvice;

    if (this.advisorState.isJoined) {
      updateConsecutiveLosses(this.advisorState, false);
    }

    const opponentBid = generateOpponentBid(
      this.matchState,
      this.directorState,
      this.playerBid,
      currentAdvice,
      adopted
    );

    const result = resolveRound(this.playerBid, opponentBid);
    this.matchState = applyRoundResult(this.matchState, result);
    this.matchState.round += 1;

    if (result.playerWins) {
      updateConsecutiveLosses(this.advisorState, false);
    } else if (result.opponentWins) {
      updateConsecutiveLosses(this.advisorState, true);
    }

    if (this.advisorState.consecutiveLosses >= 2) {
      this.triggerHostCommentary('playerLostStreak');
    }

    if (this.matchState.opponent.wins >= 5) {
      this.matchState.isComplete = true;
      this.matchState.winner = 'opponent';
      this.showRoundResult(result);
      this.showTempMessage('已输掉5小局，比赛结束', '#ff3344');
      this.time.delayedCall(1500, () => this.endMatch());
      return;
    }

    this.showRoundResult(result);

    this.time.delayedCall(2000, () => {
      this.matchState = checkMatchComplete(this.matchState, GAME_CONFIG.totalRounds);

      if (this.matchState.isComplete) {
        this.endMatch();
      } else {
        this.showRoundStart();
      }
    });
  }

  private disableBidButtons(): void {
    const buttons = document.querySelectorAll('.bid-btn:not(.confirm)');
    buttons.forEach(btn => {
      (btn as HTMLButtonElement).disabled = true;
      (btn as HTMLButtonElement).style.opacity = '0.4';
    });
  }

  private enableBidButtons(): void {
    const buttons = document.querySelectorAll('.bid-btn:not(.confirm)');
    buttons.forEach(btn => {
      (btn as HTMLButtonElement).disabled = false;
      (btn as HTMLButtonElement).style.opacity = '1';
    });
  }

  private showRoundResult(result: { playerWins: boolean; opponentWins: boolean; isDraw: boolean }): void {
    let text = '';
    let color = '#888899';

    if (result.isDraw) {
      text = '本回合: 平局';
      color = '#ffcc00';
    } else if (result.playerWins) {
      text = '本回合: 你赢了';
      color = '#00ff88';
    } else {
      text = '本回合: 你输了';
      color = '#ff3344';
    }

    this.updateResultDisplay(text);
    const resultEl = document.getElementById('result-display');
    if (resultEl) resultEl.style.color = color;

    this.updateAllUI();
    this.updateAIHistoryDisplay();
  }

  private updateResultDisplay(text: string): void {
    const el = document.getElementById('result-display');
    if (el) el.textContent = text;
  }

  private updateAllUI(): void {
    const roundEl = document.getElementById('round-display');
    if (roundEl) {
      roundEl.textContent = `第 ${this.matchState.round} / ${GAME_CONFIG.totalRounds} 回合`;
    }

    const prizeEl = document.getElementById('prize-display');
    if (prizeEl) {
      prizeEl.innerHTML = `当前奖金: ¥${PRIZE_CONFIG.currentPrize.toLocaleString()}<br>本场胜利: +¥${PRIZE_CONFIG.round1WinPrize.toLocaleString()}`;
    }

    const playerResourceEl = document.getElementById('player-resource');
    if (playerResourceEl) playerResourceEl.textContent = this.matchState.player.resource.toString();

    const playerWinsEl = document.getElementById('player-wins');
    if (playerWinsEl) playerWinsEl.textContent = this.matchState.player.wins.toString();

    const opponentWinsEl = document.getElementById('opponent-wins');
    if (opponentWinsEl) opponentWinsEl.textContent = this.matchState.opponent.wins.toString();

    const scoreEl = document.getElementById('score-display');
    if (scoreEl) scoreEl.textContent = `${this.matchState.player.wins} : ${this.matchState.opponent.wins}`;

    for (let i = 0; i < 5; i++) {
      const playerLight = document.getElementById(`light-player-${i}`);
      if (playerLight) {
        playerLight.className = `light ${i < this.matchState.player.lights ? 'on' : ''}`;
      }

      const opponentLight = document.getElementById(`light-opponent-${i}`);
      if (opponentLight) {
        opponentLight.className = `light ${i < this.matchState.opponent.lights ? 'on' : ''}`;
      }
    }

    this.updateBidDisplay();
  }

  private setupKeyboardInput(): void {
    this.input.keyboard?.on('keydown-LEFT', () => this.adjustBid(-1));
    this.input.keyboard?.on('keydown-RIGHT', () => this.adjustBid(1));
    this.input.keyboard?.on('keydown-A', () => this.adjustBid(-1));
    this.input.keyboard?.on('keydown-D', () => this.adjustBid(1));
    this.input.keyboard?.on('keydown-UP', () => this.setBid(this.matchState.player.resource, true));
    this.input.keyboard?.on('keydown-DOWN', () => this.setBid(0, true));
    this.input.keyboard?.on('keydown-ENTER', () => this.confirmBid());
  }

  private createPhaserModals(): void {
    this.ruleModal = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.ruleModal.setVisible(false);
    this.ruleModal.setDepth(500);

    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.01);
    bg.fillRect(-1, -1, 2, 2);
    this.ruleModal.add(bg);

    this.exitModal = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.exitModal.setVisible(false);
    this.exitModal.setDepth(500);

    const exitBg = this.add.graphics();
    exitBg.fillStyle(0x000000, 0.01);
    exitBg.fillRect(-1, -1, 2, 2);
    this.exitModal.add(exitBg);
  }

  private drawGameArea(): void {
    const graphics = this.add.graphics();
    graphics.fillStyle(0x0a0a12);
    graphics.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    graphics.lineStyle(1, 0x1a1a2e, 0.15);
    for (let y = 0; y < GAME_HEIGHT; y += 40) {
      graphics.lineBetween(0, y, GAME_WIDTH, y);
    }
    for (let x = 0; x < GAME_WIDTH; x += 40) {
      graphics.lineBetween(x, 0, x, GAME_HEIGHT);
    }
  }

  private endMatch(): void {
    if (this.hesitationCheckTimer) {
      this.hesitationCheckTimer.destroy();
    }

    this.triggerHostCommentary('matchEnd');

    const isWin = this.matchState.winner === 'player';
    const prizeWon = isWin ? PRIZE_CONFIG.round1WinPrize : 0;
    const totalPrize = isWin ? PRIZE_CONFIG.round1WinPrize : 0;

    const matchResult = buildMatchResult(
      this.matchState,
      this.advisorState.relianceCount,
      this.totalAdviceGiven,
      prizeWon,
      totalPrize
    );

    this.time.delayedCall(1500, () => {
      this.cameras.main.fade(500, 0, 0, 0);
      this.time.delayedCall(500, () => {
        this.scene.start(SCENE_KEYS.RESULT, { matchResult });
      });
    });
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
    if (this.hesitationCheckTimer) {
      this.hesitationCheckTimer.destroy();
    }
    if (this.hostCommentaryTimer) {
      this.hostCommentaryTimer.destroy();
    }

    const overlay = document.querySelector('.match-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    const style = document.querySelector('style[data-match-style]');
    if (style && style.parentNode) {
      style.parentNode.removeChild(style);
    }
  }
}
