import Phaser from 'phaser';
import { COLORS, SCENE_KEYS } from '../data/gameConfig';
import { LEVEL2_SCENE_KEY } from '../level2';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.MENU });
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);
    this.cameras.main.setBackgroundColor(COLORS.BACKGROUND);
    this.createHtmlUI();
  }

  private createHtmlUI(): void {
    const style = document.createElement('style');
    style.id = 'menu-style';
    style.textContent = `
      .menu-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 100;
        pointer-events: none;
        background: linear-gradient(180deg, rgba(15,15,24,1) 0%, rgba(10,10,16,1) 100%);
      }
      .menu-overlay::before {
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
          rgba(26,26,46,0.3) 38px,
          rgba(26,26,46,0.3) 40px
        );
        pointer-events: none;
      }
      .menu-title {
        font-family: 'Courier New', monospace;
        font-size: 72px;
        font-weight: bold;
        color: #e8e8e8;
        margin-bottom: 8px;
        text-shadow: 0 0 20px rgba(255,255,255,0.1);
        animation: titlePulse 3s ease-in-out infinite;
      }
      @keyframes titlePulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.85; }
      }
      .menu-subtitle-en {
        font-family: 'Courier New', monospace;
        font-size: 18px;
        color: #00ccff;
        letter-spacing: 8px;
        margin-bottom: 24px;
      }
      .menu-divider {
        width: 300px;
        height: 2px;
        background: linear-gradient(90deg, transparent, #ff3344, transparent);
        margin-bottom: 32px;
      }
      .menu-tagline {
        font-family: 'Courier New', monospace;
        font-size: 20px;
        color: #888899;
        margin-bottom: 12px;
        line-height: 1.6;
      }
      .menu-competition {
        font-family: 'Courier New', monospace;
        font-size: 14px;
        color: #555566;
        margin-bottom: 40px;
      }
      .menu-button-group {
        display: flex;
        gap: 20px;
        pointer-events: auto;
      }
      .menu-start-btn {
        pointer-events: auto;
        font-family: 'Courier New', monospace;
        font-size: 22px;
        font-weight: bold;
        color: #ff3344;
        background: rgba(255,51,68,0.1);
        border: 2px solid #ff3344;
        padding: 16px 36px;
        cursor: pointer;
        transition: all 0.2s ease;
        line-height: 1.4;
        min-width: 220px;
      }
      .menu-start-btn:hover {
        background: rgba(255,51,68,0.3);
        color: #ffffff;
        box-shadow: 0 0 20px rgba(255,51,68,0.3);
      }
      .menu-start-btn.secondary {
        color: #00ccff;
        background: rgba(0,204,255,0.08);
        border-color: #00ccff;
      }
      .menu-start-btn.secondary:hover {
        background: rgba(0,204,255,0.24);
        box-shadow: 0 0 20px rgba(0,204,255,0.24);
      }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'menu-overlay';
    overlay.innerHTML = `
      <div class="menu-title">队友协议</div>
      <div class="menu-subtitle-en">TEAMMATE PROTOCOL</div>
      <div class="menu-divider"></div>
      <div class="menu-tagline">你赢下的每一局，都是它替你决定的。</div>
      <div class="menu-competition">莉莉丝高校游戏创作大赛 · Demo</div>
      <div class="menu-button-group">
        <button class="menu-start-btn" id="start-btn-level1">[ 第一关 ]</button>
        <button class="menu-start-btn secondary" id="start-btn-level2">[ 第二关 ]</button>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('start-btn-level1')?.addEventListener('click', () => {
      this.cameras.main.fade(500, 0, 0, 0);
      this.time.delayedCall(500, () => {
        this.scene.start(SCENE_KEYS.INTRO);
      });
    });

    document.getElementById('start-btn-level2')?.addEventListener('click', () => {
      this.cameras.main.fade(500, 0, 0, 0);
      this.time.delayedCall(500, () => {
        this.scene.start(LEVEL2_SCENE_KEY);
      });
    });
  }

  shutdown(): void {
    const overlay = document.querySelector('.menu-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    const style = document.getElementById('menu-style');
    if (style && style.parentNode) {
      style.parentNode.removeChild(style);
    }
  }
}
