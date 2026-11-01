"""Checks that an uploaded .glb holds the toolkit's seven dice, so the toolkit's physics can roll and read them."""
import json
import struct

MAGIC = b"glTF"
JSON_CHUNK = 0x4E4F534A
DICE = ("d4", "d6", "d8", "d10", "d12", "d20", "d100")
# How far, as a share of the die's size, a die's bounds may stray from the toolkit's shape.
TOLERANCE = 0.15
HEADER = struct.Struct("<4sII")
CHUNK = struct.Struct("<II")


class ModelError(ValueError):
    """What is wrong with an uploaded model, in words for the player."""


def canonical_bounds(shapes: dict) -> dict:
    """The lowest and highest corner of each die's shape, from the "dice" of dice.json."""
    bounds = {}
    for die in DICE:
        vertices = shapes[die]["vertices"]
        bounds[die] = ([min(v[axis] for v in vertices) for axis in range(3)],
                       [max(v[axis] for v in vertices) for axis in range(3)])
    return bounds


def header(data: bytes) -> dict:
    """The glTF JSON of a .glb."""
    if len(data) < HEADER.size + CHUNK.size or data[:4] != MAGIC:
        raise ModelError("That file is not a .glb model.")
    _, version, _ = HEADER.unpack_from(data)
    if version != 2:
        raise ModelError("The model must be glTF version 2.")
    length, kind = CHUNK.unpack_from(data, HEADER.size)
    start = HEADER.size + CHUNK.size
    if kind != JSON_CHUNK or start + length > len(data):
        raise ModelError("The model's header is damaged.")
    try:
        gltf = json.loads(data[start:start + length])
    except ValueError:
        gltf = None
    if not isinstance(gltf, dict):
        raise ModelError("The model's header is damaged.")
    return gltf


def found_bounds(gltf: dict, mesh: int, die: str) -> tuple[list, list]:
    """The box around every primitive of a die's mesh."""
    try:
        boxes = [(accessor["min"], accessor["max"]) for accessor in (
            gltf["accessors"][primitive["attributes"]["POSITION"]] for primitive in gltf["meshes"][mesh]["primitives"])]
    except (KeyError, IndexError, TypeError):
        boxes = []
    if not boxes:
        raise ModelError(f"The {die} has no geometry.")
    return ([min(box[0][axis] for box in boxes) for axis in range(3)],
            [max(box[1][axis] for box in boxes) for axis in range(3)])


def check(data: bytes, bounds: dict) -> None:
    """Raises ModelError unless the .glb has the seven dice, unrotated and unscaled, in the toolkit's shapes."""
    gltf = header(data)
    nodes = {node.get("name"): node for node in gltf.get("nodes", []) if isinstance(node, dict)}
    missing = [die for die in DICE if "mesh" not in nodes.get(die, {})]
    if missing:
        raise ModelError(f"The model has no object named {', '.join(missing)}. "
                         "It needs d4, d6, d8, d10, d12, d20 and d100.")
    for die in DICE:
        node = nodes[die]
        if any(key in node for key in ("rotation", "scale", "matrix")):
            raise ModelError(f"The {die} is rotated or scaled. Apply its transforms in Blender before exporting.")
        low, high = found_bounds(gltf, node["mesh"], die)
        for axis in range(3):
            allowed = TOLERANCE * (bounds[die][1][axis] - bounds[die][0][axis])
            if abs(low[axis] - bounds[die][0][axis]) > allowed or abs(high[axis] - bounds[die][1][axis]) > allowed:
                raise ModelError(f"The {die} is not the toolkit's {die} shape. Start from the toolkit's dice models.")
