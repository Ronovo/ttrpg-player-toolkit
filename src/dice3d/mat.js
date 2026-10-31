import * as THREE from "three";
import props from "./props.json";

const textureLoader = new THREE.TextureLoader();
const surfaces = new Map();
const rims = new Map();
let upload = null;

function surfaceTexture(id, kind) {
  const name = `${id}-${kind}`;
  if (!surfaces.has(name)) {
    surfaces.set(name, textureLoader.loadAsync(`${import.meta.env.BASE_URL}mats/${name}.webp`).then((texture) => {
      texture.colorSpace = kind === "color" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      return texture;
    }));
  }
  return surfaces.get(name);
}

// An uploaded picture, cropped to cover the mat without stretching.
function uploadTexture(url) {
  if (upload?.url !== url) {
    upload?.texture.then((texture) => texture.dispose());
    const texture = textureLoader.loadAsync(url).then((loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace;
      const imageAspect = loaded.image.width / loaded.image.height;
      const matAspect = props.mat.width / props.mat.depth;
      loaded.repeat.set(Math.min(1, matAspect / imageAspect), Math.min(1, imageAspect / matAspect));
      loaded.offset.set((1 - loaded.repeat.x) / 2, (1 - loaded.repeat.y) / 2);
      return loaded;
    });
    upload = { url, texture };
  }
  return upload.texture;
}

function rimModel(id, loadModel) {
  if (!rims.has(id)) {
    rims.set(id, loadModel(`${import.meta.env.BASE_URL}mats/rim-${id}.glb`).then((gltf) => {
      gltf.scene.traverse((node) => {
        node.castShadow = node.isMesh;
        node.receiveShadow = node.isMesh;
      });
      return gltf.scene;
    }));
  }
  return rims.get(id);
}

export function createMat(scene) {
  const { width, depth } = props.mat;
  const material = new THREE.MeshPhysicalMaterial();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  return { scene, material, rim: null, version: 0 };
}

// Gives the mat a surface preset tinted `color`, or an uploaded `image`, and a `rim` ("none" for no rim).
// Resolves to false when a later call has replaced this one while its textures loaded.
export async function dressMat(mat, { surface, color, image, rim }, loadModel, anisotropy) {
  const version = ++mat.version;
  const preset = props.surfaces.find((s) => s.id === surface) ?? props.surfaces[0];
  const [map, normalMap, frame] = await Promise.all([
    image ? uploadTexture(image) : surfaceTexture(preset.id, "color"),
    image ? null : surfaceTexture(preset.id, "normal"),
    rim === "none" ? null : rimModel(rim, loadModel),
  ]);
  if (version !== mat.version) return false;
  [map, normalMap].forEach((texture) => texture && (texture.anisotropy = anisotropy));
  Object.assign(mat.material, { map, normalMap, roughness: preset.roughness, sheen: image ? 0 : preset.sheen });
  mat.material.color.set(image ? "#ffffff" : color);
  mat.material.sheenColor.set(color);
  mat.material.needsUpdate = true;
  if (mat.rim) mat.scene.remove(mat.rim);
  mat.rim = frame;
  if (frame) mat.scene.add(frame);
  return true;
}
