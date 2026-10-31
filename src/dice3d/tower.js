import * as THREE from "three";
import props from "./props.json";
import { randomFraction } from "../lib/random.js";

const DROP_MS = 550;
const DROP_STAGGER_MS = 80;
const RATTLE_MS = 800;
const RATTLE_SHIFT = 0.06;
const CORNER_GAP = 1.2;
const UP = new THREE.Vector3(0, 1, 0);
const models = new Map();

function between(min, max) {
  return min + randomFraction() * (max - min);
}

export function towerInfo(id) {
  return props.towers.find((tower) => tower.id === id) ?? null;
}

export function loadTower(id, loadModel) {
  if (!models.has(id)) {
    models.set(id, loadModel(`${import.meta.env.BASE_URL}towers/${id}.glb`).then((gltf) => {
      gltf.scene.traverse((node) => {
        node.castShadow = node.isMesh;
        node.receiveShadow = node.isMesh;
      });
      return gltf.scene;
    }));
  }
  return models.get(id);
}

// Every tower stands in the back-left corner of the mat with its door (+X in the model) turned toward the
// middle. Returns where it stands, how far it reaches out, how it is turned, where dice drop in and where
// they come out.
export function placeTower(info) {
  const { collider } = info;
  const reach = collider.shape === "box" ? Math.max(collider.halfWidth, collider.halfDepth) : collider.radius;
  const x = -props.mat.width / 2 + reach + CORNER_GAP;
  const z = -props.mat.depth / 2 + reach + CORNER_GAP;
  const turn = Math.atan2(z, -x);
  const toWorld = (point) => new THREE.Vector3(...point).applyAxisAngle(UP, turn).add(new THREE.Vector3(x, 0, z));
  const door = new THREE.Vector3(1, 0, 0).applyAxisAngle(UP, turn);
  const exit = toWorld(info.exit);
  return {
    x,
    z,
    reach,
    turn,
    entry: toWorld(info.entry),
    exit: { x: exit.x, z: exit.z, heading: Math.atan2(door.z, door.x) },
  };
}

export function standTower(tower) {
  tower.model.position.set(tower.x, 0, tower.z);
  tower.model.rotation.set(0, tower.turn, 0);
}

// Each die's arc into the top of the tower: it comes from the camera's side, a little above the opening.
export function startDrop(tower, count) {
  const { rise, distance } = tower.info.approach;
  return Array.from({ length: count }, () => ({
    from: tower.entry.clone().add(new THREE.Vector3(between(-1, 1), rise, distance + between(-0.5, 0.5))),
    spin: new THREE.Vector3(between(-12, 12), between(-12, 12), between(-12, 12)),
    arc: rise * 0.4,
  }));
}

// Moves the dice along their arcs, shrinking them into the opening, then rattles the tower.
// Returns true once the rattle is over and the dice should come out of the door.
export function animateDrop(tower, meshes, paths, elapsedMs) {
  meshes.forEach((mesh, i) => {
    const t = (elapsedMs - i * DROP_STAGGER_MS) / DROP_MS;
    mesh.visible = t >= 0 && t < 1;
    if (!mesh.visible) return;
    const { from, spin, arc } = paths[i];
    mesh.position.lerpVectors(from, tower.entry, t);
    mesh.position.y += Math.sin(t * Math.PI) * arc;
    mesh.rotation.set(spin.x * t, spin.y * t, spin.z * t);
    mesh.scale.setScalar(t > 0.7 ? 1 - (t - 0.7) * 1.4 : 1);
  });
  const rattle = elapsedMs - ((meshes.length - 1) * DROP_STAGGER_MS + DROP_MS);
  const shift = rattle > 0 && rattle < RATTLE_MS ? RATTLE_SHIFT * (1 - rattle / RATTLE_MS) : 0;
  tower.model.position.set(tower.x + between(-shift, shift), 0, tower.z + between(-shift, shift));
  tower.model.rotation.set(between(-shift, shift) * 0.15, tower.turn, between(-shift, shift) * 0.15);
  return rattle >= RATTLE_MS;
}
