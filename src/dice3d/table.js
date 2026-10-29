import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import diceData from "./dice.json";
import { createTable, setBounds, throwDice, clearDice, step, restingFaces, rollTypes, rollValues } from "./physics.js";

const CAMERA_HEIGHT = 60;
const MAX_PIXELS_PER_UNIT = 42;
const FADE_DELAY_MS = 5000;
const FADE_MS = 1000;
const DESKTOP_LAYOUT = window.matchMedia("(min-width: 900px)");

const loader = new GLTFLoader();
const diceSets = new Map();
let view = null;
let current = null;

function createView() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.domElement.className = "dice-table faded";
  renderer.domElement.setAttribute("aria-hidden", "true");
  document.body.append(renderer.domElement);

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.45;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8a8a, 0.6));

  const light = new THREE.DirectionalLight(0xffffff, 1.1);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.radius = 3;
  scene.add(light, light.target);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShadowMaterial({ opacity: 0.3 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const camera = new THREE.PerspectiveCamera(30, 1, 1, CAMERA_HEIGHT * 2);
  camera.position.set(0, CAMERA_HEIGHT, 0);
  camera.up.set(0, 0, -1);
  camera.lookAt(0, 0, 0);

  const created = { renderer, scene, camera, light, floor, table: createTable(), meshes: [] };
  resize(created);
  window.addEventListener("resize", () => {
    resize(created);
    renderer.render(scene, camera);
  });
  return created;
}

// The camera looks straight down, sized so the floor exactly fills the window.
function resize({ renderer, camera, light, floor, table }) {
  const { innerWidth: width, innerHeight: height } = window;
  const pixelsPerUnit = Math.min(MAX_PIXELS_PER_UNIT, width / 11);
  const halfWidth = width / pixelsPerUnit / 2;
  const halfDepth = height / pixelsPerUnit / 2;
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(halfDepth / CAMERA_HEIGHT));
  camera.updateProjectionMatrix();
  setBounds(table, halfWidth, halfDepth);
  floor.scale.set(halfWidth * 2, halfDepth * 2, 1);
  light.position.set(-halfWidth * 0.4, 40, -halfDepth * 0.6);
  const shadowReach = Math.max(halfWidth, halfDepth) * 1.2;
  Object.assign(light.shadow.camera, { left: -shadowReach, right: shadowReach, top: shadowReach, bottom: -shadowReach, far: 100 });
  light.shadow.camera.updateProjectionMatrix();
}

function prepareSet(gltf) {
  gltf.scene.traverse((node) => {
    node.castShadow = node.isMesh;
  });
  return gltf.scene;
}

// Uploads a set's textures and compiles its shaders ahead of time, so the first roll with it does not stall.
async function warmUp(diceSet) {
  diceSet.traverse((node) => {
    if (!node.isMesh) return;
    Object.values(node.material)
      .filter((value) => value?.isTexture)
      .forEach((texture) => view.renderer.initTexture(texture));
  });
  await view.renderer.compileAsync(diceSet, view.camera, view.scene);
  return diceSet;
}

function loadSet(setId) {
  if (!diceSets.has(setId)) {
    const loading = loader.loadAsync(`${import.meta.env.BASE_URL}dice/${setId}.glb`);
    diceSets.set(setId, loading.then(prepareSet).then(warmUp));
  }
  return diceSets.get(setId);
}

// Gets the table and a dice set ready before the first roll. Safe to call again; work is only done once.
export function prepareTable(setId) {
  view ??= createView();
  return loadSet(setId);
}

function removeDice() {
  view.meshes.forEach((mesh) => view.scene.remove(mesh));
  view.meshes = [];
  clearDice(view.table);
}

function endRoll(faces) {
  cancelAnimationFrame(current.frame);
  clearTimeout(current.fadeTimer);
  clearTimeout(current.clearTimer);
  current.resolve(faces);
}

function animate(time) {
  const seconds = Math.min((time - current.lastTime) / 1000, 0.05);
  current.lastTime = time;
  step(view.table, seconds);
  view.table.bodies.forEach((body, i) => {
    view.meshes[i].position.copy(body.position);
    view.meshes[i].quaternion.copy(body.quaternion);
  });
  view.renderer.render(view.scene, view.camera);

  const faces = restingFaces(view.table);
  if (!faces) {
    current.frame = requestAnimationFrame(animate);
    return;
  }
  const roll = current;
  roll.resolve(rollValues(roll.sides, faces));
  roll.fadeTimer = setTimeout(() => view.renderer.domElement.classList.add("faded"), FADE_DELAY_MS);
  roll.clearTimer = setTimeout(() => {
    removeDice();
    view.renderer.render(view.scene, view.camera);
  }, FADE_DELAY_MS + FADE_MS);
}

// Throws the dice across the window and resolves with each die's value once they stop.
// Resolves with null if another roll replaces this one first.
export async function rollOnTable(count, sides, setId) {
  if (current) endRoll(null);
  const roll = { sides };
  const done = new Promise((resolve) => (roll.resolve = resolve));
  current = roll;

  const diceSet = await prepareTable(setId);
  if (current !== roll) return done;
  removeDice();
  const types = rollTypes(count, sides);
  view.meshes = types.map((type) => {
    const mesh = diceSet.getObjectByName(type).clone();
    view.scene.add(mesh);
    return mesh;
  });
  throwDice(
    view.table,
    types.map((type) => ({ type, shape: diceData.dice[type] })),
    diceData.sets.find((set) => set.id === setId),
    DESKTOP_LAYOUT.matches,
  );
  view.renderer.domElement.classList.remove("faded");
  roll.lastTime = performance.now();
  roll.frame = requestAnimationFrame(animate);
  return done;
}
