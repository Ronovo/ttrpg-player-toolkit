import * as CANNON from "cannon-es";
import { randomFraction } from "../lib/random.js";

const GRAVITY = 50;
const SPACING = 2.8;
const STEP = 1 / 120;
const FLAT_ENOUGH = 0.97;
const STILL_SPEED = 0.35;
const STILL_SPIN = 0.6;
const SETTLE_SECONDS = 0.35;
const GIVE_UP_SECONDS = 10;
const MAX_NUDGES = 2;
const ROLL = { push: 1, spinBrake: 0.3 };
// Pointy dice catch on their corners and edges, so they need a harder throw and less spin braking.
const POINTY_ROLL = { push: 1.35, spinBrake: 0.15 };
const ROLLS = { d4: POINTY_ROLL, d8: POINTY_ROLL, d10: POINTY_ROLL, d100: POINTY_ROLL };
const polyhedrons = new Map();

function between(min, max) {
  return min + randomFraction() * (max - min);
}

function staticPlane(world, material) {
  const body = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane(), material });
  world.addBody(body);
  return body;
}

export function createTable() {
  const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -GRAVITY, 0), allowSleep: true });
  const dice = new CANNON.Material("dice");
  const floor = new CANNON.Material("floor");
  const wall = new CANNON.Material("wall");
  const landing = new CANNON.ContactMaterial(dice, floor, { friction: 0.3, restitution: 0.35 });
  world.addContactMaterial(landing);
  world.addContactMaterial(new CANNON.ContactMaterial(dice, wall, { friction: 0.05, restitution: 0.6 }));
  world.addContactMaterial(new CANNON.ContactMaterial(dice, dice, { friction: 0.1, restitution: 0.4 }));

  staticPlane(world, floor).quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  const walls = [Math.PI / 2, -Math.PI / 2, 0, Math.PI].map((turn) => {
    const body = staticPlane(world, wall);
    body.quaternion.setFromEuler(0, turn, 0);
    return body;
  });
  return { world, dice, landing, walls, bodies: [], halfWidth: 0, halfDepth: 0 };
}

export function setBounds(table, halfWidth, halfDepth) {
  const [left, right, back, front] = table.walls;
  left.position.set(-halfWidth, 0, 0);
  right.position.set(halfWidth, 0, 0);
  back.position.set(0, 0, -halfDepth);
  front.position.set(0, 0, halfDepth);
  table.halfWidth = halfWidth;
  table.halfDepth = halfDepth;
}

function polyhedron(shape) {
  if (!polyhedrons.has(shape)) {
    polyhedrons.set(shape, new CANNON.ConvexPolyhedron({
      vertices: shape.vertices.map(([x, y, z]) => new CANNON.Vec3(x, y, z)),
      faces: shape.faces,
    }));
  }
  return polyhedrons.get(shape);
}

export function clearDice(table) {
  table.bodies.forEach((body) => table.world.removeBody(body));
  table.bodies = [];
}

// Dice enter from the left edge in a grid, each with its own random push and spin.
// "dice" is a list of { type, shape }. Pointy dice only get their stronger roll on a wide table.
export function throwDice(table, dice, { mass, restitution }, wide) {
  clearDice(table);
  Object.assign(table, { shapes: dice.map((die) => die.shape), elapsed: 0, stillFor: 0, nudges: 0 });
  table.landing.restitution = restitution;
  const rows = Math.min(dice.length, 5);
  const speed = Math.max(table.halfWidth, 6);
  table.bodies = dice.map(({ type, shape }, i) => {
    const roll = (wide && ROLLS[type]) || ROLL;
    const body = new CANNON.Body({
      mass,
      material: table.dice,
      shape: polyhedron(shape),
      linearDamping: 0.15,
      angularDamping: roll.spinBrake,
      sleepSpeedLimit: 0.3,
      sleepTimeLimit: 0.3,
    });
    const row = i % rows;
    const column = Math.floor(i / rows);
    body.position.set(
      -table.halfWidth + 1.5 + column * SPACING,
      between(3, 5),
      (row - (rows - 1) / 2) * SPACING + between(-0.4, 0.4),
    );
    body.quaternion.setFromEuler(between(0, 2 * Math.PI), between(0, 2 * Math.PI), between(0, 2 * Math.PI));
    body.velocity.set(between(1.1, 1.6) * speed * roll.push, between(-2, 2), between(-0.3, 0.3) * speed);
    body.angularVelocity.set(between(-20, 20), between(-20, 20), between(-20, 20));
    table.world.addBody(body);
    return body;
  });
}

export function step(table, seconds) {
  table.world.step(STEP, seconds, 10);
  table.elapsed += seconds;
  const still = table.bodies.every(
    (body) => body.velocity.length() < STILL_SPEED && body.angularVelocity.length() < STILL_SPIN,
  );
  table.stillFor = still ? table.stillFor + seconds : 0;
}

// Returns the face values once every die has come to rest, or null while they are still rolling.
// A die left leaning on another die or a wall gets nudged so it can fall flat.
export function restingFaces(table) {
  const givenUp = table.elapsed >= GIVE_UP_SECONDS;
  if (table.stillFor < SETTLE_SECONDS && !givenUp) return null;
  const faces = table.bodies.map((body, i) => topFace(body, table.shapes[i]));
  const cocked = table.bodies.filter((body, i) => faces[i].tilt < FLAT_ENOUGH);
  if (cocked.length && table.nudges < MAX_NUDGES && !givenUp) {
    cocked.forEach(nudge);
    table.nudges++;
    table.stillFor = 0;
    return null;
  }
  return faces.map((face) => face.value);
}

// The value whose direction points most nearly straight up. "tilt" is 1 when it points exactly up.
export function topFace(body, shape) {
  let best = { value: null, tilt: -Infinity };
  for (const { up, value } of shape.values) {
    const direction = body.quaternion.vmult(new CANNON.Vec3(...up));
    const tilt = direction.y / direction.length();
    if (tilt > best.tilt) best = { value, tilt };
  }
  return best;
}

function nudge(body) {
  body.wakeUp();
  body.velocity.set(between(-2, 2), between(6, 9), between(-2, 2));
  body.angularVelocity.set(between(-8, 8), between(-8, 8), between(-8, 8));
}

export function rollTypes(count, sides) {
  const types = sides === 100 ? ["d100", "d10"] : [`d${sides}`];
  return Array.from({ length: count }, () => types).flat();
}

// A d10 shows 0 for 10. A d100 is a tens die plus a units die, where 00 and 0 make 100.
export function rollValues(sides, faces) {
  if (sides === 10) return faces.map((face) => face || 10);
  if (sides !== 100) return faces;
  const values = [];
  for (let i = 0; i < faces.length; i += 2) {
    values.push(faces[i] + faces[i + 1] || 100);
  }
  return values;
}
