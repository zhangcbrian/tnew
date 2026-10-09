import * as THREE from 'three';
import { ChunkManager } from './world/chunk-manager';
import { Water } from './world/water';
import { Vegetation } from './world/vegetation';
import { Skybox } from './world/skybox';
import { OtterController } from './character/otter-controller';
import { CameraSystem } from './camera/camera-system';
import { InputManager } from './controls/input-manager';
import { LoadingScreen } from './ui/loading';
import { GameOverScreen } from './ui/game-over';
import { HUD } from './ui/hud';
import { PauseScreen } from './ui/pause-screen';
import { CharacterSelect } from './ui/character-select';
import { ColorScreen } from './ui/color-screen';
import { RocketSystem } from './character/rockets';
import { Weather } from './world/weather';
import { Animals } from './world/animals';
import { BuildingSystem } from './world/building';
import { People } from './world/people';
import { SciaticaSound } from './audio/sciatica-sound';
import { ShockwaveEffect } from './effects/shockwave';

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private cameraSystem: CameraSystem;
  private input: InputManager;

  private chunkManager: ChunkManager;
  private water: Water;
  private vegetation!: Vegetation;
  private skybox: Skybox;
  private otter: OtterController;

  private loadingScreen: LoadingScreen;
  private gameOverScreen: GameOverScreen;
  private pauseScreen: PauseScreen;
  private hud: HUD;

  private rockets!: RocketSystem;
  private weather!: Weather;
  private animals!: Animals;
  private building!: BuildingSystem;
  private people!: People;
  private sunLight!: THREE.DirectionalLight;
  private sciaticaSound = new SciaticaSound();
  private shockwave = new ShockwaveEffect();
  private clock = new THREE.Clock();
  private state: 'loading' | 'title' | 'playing' | 'paused' = 'loading';
  private loadPhase = 0;
  private resizeQueued = false;
  private readonly mouseDelta = new THREE.Vector2();
  private lastHudBlockIndex = -1;

  // Fog reference for falling effect
  private baseFogNear = 140;
  private baseFogFar = 520;

  constructor() {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(this.renderer.domElement);

    // Scene
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xb9c7d2, this.baseFogNear, this.baseFogFar);

    // Camera
    this.cameraSystem = new CameraSystem();

    // Input
    this.input = new InputManager(this.renderer.domElement);

    // Skybox
    this.skybox = new Skybox();
    this.scene.add(this.skybox.sky);

    // Lighting
    this.setupLighting();

    // World systems (instantiated, loaded incrementally)
    this.chunkManager = new ChunkManager();
    this.scene.add(this.chunkManager.group);

    this.water = new Water();
    this.scene.add(this.water.mesh);

    // Character
    this.otter = new OtterController();
    this.scene.add(this.otter.model);

    // Rockets
    this.rockets = new RocketSystem(this.scene);

    // Shockwave effect
    this.scene.add(this.shockwave.group);

    // UI
    this.loadingScreen = new LoadingScreen();
    this.gameOverScreen = new GameOverScreen();
    this.pauseScreen = new PauseScreen();
    this.hud = new HUD();

    // Title screen Play -> pick animal & wings -> color -> play
    const characterSelect = new CharacterSelect();
    const colorScreen = new ColorScreen();
    const openPicker = () => characterSelect.open((sel) => {
      colorScreen.open(sel.animal, sel.wings, openPicker, (choice) => {
        this.otter.setCharacter(choice);
        this.state = 'playing';
        this.hud.show();
      });
    });
    this.loadingScreen.onPlay(openPicker);

    // Resize
    window.addEventListener('resize', this.onResize, { passive: true });

    // Start loop
    this.clock.start();
    this.loop();
  }

  private onResize = () => {
    if (this.resizeQueued) return;
    this.resizeQueued = true;
    requestAnimationFrame(() => {
      this.resizeQueued = false;
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    });
  };

  private setupLighting() {
    // Hemisphere light
    const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x556b2f, 0.6);
    this.scene.add(hemiLight);

    // Directional sun
    this.sunLight = new THREE.DirectionalLight(0xfff5e6, 1.2);
    this.sunLight.position.set(80, 100, 60);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(2048, 2048);
    this.sunLight.shadow.camera.left = -80;
    this.sunLight.shadow.camera.right = 80;
    this.sunLight.shadow.camera.top = 80;
    this.sunLight.shadow.camera.bottom = -80;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 300;
    this.sunLight.shadow.bias = -0.001;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // Ambient fill
    const ambientLight = new THREE.AmbientLight(0x404050, 0.3);
    this.scene.add(ambientLight);
  }

  private loop = () => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.08);
    const time = this.clock.elapsedTime;

    if (this.state === 'loading') {
      this.loadStep();
      this.renderer.render(this.scene, this.cameraSystem.camera);
      return;
    }

    if (this.state === 'title') {
      // Keep streaming the rest of the view while the player is in the menus.
      this.chunkManager.update(this.otter.position.x, this.otter.position.z);
      this.skybox.update(this.cameraSystem.camera.position);
      this.renderer.render(this.scene, this.cameraSystem.camera);
      return;
    }

    // Check for pause toggle
    if (this.input.consumePauseToggle()) {
      if (this.state === 'playing') {
        this.state = 'paused';
        this.hud.hide();
        if (document.pointerLockElement) document.exitPointerLock();
        this.pauseScreen.show(() => {
          this.state = 'playing';
          this.hud.show();
        });
        this.renderer.render(this.scene, this.cameraSystem.camera);
        return;
      }
    }

    if (this.state === 'paused') {
      this.renderer.render(this.scene, this.cameraSystem.camera);
      return;
    }

    // Update input
    this.input.update();

    // Camera toggle
    if (this.input.consumeToggleCamera()) {
      this.cameraSystem.toggle();
      // Hide otter model in first-person
      this.otter.model.visible = this.cameraSystem.mode === 'third-person';
    }

    // Mouse delta
    const mouseDelta = this.input.consumeMouseDelta(this.mouseDelta);
    const scrollDelta = this.input.consumeScrollDelta();

    // Apply camera input first so movement uses the latest camera yaw (no 1-frame lag).
    this.cameraSystem.applyInput(mouseDelta, scrollDelta);

    // Update otter
    this.otter.update(
      dt,
      this.input.moveDir,
      this.input.wantFly,
      this.input.wantDescend,
      this.cameraSystem.cameraYaw,
      this.building,
    );

    // Shoot rocket
    if (this.input.consumeShootRocket() && this.otter.state !== 'FALL' && this.otter.state !== 'GAME_OVER') {
      this.rockets.shoot(this.otter.position, this.otter.heading);
    }
    this.rockets.update(dt);

    // Repel humans
    if (this.input.consumeRepelHumans() && this.otter.state !== 'FALL' && this.otter.state !== 'GAME_OVER') {
      this.sciaticaSound.play();
      this.shockwave.trigger(this.otter.position.x, this.otter.position.y, this.otter.position.z);
      this.cameraSystem.shake(0.6);
      this.people.repelAll(this.otter.position.x, this.otter.position.z);
    }
    this.shockwave.update(dt);

    // Update camera
    this.cameraSystem.update(dt, this.otter.position, this.otter.heading);

    // Building controls
    const cycleDir = this.input.consumeCycleBlock();
    if (cycleDir !== 0) this.building.cycleBlock(cycleDir);
    const selectNum = this.input.consumeSelectBlock();
    if (selectNum >= 0) this.building.selectBlock(selectNum);
    if (this.input.consumePlaceBlock()) {
      const pos = this.otter.position;
      this.building.updatePreview(this.cameraSystem.camera, pos, this.chunkManager.nearbyMeshes(pos.x, pos.z));
      // Blocks are solid, so never place one on top of the player or a creature.
      this.building.placeBlock((minX, minY, minZ, maxX, maxY, maxZ) => {
        const cx = (minX + maxX) / 2;
        const cz = (minZ + maxZ) / 2;
        return this.otter.overlaps(minX, minY, minZ, maxX, maxY, maxZ)
          || this.animals.isNear(cx, minY, cz, 1.2)
          || this.people.isNear(cx, minY, cz, 1.2);
      });
    }
    this.building.hidePreview();
    if (this.input.consumeRemoveBlock()) this.building.removeBlock(this.cameraSystem.camera);
    if (this.building.selectedIndex !== this.lastHudBlockIndex) {
      this.lastHudBlockIndex = this.building.selectedIndex;
      this.hud.updateBlockSelection(this.lastHudBlockIndex);
    }

    // Update world
    this.chunkManager.update(this.otter.position.x, this.otter.position.z);
    this.water.update(time, this.otter.position.x, this.otter.position.z);
    this.skybox.update(this.cameraSystem.camera.position);
    this.weather.update(dt, time, this.otter.position.x, this.otter.position.y, this.otter.position.z);
    this.animals.update(dt, time, this.otter.position, this.building);
    this.people.update(dt, time, this.otter.position, this.otter.heading);

    // Shadow follows player
    this.sunLight.position.set(
      this.otter.position.x + 80,
      100,
      this.otter.position.z + 60,
    );
    this.sunLight.target.position.copy(this.otter.position);

    this.renderer.render(this.scene, this.cameraSystem.camera);
  };

  private loadStep() {
    switch (this.loadPhase) {
      case 0:
        // Vegetation subscribes to chunk loads, so it must exist before any terrain.
        this.loadingScreen.setProgress(0.02, 'Planting heather and pines...');
        this.vegetation = new Vegetation();
        this.scene.add(this.vegetation.group);
        this.chunkManager.setCallbacks(
          (cx, cz) => this.vegetation.addChunk(cx, cz),
          (cx, cz) => this.vegetation.removeChunk(cx, cz),
        );
        this.loadPhase = 1;
        break;
      case 1: {
        // Build the glen around spawn; the rest streams in during play.
        const p = this.chunkManager.preload(0, 0, 5, 6);
        this.loadingScreen.setProgress(0.05 + p * 0.8, `Shaping the Highlands... ${Math.round(p * 100)}%`);
        if (p >= 1) this.loadPhase = 4;
        break;
      }
      case 4:
        this.loadingScreen.setProgress(0.88, 'Brewing weather...');
        this.weather = new Weather();
        this.scene.add(this.weather.group);
        this.loadPhase = 5;
        break;
      case 5:
        this.loadingScreen.setProgress(0.93, 'Spawning wildlife...');
        this.animals = new Animals();
        this.scene.add(this.animals.group);
        this.loadPhase = 6;
        break;
      case 6:
        this.loadingScreen.setProgress(0.95, 'Populating world...');
        this.people = new People();
        this.scene.add(this.people.group);
        this.loadPhase = 7;
        break;
      case 7:
        this.loadingScreen.setProgress(0.97, 'Setting up building...');
        this.building = new BuildingSystem();
        this.scene.add(this.building.group);
        this.people.blocks = this.building;
        this.loadPhase = 8;
        break;
      case 8:
        this.loadingScreen.setProgress(1.0, 'Ready!');
        this.loadPhase = 9;
        break;
      case 9:
        this.loadingScreen.showTitleScreen();
        this.state = 'title';
        break;
    }
  }

  private resetFog() {
    const fog = this.scene.fog as THREE.Fog;
    fog.near = this.baseFogNear;
    fog.far = this.baseFogFar;
    fog.color.set(0xb9c7d2);
  }
}
