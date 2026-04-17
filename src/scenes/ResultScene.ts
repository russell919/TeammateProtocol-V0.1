import Phaser from 'phaser';
import { COLORS, SCENE_KEYS } from '../data/gameConfig';
import { HOST_WIN_LINES, HOST_LOSE_LINES, HOST_DRAW_LINES, AI_END_LINES, AI_END_LINES_LOSS } from '../data/dialogs';
import type { MatchResult } from '../core/types';

interface ResultSceneData {
  matchResult: MatchResult;
}

export class ResultScene extends Phaser.Scene {
  private resultData!: MatchResult;

  constructor() {
    super({ key: SCENE_KEYS.RESULT });
  }

  init(data: ResultSceneData): void {
    this.resultData = data.matchResult;
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);
    this.cameras.main.setBackgroundColor(COLORS.BACKGROUND);
    this.createHtmlUI();

    this.time.delayedCall(500, () => {
      this.cameras.main.fadeIn(500);
    });
  }

  private createHtmlUI(): void {
    const isWin = this.resultData.winner === 'player';
    const isDraw = this.resultData.winner === 'draw';
    const accentColor = isWin ? '#00ff88' : isDraw ? '#ffcc00' : '#ff3344';

    const style = document.createElement('style');
    style.id = 'result-style';
    style.textContent = `
      .result-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 100;
        pointer-events: none;
        background: #0a0a12;
      }
      .result-overlay::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: repeating-linear-gradient(
          0deg,
          transparent,
          transparent 38px,
          rgba(26,26,46,0.2) 38px,
          rgba(26,26,46,0.2) 40px
        );
        pointer-events: none;
      }
      .result-prize-display {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(21,21,32,0.95);
        border: 1px solid #2a2a3a;
        padding: 12px 32px;
        font-family: 'Courier New', monospace;
        z-index: 9999;
        text-align: center;
      }
      .prize-main {
        color: ${isWin ? '#00ff88' : '#ff3344'};
        font-size: 24px;
        font-weight: bold;
        line-height: 1.4;
      }
      .prize-sub {
        color: #888899;
        font-size: 14px;
        margin-top: 4px;
        line-height: 1.4;
      }
      .result-title {
        position: fixed;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        font-family: 'Courier New', monospace;
        font-size: 56px;
        font-weight: bold;
        color: ${accentColor};
        animation: titlePulse 1.5s ease-in-out infinite;
        line-height: 1.4;
      }
      @keyframes titlePulse {
        0%, 100% { transform: translateX(-50%) scale(1); }
        50% { transform: translateX(-50%) scale(1.03); }
      }
      .result-divider {
        position: fixed;
        top: 160px;
        left: 50%;
        transform: translateX(-50%);
        width: 400px;
        height: 2px;
        background: linear-gradient(90deg, transparent, ${accentColor}80, transparent);
      }
      .result-prize-panel {
        position: fixed;
        top: 180px;
        left: 50%;
        transform: translateX(-50%);
        width: 400px;
        height: 80px;
        background: rgba(21,21,32,0.8);
        border: 1px solid ${accentColor}50;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 101;
      }
      .prize-earned {
        font-family: 'Courier New', monospace;
        font-size: 20px;
        font-weight: bold;
        color: ${isWin ? '#00ff88' : '#ff3344'};
        line-height: 1.4;
      }
      .prize-total {
        font-family: 'Courier New', monospace;
        font-size: 16px;
        color: ${isWin ? '#ffcc00' : '#888899'};
        line-height: 1.4;
      }
      .result-stats-panel {
        position: fixed;
        top: 280px;
        left: 50%;
        transform: translateX(-50%);
        width: 500px;
        height: 160px;
        background: rgba(21,21,32,0.75);
        border: 2px solid #2a2a3a;
        padding: 20px;
        z-index: 101;
        box-sizing: border-box;
      }
      .stats-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 16px;
      }
      .stats-block {
        text-align: center;
        flex: 1;
      }
      .stats-label {
        font-family: 'Courier New', monospace;
        font-size: 14px;
        color: #888899;
        margin-bottom: 8px;
        line-height: 1.4;
      }
      .stats-value {
        font-family: 'Courier New', monospace;
        font-size: 28px;
        font-weight: bold;
        color: #e8e8e8;
        line-height: 1.4;
      }
      .stats-reliance {
        font-family: 'Courier New', monospace;
        font-size: 13px;
        color: #556655;
        margin-top: 16px;
        text-align: center;
        line-height: 1.4;
      }
      .result-dialog-panel {
        position: fixed;
        bottom: 140px;
        left: 50%;
        transform: translateX(-50%);
        width: calc(100% - 200px);
        max-width: 1080px;
        height: 140px;
        background: rgba(21,21,32,0.85);
        border: 2px solid #2a2a3a;
        padding: 16px 24px;
        z-index: 101;
        box-sizing: border-box;
      }
      .dialog-host {
        font-family: 'Courier New', monospace;
        font-size: 16px;
        font-weight: bold;
        color: #ffcc66;
        margin-bottom: 8px;
        line-height: 1.4;
      }
      .dialog-host-text {
        font-family: 'Courier New', monospace;
        font-size: 16px;
        color: #e8e8e8;
        line-height: 1.6;
        margin-bottom: 16px;
      }
      .dialog-ai {
        font-family: 'Courier New', monospace;
        font-size: 16px;
        font-weight: bold;
        color: #00ff88;
        margin-bottom: 8px;
        line-height: 1.4;
      }
      .dialog-ai-text {
        font-family: 'Courier New', monospace;
        font-size: 16px;
        color: #e8e8e8;
        line-height: 1.6;
      }
      .result-buttons {
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 20px;
        z-index: 101;
      }
      .result-btn {
        pointer-events: auto;
        font-family: 'Courier New', monospace;
        font-size: 16px;
        color: #888899;
        background: rgba(42,42,58,0.8);
        border: 1px solid rgba(0,204,255,0.4);
        padding: 12px 32px;
        cursor: pointer;
        transition: all 0.2s ease;
        min-width: 160px;
      }
      .result-btn:hover {
        background: rgba(0,204,255,0.2);
        border-color: #00ccff;
        color: #00ccff;
      }
      .result-placeholder {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-family: 'Courier New', monospace;
        font-size: 24px;
        color: #00ccff;
        background: rgba(0,0,0,0.9);
        padding: 20px 40px;
        border: 1px solid #00ccff;
        z-index: 200;
        animation: fadeOut 3s forwards;
      }
      @keyframes fadeOut {
        0%, 70% { opacity: 1; }
        100% { opacity: 0; }
      }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'result-overlay';
    overlay.id = 'result-overlay';

    const resultText = isDraw ? '第一场 · 平局' : isWin ? '第一场 · 胜利' : '第一场 · 失败';

    overlay.innerHTML = `
      <div class="result-prize-display">
        <div class="prize-main">${isWin ? '+¥' + this.resultData.prizeWon.toLocaleString() : '奖金归零'}</div>
        <div class="prize-sub">${isWin ? '当前累计: ¥' + this.resultData.totalPrize.toLocaleString() : '失去本轮资格与所有奖金'}</div>
      </div>
      <div class="result-title">${resultText}</div>
      <div class="result-divider"></div>
      <div class="result-stats-panel">
        <div class="stats-row">
          <div class="stats-block">
            <div class="stats-label">最终比分</div>
            <div class="stats-value">${this.resultData.playerWins} : ${this.resultData.opponentWins}</div>
          </div>
          <div class="stats-block">
            <div class="stats-label">剩余资源</div>
            <div class="stats-value">${this.resultData.playerRemaining} : ${this.resultData.opponentRemaining}</div>
          </div>
        </div>
        <div class="stats-reliance">AI依赖度: ${this.resultData.totalAdviceGiven > 0 ? Math.round((this.resultData.relianceCount / this.resultData.totalAdviceGiven) * 100) : 0}% (${this.resultData.relianceCount}/${this.resultData.totalAdviceGiven})</div>
      </div>
      <div class="result-dialog-panel" id="result-dialog">
      </div>
      <div class="result-buttons">
        <button class="result-btn" id="btn-menu">返回入口</button>
        <button class="result-btn" id="btn-continue">继续参赛</button>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('btn-menu')?.addEventListener('click', () => {
      this.cameras.main.fade(300, 0, 0, 0);
      this.time.delayedCall(300, () => {
        this.scene.start(SCENE_KEYS.MENU);
      });
    });

    document.getElementById('btn-continue')?.addEventListener('click', () => {
      this.showPlaceholderMessage();
    });

    this.showDialogs();
  }

  private showDialogs(): void {
    const isWin = this.resultData.winner === 'player';
    const isDraw = this.resultData.winner === 'draw';

    let hostLines: string[];
    if (isDraw) {
      hostLines = HOST_DRAW_LINES;
    } else if (isWin) {
      hostLines = HOST_WIN_LINES;
    } else {
      hostLines = HOST_LOSE_LINES;
    }

    const hostLine = hostLines[Math.floor(Math.random() * hostLines.length)];
    const aiLine = isWin
      ? AI_END_LINES[Math.floor(Math.random() * AI_END_LINES.length)]
      : AI_END_LINES_LOSS[Math.floor(Math.random() * AI_END_LINES_LOSS.length)];

    const dialogEl = document.getElementById('result-dialog');

    this.time.delayedCall(800, () => {
      if (dialogEl) {
        dialogEl.innerHTML = `
          <div class="dialog-host">「主持人」</div>
          <div class="dialog-host-text">${hostLine}</div>
          <div class="dialog-ai">「AI队友」</div>
          <div class="dialog-ai-text">${aiLine}</div>
        `;
      }
    });
  }

  private showPlaceholderMessage(): void {
    const placeholder = document.createElement('div');
    placeholder.className = 'result-placeholder';
    placeholder.textContent = '下一场即将推出...';
    document.body.appendChild(placeholder);

    setTimeout(() => {
      if (placeholder.parentNode) {
        placeholder.parentNode.removeChild(placeholder);
      }
    }, 3000);
  }

  shutdown(): void {
    const overlay = document.getElementById('result-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    const style = document.getElementById('result-style');
    if (style && style.parentNode) {
      style.parentNode.removeChild(style);
    }
  }
}
