import Phaser from 'phaser';
import { COLORS, SCENE_KEYS } from '../data/gameConfig';

export class RuleScene extends Phaser.Scene {
  private currentPage: number = 0;
  private totalPages: number = 3;

  constructor() {
    super({ key: SCENE_KEYS.RULES });
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);
    this.cameras.main.setBackgroundColor(COLORS.BACKGROUND);
    this.createHtmlUI();
  }

  private createHtmlUI(): void {
    const style = document.createElement('style');
    style.id = 'rule-style';
    style.textContent = `
      .rule-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 100;
        pointer-events: none;
        background: #0a0a12;
      }
      .rule-overlay::before {
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
      .rule-header {
        position: fixed;
        top: 50px;
        left: 50%;
        transform: translateX(-50%);
        text-align: center;
        z-index: 101;
      }
      .rule-title {
        font-family: 'Courier New', monospace;
        font-size: 32px;
        font-weight: bold;
        color: #e8e8e8;
        margin-bottom: 8px;
      }
      .rule-subtitle {
        font-family: 'Courier New', monospace;
        font-size: 20px;
        color: #00ccff;
        margin-bottom: 8px;
      }
      .rule-divider {
        width: 200px;
        height: 2px;
        background: linear-gradient(90deg, transparent, rgba(255,51,68,0.5), transparent);
        margin: 0 auto;
      }
      .rule-content-panel {
        position: fixed;
        top: 130px;
        left: 50%;
        transform: translateX(-50%);
        width: calc(100% - 200px);
        max-width: 1080px;
        height: 420px;
        background: rgba(21,21,32,0.9);
        border: 2px solid #2a2a3a;
        padding: 20px 30px;
        box-sizing: border-box;
        z-index: 101;
      }
      .rule-page-title {
        font-family: 'Courier New', monospace;
        font-size: 20px;
        font-weight: bold;
        color: #00ccff;
        margin-bottom: 24px;
        line-height: 1.4;
      }
      .rule-lines {
        font-family: 'Courier New', monospace;
        font-size: 16px;
        color: #e8e8e8;
        line-height: 2;
      }
      .rule-line {
        margin: 0;
        line-height: 2;
      }
      .rule-line.indent {
        color: #888899;
        padding-left: 20px;
      }
      .rule-indicators {
        position: fixed;
        bottom: 100px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 16px;
        z-index: 101;
      }
      .rule-indicator {
        font-family: 'Courier New', monospace;
        font-size: 14px;
        cursor: pointer;
        pointer-events: auto;
        transition: color 0.2s;
      }
      .rule-indicator.active { color: #00ccff; }
      .rule-indicator.inactive { color: #555566; }
      .rule-buttons {
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 20px;
        z-index: 101;
      }
      .rule-btn {
        pointer-events: auto;
        font-family: 'Courier New', monospace;
        font-size: 16px;
        color: #e8e8e8;
        background: rgba(42,42,58,0.8);
        border: 2px solid rgba(0,204,255,0.5);
        padding: 12px 32px;
        cursor: pointer;
        transition: all 0.2s ease;
        min-width: 140px;
      }
      .rule-btn:hover:not(:disabled) {
        background: rgba(0,204,255,0.3);
        border-color: #00ccff;
      }
      .rule-btn:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }
      .rule-btn.start {
        border-color: rgba(255,51,68,0.5);
      }
      .rule-btn.start:hover {
        background: rgba(255,51,68,0.3);
        border-color: #ff3344;
      }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'rule-overlay';
    overlay.id = 'rule-overlay';
    overlay.innerHTML = `
      <div class="rule-header">
        <div class="rule-divider"></div>
      </div>
      <div class="rule-content-panel" id="rule-content">
      </div>
      <div class="rule-indicators" id="rule-indicators"></div>
      <div class="rule-buttons">
        <button class="rule-btn" id="btn-prev">上一页</button>
        <button class="rule-btn start" id="btn-start">开始比赛</button>
        <button class="rule-btn" id="btn-next">下一页</button>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('btn-prev')?.addEventListener('click', () => this.prevPage());
    document.getElementById('btn-next')?.addEventListener('click', () => this.nextPage());
    document.getElementById('btn-start')?.addEventListener('click', () => this.startMatch());

    this.showPage(0);
    this.createIndicators();
  }

  private getPageContent(pageIndex: number): { title: string; lines: { text: string; indent: boolean }[] } {
    switch (pageIndex) {
      case 0:
        return {
          title: '第一页：胜负规则',
          lines: [
            { text: '■ 游戏名称：暗灯竞价', indent: false },
            { text: '', indent: false },
            { text: '■ 双方初始资源：各 100 点', indent: false },
            { text: '', indent: false },
            { text: '■ 总回合数：9 回合', indent: false },
            { text: '', indent: false },
            { text: '■ 每回合双方同时秘密出价（0~剩余资源）', indent: false },
            { text: '', indent: false },
            { text: '■ 出价更高者赢得该回合，获得1胜场', indent: false },
            { text: '', indent: false },
            { text: '■ 9回合后，胜场更多者获胜', indent: false },
            { text: '', indent: false },
            { text: '■ 若胜场相同，则比较剩余资源', indent: false },
            { text: '', indent: false },
            { text: '■ 若剩余资源也相同，则玩家判负', indent: false },
          ],
        };
      case 1:
        return {
          title: '第二页：隐藏信息与灯数',
          lines: [
            { text: '■ 玩家只能看到自己的准确剩余资源', indent: false },
            { text: '', indent: false },
            { text: '■ 玩家看不到对手的准确剩余资源', indent: false },
            { text: '', indent: false },
            { text: '■ 只能通过"灯数"估计对手资源区间：', indent: false },
            { text: '灯数 5 → 资源 81~100', indent: true },
            { text: '灯数 4 → 资源 61~80', indent: true },
            { text: '灯数 3 → 资源 41~60', indent: true },
            { text: '灯数 2 → 资源 21~40', indent: true },
            { text: '灯数 1 → 资源 1~20', indent: true },
            { text: '灯数 0 → 资源 0', indent: true },
            { text: '', indent: false },
            { text: '■ 灯数会随资源消耗而减少', indent: false },
          ],
        };
      case 2:
        return {
          title: '第三页：出价规则',
          lines: [
            { text: '■ 每回合出价范围：0 ~ 当前剩余资源', indent: false },
            { text: '', indent: false },
            { text: '■ 出价 0 表示本回合弃守（不消耗资源）', indent: false },
            { text: '', indent: false },
            { text: '■ 若资源为0，则只能出0', indent: false },
            { text: '', indent: false },
            { text: '■ 平局时：双方都消耗各自出价，但无人得分', indent: false },
            { text: '', indent: false },
            { text: '■ 若双方资源都为0，比赛提前结束', indent: false },
            { text: '', indent: false },
            { text: '■ 提示：善用弃守策略保存资源！', indent: false },
          ],
        };
      default:
        return { title: '', lines: [] };
    }
  }

  private showPage(pageIndex: number): void {
    this.currentPage = pageIndex;
    const content = this.getPageContent(pageIndex);
    const contentEl = document.getElementById('rule-content');

    if (contentEl) {
      let linesHtml = `<div class="rule-page-title">${content.title}</div>`;
      linesHtml += '<div class="rule-lines">';
      content.lines.forEach((line) => {
        if (line.text === '') {
          linesHtml += '<div class="rule-line" style="height: 8px;"></div>';
        } else {
          linesHtml += `<div class="rule-line ${line.indent ? 'indent' : ''}">${line.text}</div>`;
        }
      });
      linesHtml += '</div>';
      contentEl.innerHTML = linesHtml;
    }

    const prevBtn = document.getElementById('btn-prev') as HTMLButtonElement;
    const nextBtn = document.getElementById('btn-next') as HTMLButtonElement;

    if (prevBtn) prevBtn.disabled = pageIndex === 0;
    if (nextBtn) nextBtn.disabled = pageIndex === this.totalPages - 1;

    this.updateIndicators();
  }

  private createIndicators(): void {
    const container = document.getElementById('rule-indicators');
    if (!container) return;

    for (let i = 0; i < this.totalPages; i++) {
      const indicator = document.createElement('span');
      indicator.className = 'rule-indicator';
      indicator.id = `indicator-${i}`;
      indicator.textContent = '●';
      indicator.addEventListener('click', () => this.goToPage(i));
      container.appendChild(indicator);
    }
    this.updateIndicators();
  }

  private updateIndicators(): void {
    for (let i = 0; i < this.totalPages; i++) {
      const indicator = document.getElementById(`indicator-${i}`);
      if (indicator) {
        indicator.className = `rule-indicator ${i === this.currentPage ? 'active' : 'inactive'}`;
      }
    }
  }

  private prevPage(): void {
    if (this.currentPage > 0) {
      this.showPage(this.currentPage - 1);
    }
  }

  private nextPage(): void {
    if (this.currentPage < this.totalPages - 1) {
      this.showPage(this.currentPage + 1);
    }
  }

  private goToPage(pageIndex: number): void {
    this.showPage(pageIndex);
  }

  private startMatch(): void {
    this.cameras.main.fade(300, 0, 0, 0);
    this.time.delayedCall(300, () => {
      this.scene.start(SCENE_KEYS.MATCH);
    });
  }

  shutdown(): void {
    const overlay = document.getElementById('rule-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    const style = document.getElementById('rule-style');
    if (style && style.parentNode) {
      style.parentNode.removeChild(style);
    }
  }
}
