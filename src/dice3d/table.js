import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import diceData from "./dice.json";
import props from "./props.json";
import { modelUrl } from "../lib/diceSets.js";
import {
  createTable, setBounds, throwDice, clearDice, step, restingFaces, rollTypes, rollValues, addObstacle, clearObstacles,
} from "./physics.js";
import { createMat, dressMat } from "./mat.js";
import { animateDrop, loadTower, placeTower, standTower, startDrop, towerInfo } from "./tower.js";

const CAMERA_HEIGHT = 60;
const MAX_PIXELS_PER_UNIT = 42;
const FADE_DELAY_MS = 5000;
const FADE_MS = 1000;
const MAT_FOV = 32;
const MAT_ELEVATION = THREE.MathUtils.degToRad(55);
const MAT_VIEW = new THREE.Vector3(0, Math.sin(MAT_ELEVATION), Math.cos(MAT_ELEVATION));
const AIM_LIMIT = Math.max(...props.towers.map((tower) => tower.height)) * 0.6;
const ZOOM_MS = 500;
const DESKTOP_LAYOUT = window.matchMedia("(min-width: 900px)");

const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader());
const loadModel = (url) => loader.loadAsync(url);
const diceSets = new Map();
// "overlay" throws dice across the whole window; "mat" rolls them on the Dice Roller tab's mat.
let overlay = null;
let mat = null;

function createView() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.domElement.setAttribute("aria-hidden", "true");

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.85;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 0.35));

  const light = new THREE.DirectionalLight(0xfff1dc, 1.2);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.radius = 6;
  scene.add(light, light.target);

  const rimLight = new THREE.DirectionalLight(0xc4d6ff, 0.55);
  scene.add(rimLight, rimLight.target);

  return { renderer, scene, light, rimLight, camera: null, table: createTable(), meshes: [], sets: new Map(), roll: null };
}

// The key light comes in from `front`'s side of z: behind the dice for the top-down window table, and from the
// camera's side on the mat so the tower's face and door are lit and its shadow falls back across the mat.
function aimLights({ light, rimLight }, halfWidth, halfDepth, front = -1) {
  light.position.set(-halfWidth * 0.4, 40, front * halfDepth * 0.6);
  rimLight.position.set(halfWidth * 0.6, 12, -front * halfDepth * 0.8);
  const shadowReach = Math.max(halfWidth, halfDepth) * 1.2;
  Object.assign(light.shadow.camera, { left: -shadowReach, right: shadowReach, top: shadowReach, bottom: -shadowReach, far: 100 });
  light.shadow.camera.updateProjectionMatrix();
}

function render(view) {
  view.renderer.render(view.scene, view.camera);
}

// A see-through floor that only shows the shadows falling on it, one unit square until scaled.
function shadowFloor() {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.28 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  return floor;
}

function createOverlay() {
  const view = createView();
  view.renderer.domElement.className = "dice-table faded";
  document.body.append(view.renderer.domElement);
  view.floor = shadowFloor();
  view.scene.add(view.floor);
  view.camera = new THREE.PerspectiveCamera(30, 1, 1, CAMERA_HEIGHT * 2);
  view.camera.position.set(0, CAMERA_HEIGHT, 0);
  view.camera.up.set(0, 0, -1);
  view.camera.lookAt(0, 0, 0);
  resizeOverlay(view);
  window.addEventListener("resize", () => {
    resizeOverlay(view);
    render(view);
  });
  return view;
}

// The camera looks straight down, sized so the floor exactly fills the window.
function resizeOverlay(view) {
  const { innerWidth: width, innerHeight: height } = window;
  const pixelsPerUnit = Math.min(MAX_PIXELS_PER_UNIT, width / 11);
  const halfWidth = width / pixelsPerUnit / 2;
  const halfDepth = height / pixelsPerUnit / 2;
  view.renderer.setSize(width, height);
  view.camera.aspect = width / height;
  view.camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(halfDepth / CAMERA_HEIGHT));
  view.camera.updateProjectionMatrix();
  setBounds(view.table, halfWidth, halfDepth);
  view.floor.scale.set(halfWidth * 2, halfDepth * 2, 1);
  aimLights(view, halfWidth, halfDepth);
}

function createMatView() {
  const view = createView();
  const { width, depth } = props.mat;
  view.renderer.domElement.className = "mat-canvas";
  setBounds(view.table, width / 2, depth / 2);
  aimLights(view, width / 2, depth / 2, 1);
  view.camera = new THREE.PerspectiveCamera(MAT_FOV, 16 / 10, 1, 400);
  view.mat = createMat(view.scene);
  const ground = shadowFloor();
  ground.scale.set(width * 4, depth * 4, 1);
  ground.position.y = -0.01;
  view.scene.add(ground);
  view.tower = null;
  view.observer = new ResizeObserver(() => {
    resizeMat(view);
    render(view);
  });
  return view;
}

function resizeMat(view) {
  const container = view.renderer.domElement.parentElement;
  if (!container?.clientWidth || !container.clientHeight) return;
  view.renderer.setSize(container.clientWidth, container.clientHeight, false);
  view.camera.aspect = container.clientWidth / container.clientHeight;
  frameMat(view);
}

function placeCamera(camera, { target, distance }) {
  camera.position.copy(target).addScaledVector(MAT_VIEW, distance);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
}

// Where the camera goes along MAT_VIEW: as close as it can get with the mat, its rim and the standing tower in
// view. It tries aiming at a few heights above the mat, since a tall tower pushes the picture upward and even the
// bare mat fits closer aimed a little above it. Returns the point it aims at and its distance from that point.
function matFraming({ camera, tower }) {
  const { width, depth, rimWidth } = props.mat;
  const halfWidth = width / 2 + rimWidth;
  const halfDepth = depth / 2 + rimWidth;
  const points = [[-halfWidth, -halfDepth], [halfWidth, -halfDepth], [-halfWidth, halfDepth], [halfWidth, halfDepth]]
    .map(([x, z]) => new THREE.Vector3(x, 0, z));
  if (tower) {
    points.push(new THREE.Vector3(tower.x, tower.info.height, tower.z));
    points.push(new THREE.Vector3(tower.x, tower.info.height, tower.z - tower.reach));
  }
  const fits = (point) => {
    const { x, y } = point.clone().project(camera);
    return Math.abs(x) <= 0.96 && Math.abs(y) <= 0.96;
  };
  const closest = (target) => {
    let near = 5;
    let far = 400;
    for (let i = 0; i < 30; i++) {
      const distance = (near + far) / 2;
      placeCamera(camera, { target, distance });
      if (points.every(fits)) far = distance;
      else near = distance;
    }
    return far;
  };
  let best = null;
  for (let height = 0; height <= AIM_LIMIT; height += 0.5) {
    const target = new THREE.Vector3(0, height, 0);
    const distance = closest(target);
    if (!best || distance < best.distance) best = { target, distance };
  }
  return best;
}

function frameMat(view) {
  cancelAnimationFrame(view.zoom);
  view.framing = matFraming(view);
  placeCamera(view.camera, view.framing);
}

// Eases the camera from its framing to the one for what now stands on the mat.
function zoomMat(view) {
  const from = view.framing;
  if (!from) {
    frameMat(view);
    return;
  }
  cancelAnimationFrame(view.zoom);
  const to = matFraming(view);
  view.framing = to;
  placeCamera(view.camera, from);
  const start = performance.now();
  const frame = (time) => {
    const t = Math.min((time - start) / ZOOM_MS, 1);
    const eased = t * t * (3 - 2 * t);
    placeCamera(view.camera, {
      target: from.target.clone().lerp(to.target, eased),
      distance: from.distance + (to.distance - from.distance) * eased,
    });
    render(view);
    if (t < 1) view.zoom = requestAnimationFrame(frame);
  };
  view.zoom = requestAnimationFrame(frame);
}

function prepareSet(gltf) {
  gltf.scene.traverse((node) => {
    node.castShadow = node.isMesh;
  });
  return gltf.scene;
}

function fetchSet(set) {
  if (!diceSets.has(set.id)) {
    diceSets.set(set.id, loader.loadAsync(modelUrl(set)).then(prepareSet));
  }
  return diceSets.get(set.id);
}

// The mat fades its dice out by their opacity, so it rolls a copy of the set with see-through materials.
// Each roll shares that copy's materials, which is why they fade together.
function fadeable(diceSet) {
  const copy = diceSet.clone();
  copy.traverse((node) => {
    if (node.isMesh) node.material = Object.assign(node.material.clone(), { transparent: true });
  });
  return copy;
}

// Uploads a set's textures and compiles its shaders ahead of time, so the first roll with it does not stall.
async function warmUp(view, diceSet) {
  const anisotropy = view.renderer.capabilities.getMaxAnisotropy();
  diceSet.traverse((node) => {
    if (!node.isMesh) return;
    Object.values(node.material)
      .filter((value) => value?.isTexture)
      .forEach((texture) => {
        texture.anisotropy = anisotropy;
        view.renderer.initTexture(texture);
      });
  });
  await view.renderer.compileAsync(diceSet, view.camera, view.scene);
  return diceSet;
}

// Each view loads a set once and keeps its own warmed-up copy. `set` is an entry of dice.json's sets, or an
// uploaded set.
function loadSet(view, set) {
  if (!view.sets.has(set.id)) {
    const shared = fetchSet(set);
    view.sets.set(set.id, (view.mat ? shared.then(fadeable) : shared).then((diceSet) => warmUp(view, diceSet)));
  }
  return view.sets.get(set.id);
}

// Gets the window table and a dice set ready before the first roll. Safe to call again; work is only done once.
export function prepareTable(set) {
  overlay ??= createOverlay();
  return loadSet(overlay, set);
}

export function prepareMat(set) {
  mat ??= createMatView();
  return loadSet(mat, set);
}

// Puts the mat's canvas in `container` and keeps it sized to it. Returns a function that takes it out again.
export function mountMat(container) {
  mat ??= createMatView();
  container.append(mat.renderer.domElement);
  mat.observer.observe(container);
  resizeMat(mat);
  render(mat);
  return () => {
    mat.observer.disconnect();
    if (mat.roll) endRoll(mat, null);
    removeDice(mat);
    if (mat.tower) standTower(mat.tower);
    mat.renderer.domElement.remove();
  };
}

export async function setMat(settings) {
  mat ??= createMatView();
  if (await dressMat(mat.mat, settings, loadModel, mat.renderer.capabilities.getMaxAnisotropy())) render(mat);
}

// Stands the tower with this id on the mat, or takes the tower away for "none".
export async function setTower(id) {
  mat ??= createMatView();
  mat.towerId = id;
  const info = towerInfo(id);
  const model = info && (await loadTower(id, loadModel));
  if (mat.towerId !== id) return;
  if (mat.tower) mat.scene.remove(mat.tower.model);
  clearObstacles(mat.table);
  mat.tower = null;
  if (info) {
    const placed = placeTower(info);
    mat.tower = { ...placed, info, model };
    standTower(mat.tower);
    mat.scene.add(model);
    addObstacle(mat.table, info.collider, placed.x, placed.z, placed.turn);
  }
  zoomMat(mat);
  render(mat);
}

function diceMaterials(view) {
  const materials = new Set();
  view.meshes.forEach((mesh) => mesh.traverse((node) => node.isMesh && materials.add(node.material)));
  return [...materials];
}

function removeDice(view) {
  view.meshes.forEach((mesh) => view.scene.remove(mesh));
  view.meshes = [];
  clearDice(view.table);
}

function endRoll(view, faces) {
  const { roll } = view;
  cancelAnimationFrame(roll.frame);
  clearTimeout(roll.fadeTimer);
  clearTimeout(roll.clearTimer);
  roll.resolve(faces);
}

// The window table fades its whole canvas; the mat fades only the dice, so the mat and tower stay.
function fadeOut(view, roll) {
  if (!view.mat) {
    view.renderer.domElement.classList.add("faded");
    roll.clearTimer = setTimeout(() => {
      removeDice(view);
      render(view);
    }, FADE_MS);
    return;
  }
  const materials = diceMaterials(view);
  const start = performance.now();
  const frame = (time) => {
    const opacity = Math.max(0, 1 - (time - start) / FADE_MS);
    materials.forEach((material) => (material.opacity = opacity));
    if (opacity === 0) removeDice(view);
    else roll.frame = requestAnimationFrame(frame);
    render(view);
  };
  roll.frame = requestAnimationFrame(frame);
}

function animate(view, time) {
  const { roll } = view;
  const seconds = Math.min((time - roll.lastTime) / 1000, 0.05);
  roll.lastTime = time;
  if (roll.drop) {
    if (animateDrop(roll.tower, view.meshes, roll.drop, time - roll.startTime)) {
      roll.drop = null;
      view.meshes.forEach((mesh) => mesh.scale.setScalar(1));
      roll.launch();
    }
  } else {
    step(view.table, seconds);
    view.table.bodies.forEach((body, i) => {
      view.meshes[i].visible = Boolean(body.world);
      view.meshes[i].position.copy(body.position);
      view.meshes[i].quaternion.copy(body.quaternion);
    });
  }
  render(view);

  const faces = !roll.drop && restingFaces(view.table);
  if (!faces) {
    roll.frame = requestAnimationFrame((next) => animate(view, next));
    return;
  }
  roll.resolve(rollValues(roll.sides, faces));
  roll.fadeTimer = setTimeout(() => fadeOut(view, roll), FADE_DELAY_MS);
}

// Throws the dice and resolves with each die's value once they stop, or with null if another roll
// replaces this one first. On the mat with a tower standing, the dice go through the tower.
async function rollIn(view, count, sides, set) {
  if (view.roll) endRoll(view, null);
  const roll = { sides, tower: view.tower ?? null };
  const done = new Promise((resolve) => (roll.resolve = resolve));
  view.roll = roll;

  const diceSet = await loadSet(view, set);
  if (view.roll !== roll) return done;
  removeDice(view);
  const types = rollTypes(count, sides);
  view.meshes = types.map((type) => {
    const mesh = diceSet.getObjectByName(type).clone();
    view.scene.add(mesh);
    return mesh;
  });
  diceMaterials(view).forEach((material) => (material.opacity = 1));
  const dice = types.map((type) => ({ type, shape: diceData.dice[type] }));
  if (roll.tower) {
    roll.drop = startDrop(roll.tower, view.meshes.length);
    roll.launch = () => throwDice(view.table, dice, set, { wide: true, exit: roll.tower.exit });
  } else {
    throwDice(view.table, dice, set, { wide: Boolean(view.mat) || DESKTOP_LAYOUT.matches });
  }
  view.renderer.domElement.classList.remove("faded");
  roll.lastTime = roll.startTime = performance.now();
  roll.frame = requestAnimationFrame((time) => animate(view, time));
  return done;
}

export async function rollOnTable(count, sides, set) {
  overlay ??= createOverlay();
  return rollIn(overlay, count, sides, set);
}

export async function rollOnMat(count, sides, set) {
  mat ??= createMatView();
  return rollIn(mat, count, sides, set);
}
