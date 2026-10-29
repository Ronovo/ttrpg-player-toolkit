"""Builds the dice models for the TTRPG Player Toolkit.

Run from anywhere:
    blender --background --factory-startup --python blender/make_dice.py

Writes public/dice/<set>.glb for every set and src/dice3d/dice.json, which holds the
physics shapes, the value of each face and the set list for the web page.
"""

import json
import math
from pathlib import Path

import bmesh
import bpy
from io_scene_gltf2.blender.com.material_helpers import create_settings_group, get_gltf_node_name
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = ROOT / "public" / "dice"
DATA_FILE = ROOT / "src" / "dice3d" / "dice.json"

TEXTURE_SIZE = 512
BEVEL = 0.06
OUTLINE_BOLD = 0.06
ENGRAVE_DEPTH = 0.035
PHI = (1 + math.sqrt(5)) / 2


def d10_vertices():
    apex = 1.15
    ring = apex * (1 - math.cos(math.radians(36))) / (1 + math.cos(math.radians(36)))
    verts = [(0, 0, apex), (0, 0, -apex)]
    for k in range(5):
        upper = math.radians(72 * k)
        lower = upper + math.radians(36)
        verts.append((math.cos(upper), math.sin(upper), ring))
        verts.append((math.cos(lower), math.sin(lower), -ring))
    return verts


def signs(*values):
    result = [()]
    for v in values:
        result = [r + (s * v,) for r in result for s in ((1, -1) if v else (1,))]
    return result


DICE = {
    "d4": {"radius": 1.45, "verts": [(1, 1, 1), (1, -1, -1), (-1, 1, -1), (-1, -1, 1)], "labels": range(1, 5)},
    "d6": {"radius": 1.3, "verts": signs(1, 1, 1), "labels": range(1, 7)},
    "d8": {"radius": 1.3, "verts": signs(1, 0, 0) + signs(0, 1, 0) + signs(0, 0, 1), "labels": range(1, 9)},
    "d10": {"radius": 1.25, "verts": d10_vertices(), "labels": range(0, 10)},
    "d100": {"radius": 1.25, "verts": d10_vertices(), "labels": range(0, 100, 10)},
    "d12": {
        "radius": 1.3,
        "verts": signs(1, 1, 1) + signs(0, 1 / PHI, PHI) + signs(1 / PHI, PHI, 0) + signs(PHI, 0, 1 / PHI),
        "labels": range(1, 13),
    },
    "d20": {"radius": 1.35, "verts": signs(0, 1, PHI) + signs(1, PHI, 0) + signs(PHI, 0, 1), "labels": range(1, 21)},
}

SETS = [
    {"id": "base", "label": "Base", "category": "-", "body": "#f2eee4", "mass": 1, "restitution": 0.35},
    {"id": "crimson", "label": "Crimson", "category": "Basic", "body": "#9e1b24", "mass": 1, "restitution": 0.35},
    {"id": "cobalt", "label": "Cobalt", "category": "Basic", "body": "#1f4fa8", "mass": 1, "restitution": 0.35},
    {"id": "forest", "label": "Forest", "category": "Basic", "body": "#2f5d3a", "mass": 1, "restitution": 0.35},
    {"id": "onyx", "label": "Onyx", "category": "Basic", "body": "#18181b", "mass": 1, "restitution": 0.35},
    {"id": "sunflower", "label": "Sunflower", "category": "Basic", "body": "#f2c230", "mass": 1, "restitution": 0.35},
    {"id": "teal", "label": "Teal", "category": "Basic", "body": "#1f7a7a", "mass": 1, "restitution": 0.35},
    {"id": "amethyst", "label": "Amethyst", "category": "Basic", "body": "#5b2f8f", "mass": 1, "restitution": 0.35},
    {"id": "tangerine", "label": "Tangerine", "category": "Basic", "body": "#e8701f", "mass": 1, "restitution": 0.35},
    {"id": "mint", "label": "Mint", "category": "Basic", "body": "#9fe0c4", "mass": 1, "restitution": 0.35},
    {"id": "bubblegum", "label": "Bubblegum", "category": "Premium", "mass": 1, "restitution": 0.4},
    {"id": "moonstone", "label": "Moonstone", "category": "Premium", "mass": 1, "restitution": 0.35},
    {"id": "forged-iron", "label": "Forged Iron", "category": "Premium", "mass": 2.5, "restitution": 0.12},
    {"id": "sunset-swirl", "label": "Sunset Swirl", "category": "Premium", "mass": 1, "restitution": 0.35},
    {"id": "carrara-marble", "label": "Carrara Marble", "category": "Premium", "mass": 1.4, "restitution": 0.25},
    {"id": "malachite", "label": "Malachite", "category": "Premium", "mass": 1.3, "restitution": 0.35},
    {"id": "tigers-eye", "label": "Tiger's Eye", "category": "Premium", "mass": 1.3, "restitution": 0.35},
    {"id": "rose-gold", "label": "Rose Gold", "category": "Premium", "mass": 2.2, "restitution": 0.15},
    {"id": "molten-obsidian", "label": "Molten Obsidian", "category": "Weird", "mass": 1.2, "restitution": 0.3},
    {"id": "galaxy", "label": "Galaxy", "category": "Weird", "mass": 1, "restitution": 0.35},
    {"id": "toxic-sludge", "label": "Toxic Sludge", "category": "Weird", "mass": 1, "restitution": 0.1},
    {"id": "circuit-board", "label": "Circuit Board", "category": "Weird", "mass": 1, "restitution": 0.35},
    {"id": "dragon-scale", "label": "Dragon Scale", "category": "Weird", "mass": 1.8, "restitution": 0.35},
    {"id": "stormcaller", "label": "Stormcaller", "category": "Weird", "mass": 1, "restitution": 0.45},
    {"id": "abyssal", "label": "Abyssal", "category": "Weird", "mass": 0.9, "restitution": 0.35},
    {"id": "glacial-rift", "label": "Glacial Rift", "category": "Weird", "mass": 1, "restitution": 0.2},
]


def label_text(die_type, value):
    return f"{value:02d}" if die_type == "d100" else str(value)


# ---------- shapes ----------

def hull_bmesh(spec):
    bm = bmesh.new()
    scale = spec["radius"] / max(Vector(v).length for v in spec["verts"])
    for v in spec["verts"]:
        bm.verts.new(Vector(v) * scale)
    bmesh.ops.convex_hull(bm, input=bm.verts)
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(1), verts=bm.verts, edges=bm.edges)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def face_frames(bm, die_type):
    """Center, normal, up direction and fit radius for each face, in face order."""
    frames = []
    for face in bm.faces:
        center = face.calc_center_median()
        normal = face.normal.copy()
        corners = [v.co for v in face.verts]
        if die_type in ("d10", "d100"):
            target = max(corners, key=lambda c: c.length)
        elif len(corners) == 4:
            target = (corners[0] + corners[1]) / 2
        else:
            target = corners[0]
        up = (target - center)
        up -= normal * up.dot(normal)
        edges = zip(corners, corners[1:] + corners[:1])
        inradius = min(distance_to_line(center, a, b) for a, b in edges)
        frames.append({"center": center, "normal": normal, "up": up.normalized(), "inradius": inradius})
    return frames


def distance_to_line(p, a, b):
    ab = b - a
    return (p - a - ab * ((p - a).dot(ab) / ab.length_squared)).length


def assign_values(frames, labels):
    """Opposite faces add up to the same total, like real dice."""
    labels = list(labels)
    low, high = 0, len(labels) - 1
    values = [None] * len(frames)
    order = sorted(range(len(frames)), key=lambda i: (-frames[i]["normal"].z, math.atan2(frames[i]["normal"].y, frames[i]["normal"].x)))
    for i in order:
        if values[i] is not None:
            continue
        opposite = min(range(len(frames)), key=lambda j: frames[j]["normal"].dot(frames[i]["normal"]))
        values[i], values[opposite] = labels[low], labels[high]
        low, high = low + 1, high - 1
    return values


# ---------- numbers ----------

def text_bmesh(text, extra_bold=0.0):
    curve = bpy.data.curves.new("number", "FONT")
    curve.body = text
    curve.align_x = "CENTER"
    curve.align_y = "CENTER"
    curve.resolution_u = 4
    curve.offset = 0.05 + extra_bold
    if text in ("6", "9"):
        for char in curve.body_format:
            char.use_underline = True
        curve.underline_position = -0.14
        curve.underline_height = 0.08
    obj = bpy.data.objects.new("number", curve)
    bpy.context.scene.collection.objects.link(obj)
    mesh = bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(obj)
    bpy.data.curves.remove(curve)
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bpy.data.meshes.remove(mesh)
    return bm


def place_number(cutter, text, frame, height, offset=Vector(), outline=False):
    """An outlined number also gets a bolder copy cut shallow in the second ink, which shows as a rim."""
    bm = text_bmesh(text)
    xs = [v.co.x for v in bm.verts]
    ys = [v.co.y for v in bm.verts]
    width, tall = max(xs) - min(xs), max(ys) - min(ys)
    middle = Vector(((max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2, 0))
    scale = min(height / tall, height * 1.5 / width)
    cuts = [(bm, ENGRAVE_DEPTH, 0)]
    if outline:
        cuts.append((text_bmesh(text, OUTLINE_BOLD), ENGRAVE_DEPTH / 2, 1))
    for shape, depth, slot in cuts:
        bmesh.ops.translate(shape, verts=shape.verts, vec=-middle)
        bmesh.ops.scale(shape, verts=shape.verts, vec=(scale, scale, 1))
        engrave(cutter, shape, frame, offset, depth, slot)


def engrave(cutter, bm, frame, offset=Vector(), depth=ENGRAVE_DEPTH, slot=0):
    """Turns a flat outline into a cutter that sinks it `depth` into the face described by `frame`.
    `slot` picks the ink: 0 for the main ink, 1 for the set's outline ink."""
    side = frame["up"].cross(frame["normal"])
    basis = Matrix((side, frame["up"], frame["normal"])).transposed().to_4x4()
    basis.translation = frame["center"] + offset
    top = bmesh.ops.extrude_face_region(bm, geom=bm.faces[:])
    top_verts = [g for g in top["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=top_verts, vec=(0, 0, depth * 2))
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, -depth))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for face in bm.faces:
        face.material_index = slot
    bm.transform(basis)
    mesh = bpy.data.meshes.new("tmp")
    bm.to_mesh(mesh)
    bm.free()
    cutter.from_mesh(mesh)
    bpy.data.meshes.remove(mesh)


def build_cutter(die_type, hull, frames, values, outline=False):
    """Outlined dice have a rim around every number."""
    cutter = bmesh.new()
    if die_type == "d4":
        corner_values = {}
        for i, vert in enumerate(sorted(hull.verts, key=lambda v: tuple(v.co))):
            corner_values[vert.index] = i + 1
        for face, frame in zip(hull.faces, frames):
            for vert in face.verts:
                toward = vert.co - frame["center"]
                toward -= frame["normal"] * toward.dot(frame["normal"])
                corner = dict(frame, up=toward.normalized())
                height = frame["inradius"] * 0.78
                place_number(cutter, str(corner_values[vert.index]), corner, height, toward * 0.52, outline)
        return cutter, corner_values
    for frame, value in zip(frames, values):
        height = frame["inradius"] * (0.85 if die_type == "d100" else 1.1)
        place_number(cutter, label_text(die_type, value), frame, height, outline=outline)
    return cutter, None


# ---------- materials ----------

def new_material(name):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    return mat, mat.node_tree, mat.node_tree.nodes["Principled BSDF"]


def solid(name, color, roughness=0.5, glow=0.0):
    mat, _, bsdf = new_material(name)
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Emission Color"].default_value = (*color, 1)
    bsdf.inputs["Emission Strength"].default_value = glow
    return mat


def hex_color(value):
    rgb = [int(value[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    return tuple(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb)


def gltf_settings(tree):
    group = bpy.data.node_groups.get(get_gltf_node_name()) or create_settings_group(get_gltf_node_name())
    node = tree.nodes.new("ShaderNodeGroup")
    node.node_tree = group
    return node


def ramp(tree, source, stops):
    node = tree.nodes.new("ShaderNodeValToRGB")
    tree.links.new(source, node.inputs["Fac"])
    elements = node.color_ramp.elements
    for element, (position, color) in zip(elements, (stops[0], stops[-1])):
        element.position = position
        element.color = (*hex_color(color), 1)
    for position, color in stops[1:-1]:
        elements.new(position).color = (*hex_color(color), 1)
    return node.outputs["Color"]


def object_coords(tree, scale=(1, 1, 1)):
    coords = tree.nodes.new("ShaderNodeTexCoord")
    mapping = tree.nodes.new("ShaderNodeMapping")
    mapping.inputs["Scale"].default_value = scale
    tree.links.new(coords.outputs["Object"], mapping.inputs["Vector"])
    return mapping.outputs["Vector"]


def noise(tree, scale, detail, distortion=0.0, roughness=0.5, stretch=(1, 1, 1)):
    node = tree.nodes.new("ShaderNodeTexNoise")
    node.inputs["Scale"].default_value = scale
    node.inputs["Detail"].default_value = detail
    node.inputs["Distortion"].default_value = distortion
    node.inputs["Roughness"].default_value = roughness
    tree.links.new(object_coords(tree, stretch), node.inputs["Vector"])
    return node.outputs["Fac"]


def voronoi(tree, scale, feature="F1", metric="EUCLIDEAN", detail=0):
    node = tree.nodes.new("ShaderNodeTexVoronoi")
    node.feature = feature
    node.distance = metric
    node.inputs["Scale"].default_value = scale
    node.inputs["Detail"].default_value = detail
    tree.links.new(object_coords(tree), node.inputs["Vector"])
    return node.outputs["Distance"]


def wave(tree, kind, scale, distortion, detail):
    node = tree.nodes.new("ShaderNodeTexWave")
    node.wave_type = kind
    if kind == "RINGS":
        node.rings_direction = "SPHERICAL"
    node.inputs["Scale"].default_value = scale
    node.inputs["Distortion"].default_value = distortion
    node.inputs["Detail"].default_value = detail
    tree.links.new(object_coords(tree), node.inputs["Vector"])
    return node.outputs["Fac"]


def mix(tree, blend, a, b):
    node = tree.nodes.new("ShaderNodeMix")
    node.data_type = "RGBA"
    node.blend_type = blend
    node.inputs["Factor"].default_value = 1
    tree.links.new(a, node.inputs[6])
    tree.links.new(b, node.inputs[7])
    return node.outputs[2]


def swirl(tree, inputs, stops):
    inputs["Roughness"].default_value = 0.35
    inputs["Coat Weight"].default_value = 1.0
    inputs["Coat Roughness"].default_value = 0.04
    return {"Base Color": ramp(tree, noise(tree, 0.55, 3, distortion=2.5), stops)}


def glowing_spots(tree, background, scale, stops, clusters=None):
    """Voronoi spots screened over the background. Returns the color and the glow mask."""
    mask = ramp(tree, voronoi(tree, scale), stops)
    if clusters:
        mask = mix(tree, "MULTIPLY", mask, clusters)
    return mix(tree, "SCREEN", background, mask), mask


def edge_glow(tree, inputs, distance, glow, body):
    """Glowing lines where `distance` is near zero, fading into the body color."""
    inputs["Emission Strength"].default_value = 2.5
    inputs["Roughness"].default_value = 0.06
    return {
        "Base Color": ramp(tree, distance, glow + [(0.055, body)]),
        "Emission Color": ramp(tree, distance, glow + [(0.05, "#000000")]),
    }


def brushed_metal(tree, inputs, dark, light, shine=("#4a4a4a", "#b0b0b0")):
    """`shine` is the roughness range as greys: darker greys make a shinier metal."""
    inputs["Metallic"].default_value = 1.0
    return {
        "Base Color": ramp(tree, noise(tree, 9, 4), [(0.35, dark), (0.65, light)]),
        "Roughness": ramp(tree, noise(tree, 3, 10, stretch=(1, 1, 60)), [(0.3, shine[0]), (0.7, shine[1])]),
    }


def body_material(set_id, name):
    """The die body. Returns the material and the procedural outputs to bake into images."""
    mat, tree, bsdf = new_material(name)
    bakes = {}
    inputs = bsdf.inputs
    plain = next(s for s in SETS if s["id"] == set_id).get("body")
    if plain:
        inputs["Base Color"].default_value = (*hex_color(plain), 1)
        inputs["Roughness"].default_value = 0.45
    elif set_id == "bubblegum":
        bakes = swirl(tree, inputs, [
            (0.36, "#ff5fa8"), (0.45, "#ff9ccc"), (0.49, "#fff4f9"), (0.52, "#bfeaff"), (0.58, "#5cbdf5"), (0.66, "#3a9fe6"),
        ])
    elif set_id == "sunset-swirl":
        bakes = swirl(tree, inputs, [
            (0.36, "#ff6b6b"), (0.45, "#ff9a5c"), (0.49, "#ffd38a"), (0.52, "#e07ad6"), (0.58, "#9b4fd1"), (0.66, "#6a2fb0"),
        ])
    elif set_id == "galaxy":
        nebula = ramp(tree, noise(tree, 1.6, 8, roughness=0.62), [
            (0.25, "#07061c"), (0.45, "#2b1060"), (0.58, "#7a2bb8"), (0.68, "#d24fd0"), (0.8, "#3e7ce8"),
        ])
        color, stars = glowing_spots(tree, nebula, 22, [(0.0, "#ffffff"), (0.06, "#000000")])
        bakes = {"Base Color": color, "Emission Color": stars}
        inputs["Emission Strength"].default_value = 2.5
        inputs["Roughness"].default_value = 0.08
    elif set_id == "molten-obsidian":
        cracks = voronoi(tree, 1.2, "DISTANCE_TO_EDGE", detail=1)
        heat = [(0.0, "#fff2a8"), (0.006, "#ff8a1e"), (0.016, "#d42a00"), (0.035, "#3a0600")]
        bakes = edge_glow(tree, inputs, cracks, heat, "#0d0b0e")
        inputs["Roughness"].default_value = 0.3
    elif set_id == "glacial-rift":
        cracks = voronoi(tree, 1.2, "DISTANCE_TO_EDGE", detail=1)
        frost = [(0.0, "#f0ffff"), (0.006, "#6ff0ff"), (0.016, "#1aa6d8"), (0.035, "#0e4a6e")]
        bakes = edge_glow(tree, inputs, cracks, frost, "#d6e8f2")
    elif set_id == "circuit-board":
        traces = tree.nodes.new("ShaderNodeMath")
        traces.operation = "SUBTRACT"
        tree.links.new(voronoi(tree, 2.5, "F2", "CHEBYCHEV"), traces.inputs[0])
        tree.links.new(voronoi(tree, 2.5, "F1", "CHEBYCHEV"), traces.inputs[1])
        gold = [(0.0, "#fff3c0"), (0.01, "#ffcf4d"), (0.025, "#a87400"), (0.035, "#2a2400")]
        bakes = edge_glow(tree, inputs, traces.outputs[0], gold, "#0f4a24")
        inputs["Emission Strength"].default_value = 1.5
        inputs["Roughness"].default_value = 0.35
    elif set_id == "forged-iron":
        bakes = brushed_metal(tree, inputs, "#1e1e22", "#4a4a50")
    elif set_id == "rose-gold":
        bakes = brushed_metal(tree, inputs, "#a8402f", "#e07a62", shine=("#b4b4b4", "#d8d8d8"))
    elif set_id == "moonstone":
        bakes["Base Color"] = ramp(tree, noise(tree, 1.2, 6), [
            (0.38, "#f5f6f8"), (0.5, "#dde6f4"), (0.6, "#b9cdf0"), (0.68, "#9fb8ec"),
        ])
        inputs["Roughness"].default_value = 0.28
        inputs["IOR"].default_value = 1.55
        inputs["Thin Film Thickness"].default_value = 520
        inputs["Thin Film IOR"].default_value = 1.6
        settings = gltf_settings(tree)
        settings.inputs["Iridescence Factor"].default_value = 1.0
        settings.inputs["Iridescence Thickness Minimum"].default_value = 250
    elif set_id == "carrara-marble":
        bakes["Base Color"] = ramp(tree, wave(tree, "BANDS", 1.2, 9, 6), [
            (0.0, "#5e5e66"), (0.05, "#a3a3ab"), (0.14, "#ecebe6"), (1.0, "#f8f7f3"),
        ])
        inputs["Roughness"].default_value = 0.15
    elif set_id == "malachite":
        bakes["Base Color"] = ramp(tree, wave(tree, "RINGS", 2.5, 3, 3), [
            (0.0, "#062a1c"), (0.25, "#0f5e3e"), (0.5, "#1f9a68"), (0.7, "#5fd6a0"), (0.85, "#1a7a52"), (1.0, "#062a1c"),
        ])
        inputs["Roughness"].default_value = 0.18
    elif set_id == "tigers-eye":
        bakes["Base Color"] = ramp(tree, wave(tree, "BANDS", 3, 4, 3), [
            (0.0, "#3a2108"), (0.3, "#7a4a12"), (0.5, "#d9a441"), (0.62, "#f2cf6e"), (0.75, "#8a5a17"), (1.0, "#3a2108"),
        ])
        inputs["Roughness"].default_value = 0.12
        inputs["Coat Weight"].default_value = 1.0
        inputs["Coat Roughness"].default_value = 0.03
    elif set_id == "toxic-sludge":
        murk = ramp(tree, noise(tree, 1.4, 4), [(0.3, "#0a1606"), (0.7, "#2b4a10")])
        clusters = ramp(tree, noise(tree, 1.5, 2), [(0.45, "#000000"), (0.55, "#ffffff")])
        color, bubbles = glowing_spots(tree, murk, 6, [(0.0, "#e8ff7a"), (0.04, "#a8f02a"), (0.06, "#000000")], clusters)
        bakes = {"Base Color": color, "Emission Color": bubbles}
        inputs["Emission Strength"].default_value = 1.5
        inputs["Roughness"].default_value = 0.5
    elif set_id == "abyssal":
        depths = ramp(tree, noise(tree, 1.2, 4), [(0.3, "#020615"), (0.6, "#061f38"), (0.8, "#0b3b55")])
        clusters = ramp(tree, noise(tree, 1.8, 3), [(0.5, "#000000"), (0.6, "#ffffff")])
        color, plankton = glowing_spots(tree, depths, 26, [(0.0, "#d8fff8"), (0.025, "#3ff0d8"), (0.05, "#000000")], clusters)
        bakes = {"Base Color": color, "Emission Color": plankton}
        inputs["Emission Strength"].default_value = 2.5
        inputs["Roughness"].default_value = 0.12
    elif set_id == "dragon-scale":
        bakes["Base Color"] = ramp(tree, voronoi(tree, 4, "DISTANCE_TO_EDGE"), [
            (0.0, "#f2c95a"), (0.03, "#c07a2a"), (0.06, "#9e1b24"), (0.2, "#5a0a14"),
        ])
        inputs["Metallic"].default_value = 0.5
        inputs["Roughness"].default_value = 0.3
    elif set_id == "stormcaller":
        clouds = ramp(tree, noise(tree, 1.3, 6), [(0.3, "#121419"), (0.7, "#3a3f4a")])
        bolts = ramp(tree, noise(tree, 1.8, 8, distortion=0.6, roughness=0.65), [
            (0.485, "#000000"), (0.496, "#9fd0ff"), (0.5, "#ffffff"), (0.504, "#9fd0ff"), (0.515, "#000000"),
        ])
        bakes = {"Base Color": mix(tree, "SCREEN", clouds, bolts), "Emission Color": bolts}
        inputs["Emission Strength"].default_value = 3.0
        inputs["Roughness"].default_value = 0.35
    return mat, bakes


INK = {
    "base": ("#111111", 0.6, 0.0),
    "crimson": ("#f2eee4", 0.6, 0.0),
    "cobalt": ("#ffffff", 0.6, 0.0),
    "forest": ("#e8d9a8", 0.6, 0.0),
    "onyx": ("#f2eee4", 0.6, 0.0),
    "sunflower": ("#2a1f0a", 0.6, 0.0),
    "teal": ("#ffffff", 0.6, 0.0),
    "amethyst": ("#f4e9ff", 0.6, 0.0),
    "tangerine": ("#1a1a1a", 0.6, 0.0),
    "mint": ("#143d2e", 0.6, 0.0),
    "bubblegum": ("#1b2559", 0.5, 0.0),
    "moonstone": ("#1c2a4a", 0.5, 0.0),
    "forged-iron": ("#ffcf4d", 0.4, 0.8),
    "sunset-swirl": ("#2a1033", 0.5, 0.0),
    "carrara-marble": ("#b8913a", 0.4, 0.0),
    "malachite": ("#f2e6b8", 0.5, 0.0),
    "tigers-eye": ("#fff1d0", 0.5, 0.0),
    "rose-gold": ("#ffe29a", 0.5, 0.0),
    "molten-obsidian": ("#fff1c4", 0.4, 3.0),
    "galaxy": ("#ffd45c", 0.4, 0.8),
    "toxic-sludge": ("#d8ff4a", 0.4, 1.5),
    "circuit-board": ("#3ff0ff", 0.4, 0.8),
    "dragon-scale": ("#ffe6a0", 0.4, 0.0),
    "stormcaller": ("#ffd23f", 0.4, 1.2),
    "abyssal": ("#7ff5e6", 0.4, 1.5),
    "glacial-rift": ("#0d2a40", 0.5, 0.0),
}

# Sets listed here get a rim of this ink around every number.
OUTLINE_INK = {
    "rose-gold": ("#c8962e", 0.4, 0.0),
}


def bake(obj, mat, bakes):
    """Bakes each procedural output into an image, then wires the image in its place."""
    tree = mat.node_tree
    bsdf = tree.nodes["Principled BSDF"]
    output = tree.nodes["Material Output"]
    emission = tree.nodes.new("ShaderNodeEmission")
    others = [s.material for s in obj.material_slots if s.material != mat]
    for socket_name, source in bakes.items():
        image = bpy.data.images.new(f"{mat.name}-{socket_name}", TEXTURE_SIZE, TEXTURE_SIZE)
        if socket_name == "Roughness":
            image.colorspace_settings.name = "Non-Color"
        node = tree.nodes.new("ShaderNodeTexImage")
        node.image = image
        tree.nodes.active = node
        holders = []
        for other in others:
            holder = other.node_tree.nodes.new("ShaderNodeTexImage")
            holder.image = image
            other.node_tree.nodes.active = holder
            holders.append((other, holder))
        tree.links.new(source, emission.inputs["Color"])
        tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])
        bpy.ops.object.bake(type="EMIT", margin=6)
        image.pack()
        for other, holder in holders:
            other.node_tree.nodes.remove(holder)
        if socket_name == "Roughness":
            split = tree.nodes.new("ShaderNodeSeparateColor")
            tree.links.new(node.outputs["Color"], split.inputs["Color"])
            tree.links.new(split.outputs["Green"], bsdf.inputs["Roughness"])
        else:
            tree.links.new(node.outputs["Color"], bsdf.inputs[socket_name])
    tree.links.new(bsdf.outputs["BSDF"], output.inputs["Surface"])
    tree.nodes.remove(emission)


# ---------- building ----------

def select_only(obj):
    for other in bpy.context.view_layer.objects:
        other.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def smart_uv(obj):
    select_only(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(40), island_margin=0.02)
    bpy.ops.object.mode_set(mode="OBJECT")


def build_die(set_id, die_type, shape, location, collection):
    hull = shape["hull"]
    bm = hull.copy()
    beveled = bmesh.ops.bevel(
        bm, geom=bm.edges[:] + bm.verts[:], offset=BEVEL, segments=3, profile=0.5, affect="EDGES", clamp_overlap=True,
    )
    for face in beveled["faces"]:
        face.smooth = True
    mesh = bpy.data.meshes.new(f"{set_id}-{die_type}")
    bm.to_mesh(mesh)
    bm.free()
    die = bpy.data.objects.new(die_type, mesh)
    collection.objects.link(die)
    body, bakes = body_material(set_id, f"{set_id}-{die_type}-body")
    ink = solid(f"{set_id}-{die_type}-ink", hex_color(INK[set_id][0]), INK[set_id][1], INK[set_id][2])
    mesh.materials.append(body)

    cutter_mesh = bpy.data.meshes.new("cutter")
    shape["outlined" if set_id in OUTLINE_INK else "plain"].to_mesh(cutter_mesh)
    cutter_mesh.materials.append(ink)
    if set_id in OUTLINE_INK:
        color, roughness, glow = OUTLINE_INK[set_id]
        cutter_mesh.materials.append(solid(f"{set_id}-{die_type}-outline", hex_color(color), roughness, glow))
    cutter = bpy.data.objects.new("cutter", cutter_mesh)
    collection.objects.link(cutter)
    cut = die.modifiers.new("engrave", "BOOLEAN")
    cut.operation = "DIFFERENCE"
    cut.solver = "EXACT"
    cut.material_mode = "TRANSFER"
    cut.use_self = True
    cut.use_hole_tolerant = True
    cut.object = cutter
    evaluated = bpy.data.meshes.new_from_object(die.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    die.modifiers.clear()
    die.data = evaluated
    if sum(1 for face in evaluated.polygons if face.material_index == 0) < len(hull.faces):
        raise RuntimeError(f"Engraving the numbers broke {set_id} {die_type}")
    bpy.data.meshes.remove(mesh)
    bpy.data.objects.remove(cutter)
    bpy.data.meshes.remove(cutter_mesh)

    if bakes:
        smart_uv(die)
        select_only(die)
        bake(die, body, bakes)
    die.location = location
    return die


def to_gltf(v):
    return [round(v.x, 5), round(v.z, 5), round(-v.y, 5)]


def die_data(die_type, hull, frames, values, corner_values):
    if corner_values:
        ups = [{"up": to_gltf(v.co.normalized()), "value": corner_values[v.index]} for v in hull.verts]
    else:
        ups = [{"up": to_gltf(f["normal"]), "value": value} for f, value in zip(frames, values)]
    return {
        "vertices": [to_gltf(v.co) for v in hull.verts],
        "faces": [[v.index for v in face.verts] for face in hull.faces],
        "values": ups,
    }


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 1
    scene.cycles.device = "CPU"
    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    shapes = {}
    data = {"sets": SETS, "dice": {}}
    for die_type, spec in DICE.items():
        hull = hull_bmesh(spec)
        hull.verts.index_update()
        hull.faces.index_update()
        frames = face_frames(hull, die_type)
        values = None if die_type == "d4" else assign_values(frames, spec["labels"])
        plain, corner_values = build_cutter(die_type, hull, frames, values)
        outlined, _ = build_cutter(die_type, hull, frames, values, outline=True)
        shapes[die_type] = {"hull": hull, "plain": plain, "outlined": outlined, "radius": spec["radius"]}
        data["dice"][die_type] = die_data(die_type, hull, frames, values, corner_values)

    for row, set_info in enumerate(SETS):
        collection = bpy.data.collections.new(set_info["id"])
        scene.collection.children.link(collection)
        dice = []
        for column, die_type in enumerate(DICE):
            location = (column * 3.2, -row * 3.2, 0)
            dice.append(build_die(set_info["id"], die_type, shapes[die_type], location, collection))
            print(f"built {set_info['id']} {die_type}", flush=True)
        for obj in bpy.context.view_layer.objects:
            obj.select_set(obj.users_collection[0] == collection)
        bpy.ops.export_scene.gltf(
            filepath=str(MODEL_DIR / f"{set_info['id']}.glb"),
            export_format="GLB",
            use_selection=True,
            export_image_format="WEBP",
            export_image_quality=82,
            export_cameras=False,
            export_lights=False,
        )
        for die in dice:
            die.name = f"{set_info['id']}-{die.name}"

    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(data, indent=2) + "\n")


main()
