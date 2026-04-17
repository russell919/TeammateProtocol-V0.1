import Phaser from 'phaser';
import { BootScene, MenuScene, IntroScene, RuleScene, MatchScene, ResultScene } from './scenes';
import { GAME_WIDTH, GAME_HEIGHT } from './data/gameConfig';
import { Level2Scene } from './level2';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'app',
  backgroundColor: '#0a0a0f',
  scene: [BootScene, MenuScene, IntroScene, RuleScene, MatchScene, ResultScene, Level2Scene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    pixelArt: false,
    antialias: true,
  },
};

const game = new Phaser.Game(config);

export default game;
