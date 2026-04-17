import Phaser from 'phaser';
import { COLORS, SCENE_KEYS } from '../data/gameConfig';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENE_KEYS.BOOT });
  }

  preload(): void {
    this.createHtmlLoadingBar();
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);
    this.cameras.main.setBackgroundColor(COLORS.BACKGROUND);
    this.showBootText();
    this.time.delayedCall(1500, () => {
      this.scene.start(SCENE_KEYS.MENU);
    });
  }

  private createHtmlLoadingBar(): void {
    const style = document.createElement('style');
    style.id = 'boot-style';
    style.textContent = `
      .boot-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 100;
        background: #0f0f18;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }
      .boot-text {
        font-family: 'Courier New', monospace;
        font-size: 24px;
        color: #00ccff;
        margin-bottom: 8px;
        line-height: 1.4;
      }
      .boot-version {
        font-family: 'Courier New', monospace;
        font-size: 16px;
        color: #888899;
        margin-bottom: 40px;
      }
      .boot-bar-container {
        width: 400px;
        height: 20px;
        background: #222233;
        overflow: hidden;
      }
      .boot-bar-progress {
        height: 100%;
        background: #00ccff;
        animation: loadProgress 1s ease-out forwards;
      }
      @keyframes loadProgress {
        from { width: 0%; }
        to { width: 100%; }
      }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'boot-overlay';
    overlay.innerHTML = `
      <div class="boot-text">系统初始化中...</div>
      <div class="boot-version">TEAMMATE PROTOCOL v0.1</div>
      <div class="boot-bar-container">
        <div class="boot-bar-progress"></div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  private showBootText(): void {
    // Text is already shown via HTML in createHtmlLoadingBar
  }

  shutdown(): void {
    const overlay = document.querySelector('.boot-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    const style = document.getElementById('boot-style');
    if (style && style.parentNode) {
      style.parentNode.removeChild(style);
    }
  }
}
