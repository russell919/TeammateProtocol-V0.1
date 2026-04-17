import Phaser from 'phaser';
import { COLORS, SCENE_KEYS } from '../data/gameConfig';
import { INTRO_DIALOGS } from '../data/dialogs';
import type { DialogLine } from '../core/types';

export class IntroScene extends Phaser.Scene {
  private dialogIndex: number = 0;
  private currentText: string = '';
  private charIndex: number = 0;
  private typeTimer: number = 0;
  private isTyping: boolean = false;
  private typingPaused: boolean = false;

  constructor() {
    super({ key: SCENE_KEYS.INTRO });
  }

  create(): void {
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.shutdown, this);
    this.cameras.main.setBackgroundColor(COLORS.BACKGROUND);
    this.createHtmlUI();
  }

  private createHtmlUI(): void {
    const style = document.createElement('style');
    style.id = 'intro-style';
    style.textContent = `
      .intro-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 100;
        pointer-events: auto;
        background: linear-gradient(180deg, rgba(15,15,24,1) 0%, rgba(10,10,16,1) 100%);
      }
      .intro-overlay::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: repeating-linear-gradient(
          0deg,
          transparent,
          transparent 58px,
          rgba(26,26,46,0.3) 58px,
          rgba(26,26,46,0.3) 60px
        );
        pointer-events: none;
      }
      .intro-stage-label {
        position: fixed;
        top: 40px;
        left: 50%;
        transform: translateX(-50%);
        font-family: 'Courier New', monospace;
        font-size: 16px;
        color: #555566;
        z-index: 101;
      }
      .intro-dialog-panel {
        position: fixed;
        bottom: 60px;
        left: 50%;
        transform: translateX(-50%);
        width: calc(100% - 200px);
        max-width: 1080px;
        height: 200px;
        background: rgba(21,21,32,0.95);
        border: 2px solid #2a2a3a;
        border-top: 2px solid rgba(255,51,68,0.5);
        padding: 20px 30px;
        box-sizing: border-box;
        z-index: 101;
      }
      .intro-speaker {
        font-family: 'Courier New', monospace;
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 16px;
        line-height: 1.4;
      }
      .intro-speaker.host { color: #ffcc66; }
      .intro-speaker.system { color: #88aaff; }
      .intro-speaker.ai { color: #00ff88; }
      .intro-text {
        font-family: 'Courier New', monospace;
        font-size: 20px;
        color: #e8e8e8;
        line-height: 1.8;
        min-height: 100px;
        word-wrap: break-word;
      }
      .intro-indicator {
        position: absolute;
        bottom: 20px;
        right: 30px;
        font-family: 'Courier New', monospace;
        font-size: 16px;
        color: #00ccff;
        animation: blink 0.8s ease-in-out infinite;
      }
      @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }
      .intro-continue-hint {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        font-family: 'Courier New', monospace;
        font-size: 12px;
        color: #444455;
        z-index: 101;
      }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.className = 'intro-overlay';
    overlay.id = 'intro-overlay';
    overlay.innerHTML = `
      <div class="intro-stage-label">第一场 · 暗灯竞价</div>
      <div class="intro-dialog-panel" id="intro-dialog-panel">
        <div class="intro-speaker host" id="intro-speaker"></div>
        <div class="intro-text" id="intro-text"></div>
        <div class="intro-indicator" id="intro-indicator">▼</div>
      </div>
      <div class="intro-continue-hint">点击或按空格键继续</div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener('click', () => this.handleContinue());
    this.input.keyboard?.on('keydown-SPACE', () => this.handleContinue());

    this.showCurrentDialog();
  }

  private handleContinue(): void {
    const textEl = document.getElementById('intro-text');
    if (!textEl) return;

    if (this.isTyping) {
      this.typingPaused = true;
      if (textEl.textContent !== INTRO_DIALOGS[this.dialogIndex].text) {
        textEl.textContent = INTRO_DIALOGS[this.dialogIndex].text;
      }
      this.isTyping = false;
    } else {
      this.dialogIndex++;
      this.showCurrentDialog();
    }
  }

  private getSpeakerStyle(speaker: DialogLine['speaker']): string {
    switch (speaker) {
      case 'host':
        return 'host';
      case 'system':
        return 'system';
      case 'ai':
        return 'ai';
      default:
        return '';
    }
  }

  private getSpeakerName(speaker: DialogLine['speaker']): string {
    switch (speaker) {
      case 'host':
        return '主持人';
      case 'system':
        return '系统提示';
      case 'ai':
        return 'AI队友';
      default:
        return '未知';
    }
  }

  private showCurrentDialog(): void {
    if (this.dialogIndex >= INTRO_DIALOGS.length) {
      this.goToRules();
      return;
    }

    const dialog = INTRO_DIALOGS[this.dialogIndex];
    const speakerEl = document.getElementById('intro-speaker');
    const textEl = document.getElementById('intro-text');

    if (speakerEl && textEl) {
      const speakerClass = this.getSpeakerStyle(dialog.speaker);
      speakerEl.className = `intro-speaker ${speakerClass}`;
      speakerEl.textContent = `「${this.getSpeakerName(dialog.speaker)}」`;
      textEl.textContent = '';
      this.currentText = dialog.text;
      this.charIndex = 0;
      this.typingPaused = false;
      this.isTyping = true;
      this.startTyping();
    }
  }

  private startTyping(): void {
    const textEl = document.getElementById('intro-text');
    if (!textEl) return;

    this.typeTimer = window.setInterval(() => {
      if (this.typingPaused) {
        clearInterval(this.typeTimer);
        this.isTyping = false;
        return;
      }

      if (this.charIndex < this.currentText.length) {
        textEl.textContent = this.currentText.substring(0, this.charIndex + 1);
        this.charIndex++;
      } else {
        clearInterval(this.typeTimer);
        this.isTyping = false;
      }
    }, 30);
  }

  private goToRules(): void {
    this.cameras.main.fade(500, 0, 0, 0);
    this.time.delayedCall(500, () => {
      this.scene.start(SCENE_KEYS.RULES);
    });
  }

  shutdown(): void {
    clearInterval(this.typeTimer);
    const overlay = document.getElementById('intro-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    const style = document.getElementById('intro-style');
    if (style && style.parentNode) {
      style.parentNode.removeChild(style);
    }
  }
}
