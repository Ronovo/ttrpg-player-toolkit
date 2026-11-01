import unittest

from server.glb import JSON_CHUNK, ModelError, check
from tests.python.helpers import BOUNDS, dice_gltf, good_model, make_glb


class ModelCheckTests(unittest.TestCase):
    def refusal(self, data):
        with self.assertRaises(ModelError) as caught:
            check(data, BOUNDS)
        return str(caught.exception)

    def test_accepts_the_toolkits_dice(self):
        check(good_model(), BOUNDS)

    def test_refuses_files_that_are_not_glb(self):
        self.assertEqual(self.refusal(b"glTF"), "That file is not a .glb model.")
        self.assertEqual(self.refusal(b"x" * 40), "That file is not a .glb model.")
        self.assertEqual(self.refusal(make_glb(dice_gltf(), version=1)), "The model must be glTF version 2.")

    def test_refuses_damaged_headers(self):
        self.assertEqual(self.refusal(make_glb(dice_gltf(), chunk_type=JSON_CHUNK + 1)), "The model's header is damaged.")
        self.assertEqual(self.refusal(make_glb(dice_gltf())[:-30]), "The model's header is damaged.")
        self.assertEqual(self.refusal(make_glb(b"{not json")), "The model's header is damaged.")
        self.assertEqual(self.refusal(make_glb(b"\xff\xfe")), "The model's header is damaged.")
        self.assertEqual(self.refusal(make_glb(b"[1, 2]")), "The model's header is damaged.")

    def test_wants_every_die_named(self):
        gltf = dice_gltf(d20={"name": "d20"}, d100={"name": "lucky"})
        self.assertEqual(self.refusal(make_glb(gltf)),
                         "The model has no object named d20, d100. It needs d4, d6, d8, d10, d12, d20 and d100.")
        gltf["nodes"].append("not a node")
        self.assertEqual(self.refusal(make_glb(gltf)),
                         "The model has no object named d20, d100. It needs d4, d6, d8, d10, d12, d20 and d100.")

    def test_wants_transforms_applied(self):
        for transform in ({"rotation": [0, 0, 0, 1]}, {"scale": [2, 2, 2]}, {"matrix": [1] * 16}):
            gltf = dice_gltf(d6={"name": "d6", "mesh": 1, **transform})
            self.assertEqual(self.refusal(make_glb(gltf)),
                             "The d6 is rotated or scaled. Apply its transforms in Blender before exporting.")

    def test_wants_geometry_on_every_die(self):
        self.assertEqual(self.refusal(make_glb(dice_gltf(d8={"name": "d8", "mesh": 99}))), "The d8 has no geometry.")
        gltf = dice_gltf()
        gltf["meshes"][0]["primitives"] = []
        self.assertEqual(self.refusal(make_glb(gltf)), "The d4 has no geometry.")
        gltf = dice_gltf()
        del gltf["accessors"][2]["min"]
        self.assertEqual(self.refusal(make_glb(gltf)), "The d8 has no geometry.")
        gltf = dice_gltf()
        gltf["meshes"][3]["primitives"][0]["attributes"] = {"NORMAL": 3}
        self.assertEqual(self.refusal(make_glb(gltf)), "The d10 has no geometry.")

    def test_wants_the_toolkits_shapes(self):
        gltf = dice_gltf()
        gltf["accessors"][5]["max"][1] *= 1.5
        self.assertEqual(self.refusal(make_glb(gltf)), "The d20 is not the toolkit's d20 shape. Start from the toolkit's dice models.")
        gltf = dice_gltf()
        gltf["accessors"][6]["min"] = [0, 0, 0]
        self.assertEqual(self.refusal(make_glb(gltf)), "The d100 is not the toolkit's d100 shape. Start from the toolkit's dice models.")

    def test_takes_the_box_around_every_part_of_a_die(self):
        gltf = dice_gltf()
        low, high = BOUNDS["d6"]
        gltf["accessors"].append({"min": [low[0] * 0.2, low[1] * 0.2, low[2] * 0.2], "max": [high[0] * 0.2, high[1] * 0.2, high[2] * 0.2]})
        gltf["meshes"][1]["primitives"].append({"attributes": {"POSITION": len(gltf["accessors"]) - 1}})
        check(make_glb(gltf), BOUNDS)
        gltf["meshes"][1]["primitives"][0]["attributes"]["POSITION"] = len(gltf["accessors"]) - 1
        self.assertEqual(self.refusal(make_glb(gltf)), "The d6 is not the toolkit's d6 shape. Start from the toolkit's dice models.")
