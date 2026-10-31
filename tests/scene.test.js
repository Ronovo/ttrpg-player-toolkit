import * as THREE from 'three';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import props from '../src/dice3d/props.json';
import { animateDrop, loadTower, placeTower, standTower, startDrop, towerInfo } from '../src/dice3d/tower.js';
import { createMat, dressMat } from '../src/dice3d/mat.js';

afterEach(() => {
  vi.restoreAllMocks();
});

function model() {
  const scene = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial());
  scene.add(mesh);
  return { gltf: { scene }, mesh };
}

describe('dice towers', () => {
  it('looks up a tower by id', () => {
    expect(towerInfo('castle-keep').label).toBe('Castle Keep');
    expect(towerInfo('no-such-tower')).toBeNull();
  });

  it('loads each tower model once, with shadows on its meshes', async () => {
    const { gltf, mesh } = model();
    const loadModel = vi.fn(async () => gltf);
    const first = await loadTower('watchtower', loadModel);
    expect(await loadTower('watchtower', loadModel)).toBe(first);
    expect(loadModel).toHaveBeenCalledOnce();
    expect(loadModel).toHaveBeenCalledWith('/towers/watchtower.glb');
    expect([mesh.castShadow, mesh.receiveShadow, Boolean(first.castShadow)]).toEqual([true, true, false]);
  });

  it.each(props.towers.map((tower) => [tower.id, tower]))('stands the %s in the back-left corner with its door to the middle',
    (_, tower) => {
      const placed = placeTower(tower);
      expect(placed.x).toBeLessThan(0);
      expect(placed.z).toBeLessThan(0);
      const toMiddle = new THREE.Vector2(-placed.x, -placed.z).normalize();
      const door = new THREE.Vector2(Math.cos(placed.exit.heading), Math.sin(placed.exit.heading));
      expect(door.dot(toMiddle)).toBeCloseTo(1);
      expect(placed.reach).toBe(tower.collider.shape === 'box'
        ? Math.max(tower.collider.halfWidth, tower.collider.halfDepth) : tower.collider.radius);
    });

  it('stands the model where it was placed', () => {
    const tower = { ...placeTower(towerInfo('clockwork')), model: new THREE.Group() };
    standTower(tower);
    expect([tower.model.position.x, tower.model.position.z, tower.model.rotation.y]).toEqual([tower.x, tower.z, tower.turn]);
  });

  function dropping(count) {
    const info = towerInfo('wizard-spire');
    const tower = { ...placeTower(info), info, model: new THREE.Group() };
    const paths = startDrop(tower, count);
    const meshes = Array.from({ length: count }, () => new THREE.Object3D());
    return { tower, paths, meshes };
  }

  it('starts each die above the tower top, on the camera side', () => {
    const { tower, paths } = dropping(3);
    expect(paths).toHaveLength(3);
    for (const path of paths) {
      expect(path.from.y).toBeCloseTo(tower.entry.y + tower.info.approach.rise);
      expect(path.arc).toBeCloseTo(tower.info.approach.rise * 0.4);
    }
  });

  it('drops the dice in one after another, shrinking into the opening, then rattles the tower', () => {
    const { tower, paths, meshes } = dropping(2);
    expect(animateDrop(tower, meshes, paths, 0)).toBe(false);
    expect(meshes.map((mesh) => mesh.visible)).toEqual([true, false]);
    expect(meshes[0].position.distanceTo(paths[0].from)).toBeCloseTo(0);
    animateDrop(tower, meshes, paths, 420);
    expect(meshes[0].scale.x).toBeLessThan(1);
    expect(meshes[1].scale.x).toBe(1);
    animateDrop(tower, meshes, paths, 700);
    expect(meshes.map((mesh) => mesh.visible)).toEqual([false, false]);
    expect(tower.model.position.distanceTo(new THREE.Vector3(tower.x, 0, tower.z))).toBeGreaterThan(0);
    expect(animateDrop(tower, meshes, paths, 80 + 550 + 800)).toBe(true);
    expect(tower.model.position.distanceTo(new THREE.Vector3(tower.x, 0, tower.z))).toBe(0);
  });
});

describe('the roll mat', () => {
  let textures;

  beforeEach(() => {
    textures = new Map();
    vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockImplementation(async (url) => {
      const texture = new THREE.Texture();
      texture.image = { width: 2000, height: 1000 };
      texture.dispose = vi.fn();
      textures.set(url, texture);
      return texture;
    });
  });

  it('lays a flat floor in the scene', () => {
    const scene = new THREE.Scene();
    const mat = createMat(scene);
    const [floor] = scene.children;
    expect([floor.rotation.x, floor.receiveShadow, mat.rim, mat.version]).toEqual([-Math.PI / 2, true, null, 0]);
  });

  it('dresses the mat in a surface, a colour and a rim', async () => {
    const scene = new THREE.Scene();
    const mat = createMat(scene);
    const { gltf, mesh } = model();
    const loadModel = vi.fn(async () => gltf);
    const velvet = props.surfaces.find((s) => s.id === 'velvet');
    expect(await dressMat(mat, { surface: 'velvet', color: '#112233', image: '', rim: 'wood' }, loadModel, 8)).toBe(true);
    expect(mat.material.map).toBe(textures.get('/mats/velvet-color.webp'));
    expect(mat.material.normalMap).toBe(textures.get('/mats/velvet-normal.webp'));
    expect(mat.material.map.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(mat.material.normalMap.colorSpace).toBe(THREE.NoColorSpace);
    expect([mat.material.map.anisotropy, mat.material.roughness, mat.material.sheen]).toEqual([8, velvet.roughness, velvet.sheen]);
    expect(mat.material.color.getHexString()).toBe('112233');
    expect(loadModel).toHaveBeenCalledWith('/mats/rim-wood.glb');
    expect(mat.rim).toBe(gltf.scene);
    expect(scene.children).toContain(gltf.scene);
    expect(mesh.castShadow).toBe(true);

    await dressMat(mat, { surface: 'velvet', color: '#112233', image: '', rim: 'none' }, loadModel, 8);
    expect(mat.rim).toBeNull();
    expect(scene.children).not.toContain(gltf.scene);

    await dressMat(mat, { surface: 'velvet', color: '#112233', image: '', rim: 'wood' }, loadModel, 8);
    expect(mat.rim).toBe(gltf.scene);
    expect(loadModel).toHaveBeenCalledTimes(1);
  });

  it('falls back to the first surface for one it does not know', async () => {
    const mat = createMat(new THREE.Scene());
    await dressMat(mat, { surface: 'lava', color: '#ffffff', image: '', rim: 'none' }, vi.fn(), 1);
    expect(mat.material.map).toBe(textures.get(`/mats/${props.surfaces[0].id}-color.webp`));
  });

  it('crops an uploaded picture to cover the mat, white-lit and without sheen', async () => {
    const mat = createMat(new THREE.Scene());
    await dressMat(mat, { surface: 'felt', color: '#123456', image: 'data:wide', rim: 'none' }, vi.fn(), 4);
    const picture = textures.get('data:wide');
    expect(mat.material.map).toBe(picture);
    expect(mat.material.normalMap).toBeNull();
    expect([mat.material.sheen, mat.material.color.getHexString()]).toEqual([0, 'ffffff']);
    const matAspect = props.mat.width / props.mat.depth;
    expect(picture.repeat.x).toBeCloseTo(Math.min(1, matAspect / 2));
    expect(picture.repeat.y).toBeCloseTo(Math.min(1, 2 / matAspect));
    expect(picture.offset.x).toBeCloseTo((1 - picture.repeat.x) / 2);
  });

  it('keeps the same uploaded picture and frees the old one when it changes', async () => {
    const mat = createMat(new THREE.Scene());
    const settings = { surface: 'felt', color: '#123456', rim: 'none' };
    await dressMat(mat, { ...settings, image: 'data:one' }, vi.fn(), 1);
    await dressMat(mat, { ...settings, image: 'data:one' }, vi.fn(), 1);
    expect(THREE.TextureLoader.prototype.loadAsync.mock.calls.filter(([url]) => url === 'data:one')).toHaveLength(1);
    await dressMat(mat, { ...settings, image: 'data:two' }, vi.fn(), 1);
    await Promise.resolve();
    expect(textures.get('data:one').dispose).toHaveBeenCalled();
  });

  it('ignores an older dressing that finishes after a newer one', async () => {
    const mat = createMat(new THREE.Scene());
    let finishRim;
    const slowRim = vi.fn(() => new Promise((resolve) => { finishRim = resolve; }));
    const older = dressMat(mat, { surface: 'stone', color: '#000000', image: '', rim: 'leather' }, slowRim, 1);
    expect(await dressMat(mat, { surface: 'wood', color: '#ffffff', image: '', rim: 'none' }, vi.fn(), 1)).toBe(true);
    finishRim(model().gltf);
    expect(await older).toBe(false);
    expect(mat.material.map).toBe(textures.get('/mats/wood-color.webp'));
  });
});
