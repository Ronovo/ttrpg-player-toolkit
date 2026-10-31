import * as CANNON from 'cannon-es';
import { describe, expect, it } from 'vitest';
import diceData from '../src/dice3d/dice.json';
import {
  addObstacle, clearDice, clearObstacles, createTable, restingFaces, rollTypes, rollValues, setBounds, step, throwDice,
  topFace,
} from '../src/dice3d/physics.js';

const SET = { mass: 1, restitution: 0.35 };
const die = (type) => ({ type, shape: diceData.dice[type] });

function table(halfWidth = 10, halfDepth = 6) {
  const t = createTable();
  setBounds(t, halfWidth, halfDepth);
  return t;
}

function rollUntilStill(t, seconds = 12) {
  for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 30) {
    step(t, 1 / 30);
    const faces = restingFaces(t);
    if (faces) return faces;
  }
  return null;
}

describe('the dice shapes', () => {
  const expected = {
    d4: [1, 2, 3, 4], d6: [1, 2, 3, 4, 5, 6], d8: [1, 2, 3, 4, 5, 6, 7, 8], d10: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    d12: Array.from({ length: 12 }, (_, i) => i + 1), d20: Array.from({ length: 20 }, (_, i) => i + 1),
    d100: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90],
  };

  it.each(Object.entries(expected))('a %s shows each of its values once', (type, values) => {
    expect(diceData.dice[type].values.map((v) => v.value).sort((a, b) => a - b)).toEqual(values);
  });

  it.each(Object.keys(expected))('every face of a %s points a different way', (type) => {
    const ups = diceData.dice[type].values.map((v) => v.up.map((n) => n.toFixed(3)).join());
    expect(new Set(ups).size).toBe(ups.length);
  });

  it('lists every set once, with a weight and a bounce', () => {
    expect(new Set(diceData.sets.map((set) => set.id)).size).toBe(diceData.sets.length);
    for (const set of diceData.sets) {
      expect(set.mass).toBeGreaterThan(0);
      expect(set.restitution).toBeGreaterThan(0);
    }
  });
});

describe('the table', () => {
  it('has a floor and four walls at the edges', () => {
    const t = table(10, 6);
    expect(t.world.bodies).toHaveLength(5);
    expect(t.walls.map((wall) => [wall.position.x, wall.position.z])).toEqual([[-10, 0], [10, 0], [0, -6], [0, 6]]);
  });

  it('adds and clears obstacles of either shape', () => {
    const t = table();
    addObstacle(t, { shape: 'box', halfWidth: 1, halfDepth: 2, height: 4 }, 3, -1, Math.PI / 2);
    addObstacle(t, { shape: 'cylinder', radius: 1.5, height: 6 }, -3, 1, 0);
    expect(t.obstacles.map((body) => [body.shapes[0].constructor.name, body.position.y])).toEqual(
      [['Box', 2], ['Cylinder', 3]]);
    expect(t.world.bodies).toHaveLength(7);
    clearObstacles(t);
    expect(t.world.bodies).toHaveLength(5);
  });
});

describe('a throw', () => {
  it('lines dice up in rows of five along the left edge, all thrown at once', () => {
    const t = table(10);
    throwDice(t, Array.from({ length: 7 }, () => die('d6')), SET);
    expect(t.bodies).toHaveLength(7);
    expect(t.bodies.every((body) => body.world === t.world)).toBe(true);
    expect(t.bodies[5].position.x - t.bodies[0].position.x).toBeCloseTo(2.8);
    expect(t.bodies.every((body) => body.velocity.x > 0)).toBe(true);
    expect(t.landing.restitution).toBe(0.35);
  });

  it('throws pointy dice harder only on the wide mat', () => {
    const narrow = table();
    throwDice(narrow, [die('d8')], SET);
    const wide = table();
    throwDice(wide, [die('d8')], SET, { wide: true });
    expect(wide.bodies[0].angularDamping).toBe(0.15);
    expect(narrow.bodies[0].angularDamping).toBe(0.3);
  });

  it('lets dice out of a tower door one after another', () => {
    const t = table();
    throwDice(t, [die('d6'), die('d6'), die('d6')], SET, { exit: { x: 2, z: 1, heading: 0 } });
    expect(t.bodies.map((body) => Boolean(body.world))).toEqual([true, false, false]);
    step(t, 0.25);
    expect(t.bodies.map((body) => Boolean(body.world))).toEqual([true, true, false]);
    expect(t.bodies[0].position.x).toBeGreaterThan(1.5);
  });

  it('clears the last throw before the next', () => {
    const t = table();
    throwDice(t, [die('d6'), die('d6')], SET);
    throwDice(t, [die('d20')], SET);
    expect(t.world.bodies).toHaveLength(6);
    clearDice(t);
    expect(t.world.bodies).toHaveLength(5);
  });

  it.each(['d4', 'd6', 'd8', 'd10', 'd12', 'd20'])('a %s comes to rest showing one of its values', (type) => {
    const t = table();
    throwDice(t, [die(type)], SET);
    const [face] = rollUntilStill(t);
    expect(diceData.dice[type].values.map((v) => v.value)).toContain(face);
  });

  it('nudges a die left leaning until it lies flat, and gives up after ten seconds', () => {
    const t = table();
    throwDice(t, [die('d6')], SET);
    const body = t.bodies[0];
    const lean = () => {
      body.position.set(0, 1, 0);
      body.velocity.set(0, 0, 0);
      body.angularVelocity.set(0, 0, 0);
      body.quaternion.setFromEuler(Math.PI / 4, 0, 0);
    };
    lean();
    t.stillFor = 1;
    expect(restingFaces(t)).toBeNull();
    expect(body.velocity.y).toBeGreaterThan(5);
    lean();
    t.stillFor = 1;
    expect(restingFaces(t)).toBeNull();
    lean();
    t.stillFor = 1;
    expect(restingFaces(t)).toHaveLength(1);
    lean();
    t.nudges = 0;
    t.stillFor = 0;
    t.elapsed = 10;
    expect(restingFaces(t)).toHaveLength(1);
  });

  it('waits while anything is still moving', () => {
    const t = table();
    throwDice(t, [die('d6')], SET);
    step(t, 1 / 60);
    expect(t.stillFor).toBe(0);
    expect(restingFaces(t)).toBeNull();
  });
});

describe('reading the dice', () => {
  it('takes the face pointing most nearly straight up', () => {
    const body = new CANNON.Body();
    const shape = diceData.dice.d6;
    const up = shape.values.find((v) => v.up[1] > 0.9);
    expect(topFace(body, shape)).toEqual({ value: up.value, tilt: 1 });
    body.quaternion.setFromEuler(Math.PI, 0, 0);
    const down = shape.values.find((v) => v.up[1] < -0.9);
    expect(topFace(body, shape).value).toBe(down.value);
  });

  it('rolls a tens die and a units die for every d100', () => {
    expect(rollTypes(2, 100)).toEqual(['d100', 'd10', 'd100', 'd10']);
    expect(rollTypes(3, 6)).toEqual(['d6', 'd6', 'd6']);
  });

  it('reads 0 on a d10 as 10, and 00 with 0 on a d100 as 100', () => {
    expect(rollValues(10, [0, 7])).toEqual([10, 7]);
    expect(rollValues(100, [30, 7, 0, 0, 90, 0])).toEqual([37, 100, 90]);
    expect(rollValues(6, [2, 5])).toEqual([2, 5]);
  });
});
