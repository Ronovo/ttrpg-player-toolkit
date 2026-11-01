import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// jsdom has no WebGL, so the renderer and the environment map are stand-ins; everything else in three.js is the
// real scene graph. Physics, the mat and the tower are stubbed so a test decides when the dice come to rest.
const fakes = vi.hoisted(() => ({ renderers: [], loads: [], observers: [] }));

vi.mock('three', async (importOriginal) => {
  const three = await importOriginal();
  class WebGLRenderer {
    constructor() {
      this.domElement = document.createElement('canvas');
      this.shadowMap = {};
      this.capabilities = { getMaxAnisotropy: () => 8 };
      this.sizes = [];
      this.renders = 0;
      this.initialized = [];
      fakes.renderers.push(this);
    }
    setPixelRatio() {}
    setSize(...size) { this.sizes.push(size); }
    render(scene, camera) {
      this.renders++;
      this.camera = camera;
    }
    initTexture(texture) { this.initialized.push(texture); }
    compileAsync() { return Promise.resolve(); }
  }
  class PMREMGenerator {
    fromScene() { return { texture: null }; }
  }
  return { ...three, WebGLRenderer, PMREMGenerator };
});

vi.mock('three/addons/environments/RoomEnvironment.js', () => ({ RoomEnvironment: class {} }));

vi.mock('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    setDRACOLoader(dracoLoader) {
      fakes.draco = dracoLoader;
      return this;
    }

    loadAsync(url) {
      fakes.loads.push(url);
      const scene = new THREE.Group();
      for (const type of ['d4', 'd6', 'd20']) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: new THREE.Texture() }));
        mesh.name = type;
        scene.add(mesh);
      }
      return Promise.resolve({ scene });
    }
  },
}));

const physics = vi.hoisted(() => ({
  createTable: vi.fn(() => ({ bodies: [] })),
  setBounds: vi.fn(),
  throwDice: vi.fn((table, dice) => {
    table.bodies = dice.map((_, i) => ({ world: i === 0 ? {} : null, position: { x: i, y: 1, z: 2 }, quaternion: { x: 0, y: 0, z: 0, w: 1 } }));
  }),
  clearDice: vi.fn((table) => { table.bodies = []; }),
  step: vi.fn(),
  restingFaces: vi.fn(() => null),
  rollTypes: vi.fn((count, sides) => Array.from({ length: count }, () => `d${sides}`)),
  rollValues: vi.fn((sides, faces) => faces.map((face) => face.value)),
  addObstacle: vi.fn(),
  clearObstacles: vi.fn(),
}));
vi.mock('../src/dice3d/physics.js', () => physics);

const matModule = vi.hoisted(() => ({ createMat: vi.fn(() => ({})), dressMat: vi.fn(async () => true) }));
vi.mock('../src/dice3d/mat.js', () => matModule);

const tower = vi.hoisted(() => ({
  towerInfo: vi.fn((id) => (id === 'none' ? null : { height: 12, collider: { id } })),
  loadTower: vi.fn(async () => new (await import('three')).Group()),
  placeTower: vi.fn(() => ({ x: 6, z: -4, turn: 0.5, reach: 3, exit: { x: 6, z: -1 } })),
  standTower: vi.fn(),
  startDrop: vi.fn(() => ({ dropping: true })),
  animateDrop: vi.fn(() => true),
}));
vi.mock('../src/dice3d/tower.js', () => tower);

const BASE = { id: 'base', mass: 1, restitution: 0.35 };
const ONYX = { id: 'onyx', mass: 1, restitution: 0.35 };
const UPLOADED = { id: 'a1b2', custom: true, mass: 1, restitution: 0.35 };

let table;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
  fakes.renderers.length = 0;
  fakes.loads.length = 0;
  fakes.observers.length = 0;
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback) { this.callback = callback; this.observed = []; fakes.observers.push(this); }
    observe(element) { this.observed.push(element); }
    disconnect() { this.observed = []; }
  });
  physics.restingFaces.mockImplementation(() => null);
  vi.clearAllMocks();
  document.body.innerHTML = '';
  vi.resetModules();
  table = await import('../src/dice3d/table.js');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function frames(count = 1) {
  for (let i = 0; i < count; i++) await vi.advanceTimersByTimeAsync(16);
}

function restAfter(calls, faces) {
  let seen = 0;
  physics.restingFaces.mockImplementation(() => (++seen > calls ? faces : null));
}

function sizedContainer(width, height) {
  const container = document.createElement('div');
  Object.defineProperty(container, 'clientWidth', { value: width });
  Object.defineProperty(container, 'clientHeight', { value: height });
  document.body.append(container);
  return container;
}

describe('the model loader', () => {
  it('decodes Draco-compressed models', () => {
    expect(fakes.draco).toBeInstanceOf(DRACOLoader);
  });
});

describe('the window table', () => {
  it('is made once, fills the window and follows a resize', async () => {
    await table.prepareTable(BASE);
    await table.prepareTable(BASE);
    expect(document.querySelectorAll('canvas.dice-table.faded')).toHaveLength(1);
    expect(fakes.loads).toEqual(['/dice/base.glb']);
    const [renderer] = fakes.renderers;
    expect(renderer.sizes[0]).toEqual([window.innerWidth, window.innerHeight]);
    expect(renderer.initialized.length).toBeGreaterThan(0);
    expect(renderer.initialized.every((texture) => texture.anisotropy === 8)).toBe(true);
    const perUnit = Math.min(42, window.innerWidth / 11);
    expect(physics.setBounds).toHaveBeenLastCalledWith(expect.anything(), window.innerWidth / perUnit / 2, window.innerHeight / perUnit / 2);

    vi.stubGlobal('innerWidth', 330);
    window.dispatchEvent(new Event('resize'));
    expect(physics.setBounds).toHaveBeenLastCalledWith(expect.anything(), 5.5, window.innerHeight / 30 / 2);
    expect(renderer.renders).toBe(1);
  });

  it('resolves a roll with the dice once they rest, then fades and clears the dice', async () => {
    restAfter(2, [{ value: 5 }, { value: 3 }]);
    const rolled = table.rollOnTable(2, 6, BASE);
    await frames(4);
    await expect(rolled).resolves.toEqual([5, 3]);
    const canvas = document.querySelector('canvas.dice-table');
    expect(canvas.classList.contains('faded')).toBe(false);
    expect(physics.throwDice).toHaveBeenCalledWith(expect.anything(), [
      expect.objectContaining({ type: 'd6' }), expect.objectContaining({ type: 'd6' }),
    ], expect.anything(), { wide: true });
    expect(physics.step).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5000);
    expect(canvas.classList.contains('faded')).toBe(true);
    physics.clearDice.mockClear();
    await vi.advanceTimersByTimeAsync(1000);
    expect(physics.clearDice).toHaveBeenCalled();
  });

  it('shares a downloaded dice set with the mat, which warms up its own see-through copy', async () => {
    await table.prepareTable(BASE);
    await table.prepareMat(BASE);
    expect(fakes.loads).toEqual(['/dice/base.glb']);
    expect(fakes.renderers).toHaveLength(2);
    expect(fakes.renderers[1].initialized.length).toBeGreaterThan(0);
  });

  it('fetches an uploaded set from the server', async () => {
    await table.prepareTable(UPLOADED);
    expect(fakes.loads).toEqual(['/api/dice/a1b2.glb']);
  });

  it('gives a roll that is replaced while still rolling a result of null', async () => {
    const first = table.rollOnTable(1, 20, BASE);
    await frames(2);
    const second = table.rollOnTable(1, 4, BASE);
    await expect(first).resolves.toBeNull();
    restAfter(0, [{ value: 2 }]);
    await frames(3);
    await expect(second).resolves.toEqual([2]);
  });

  it('gives a roll replaced before its dice set loads a result of null', async () => {
    const first = table.rollOnTable(1, 6, BASE);
    const second = table.rollOnTable(1, 6, ONYX);
    await expect(first).resolves.toBeNull();
    restAfter(0, [{ value: 6 }]);
    await frames(3);
    await expect(second).resolves.toEqual([6]);
  });
});

describe('the dice mat', () => {
  it('fills its container, follows resizes, and leaves cleanly', async () => {
    const container = sizedContainer(800, 500);
    const unmount = table.mountMat(container);
    const [renderer] = fakes.renderers;
    expect(container.querySelector('canvas.mat-canvas')).not.toBeNull();
    expect(renderer.sizes).toEqual([[800, 500, false]]);
    const [observer] = fakes.observers;
    expect(observer.observed).toEqual([container]);
    observer.callback();
    expect(renderer.sizes).toHaveLength(2);

    unmount();
    expect(container.querySelector('canvas')).toBeNull();
    expect(observer.observed).toEqual([]);
  });

  it('waits for a container with a size before sizing to it', () => {
    table.mountMat(sizedContainer(0, 0));
    expect(fakes.renderers[0].sizes).toEqual([]);
  });

  it('rolls with see-through copies of the dice and fades just the dice', async () => {
    table.mountMat(sizedContainer(800, 500));
    await table.prepareMat(BASE);
    restAfter(0, [{ value: 1 }]);
    const rolled = table.rollOnMat(1, 6, BASE);
    await frames(3);
    await expect(rolled).resolves.toEqual([1]);
    expect(document.querySelector('canvas.mat-canvas').classList.contains('faded')).toBe(false);
    expect(physics.throwDice).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(), { wide: true });

    physics.clearDice.mockClear();
    await vi.advanceTimersByTimeAsync(5000);
    await frames(70);
    expect(physics.clearDice).toHaveBeenCalled();
  });

  it('leaves mid-roll by ending the roll and standing the tower back up', async () => {
    const unmount = table.mountMat(sizedContainer(800, 500));
    await table.setTower('wooden');
    const rolled = table.rollOnMat(1, 6, BASE);
    await frames(1);
    unmount();
    await expect(rolled).resolves.toBeNull();
    expect(tower.standTower).toHaveBeenCalledTimes(2);
  });

  it('dresses the mat and draws it only when something changed', async () => {
    table.mountMat(sizedContainer(800, 500));
    const renderer = fakes.renderers[0];
    const before = renderer.renders;
    await table.setMat({ cloth: 'green' });
    expect(renderer.renders).toBe(before + 1);
    matModule.dressMat.mockResolvedValueOnce(false);
    await table.setMat({ cloth: 'green' });
    expect(renderer.renders).toBe(before + 1);
    expect(matModule.dressMat).toHaveBeenLastCalledWith(expect.anything(), { cloth: 'green' }, expect.any(Function), 8);
    const loadModel = matModule.dressMat.mock.calls[0][2];
    await loadModel('/models/mat.glb');
    expect(fakes.loads).toContain('/models/mat.glb');
  });
});

describe('the dice tower', () => {
  it('stands on the mat as an obstacle, and goes away for none', async () => {
    table.mountMat(sizedContainer(800, 500));
    await table.setTower('wooden');
    expect(tower.loadTower).toHaveBeenCalledWith('wooden', expect.any(Function));
    expect(physics.addObstacle).toHaveBeenCalledWith(expect.anything(), { id: 'wooden' }, 6, -4, 0.5);
    expect(tower.standTower).toHaveBeenCalledTimes(1);

    await table.setTower('none');
    expect(physics.clearObstacles).toHaveBeenCalledTimes(2);
    expect(physics.addObstacle).toHaveBeenCalledTimes(1);
  });

  it('eases the camera out to take in a tower, the same for every tower, and back in without one', async () => {
    table.mountMat(sizedContainer(800, 500));
    const [renderer] = fakes.renderers;
    await table.setTower('none');
    const bare = renderer.camera.position.clone();

    await table.setTower('wooden');
    expect(renderer.camera.position.distanceTo(bare)).toBe(0);
    await frames(10);
    const halfway = renderer.camera.position.clone();
    await frames(30);
    const tall = renderer.camera.position.clone();
    expect(tall.y).toBeGreaterThan(halfway.y);
    expect(halfway.y).toBeGreaterThan(bare.y);

    await table.setTower('stone');
    await frames(40);
    expect(renderer.camera.position.distanceTo(tall)).toBeCloseTo(0);
    await table.setTower('none');
    await frames(40);
    expect(renderer.camera.position.distanceTo(bare)).toBeCloseTo(0);
  });

  it('jumps to the new framing when the mat is resized mid-zoom', async () => {
    table.mountMat(sizedContainer(800, 500));
    const [renderer] = fakes.renderers;
    const bare = renderer.camera.position.clone();
    await table.setTower('wooden');
    await frames(5);
    fakes.observers[0].callback();
    const snapped = renderer.camera.position.clone();
    const renders = renderer.renders;
    await frames(10);
    expect(renderer.renders).toBe(renders);
    expect(renderer.camera.position.distanceTo(snapped)).toBe(0);
    expect(snapped.y).toBeGreaterThan(bare.y);
  });

  it('keeps only the tower picked last when an earlier one loads late', async () => {
    let finishSlow;
    tower.loadTower.mockImplementationOnce(() => new Promise((resolve) => { finishSlow = resolve; }));
    const slow = table.setTower('slow');
    await table.setTower('none');
    finishSlow(new THREE.Group());
    await slow;
    expect(physics.addObstacle).not.toHaveBeenCalled();
  });

  it('drops the dice through the tower before they are thrown out of it', async () => {
    table.mountMat(sizedContainer(800, 500));
    await table.setTower('wooden');
    tower.animateDrop.mockReturnValueOnce(false).mockReturnValueOnce(true);
    restAfter(0, [{ value: 4 }]);
    const rolled = table.rollOnMat(2, 6, BASE);
    await frames(1);
    expect(tower.startDrop).toHaveBeenCalledWith(expect.objectContaining({ x: 6, z: -4 }), 2);
    expect(physics.throwDice).not.toHaveBeenCalled();
    await frames(4);
    expect(physics.throwDice).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.anything(),
      { wide: true, exit: { x: 6, z: -1 } });
    await expect(rolled).resolves.toEqual([4]);
  });
});
