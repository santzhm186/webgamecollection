/** Emit glTF 2.0 binary assets without an exporter dependency. */
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import * as THREE from '../public/lib/three.mjs';
import { MODELS } from '../src/models/arcade-kit.js';
import { createAssetModel } from '../src/ui/scene/three-models.js';

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const align4 = length => (length + 3) & ~3;
const componentTypes = new Map([[Float32Array, 5126], [Uint16Array, 5123], [Uint32Array, 5125], [Uint8Array, 5121]]);
const itemTypes = { 1: 'SCALAR', 2: 'VEC2', 3: 'VEC3', 4: 'VEC4' };

/** Returns a standards-compliant GLB with embedded indexed geometry and PBR materials. */
export function encodeModel(id) {
  const model = createAssetModel(THREE, id);
  if (!model) throw new RangeError(`Unknown model: ${id}`);
  const gltf = {
    asset: { version: '2.0', generator: 'WebGameCL / arcade-kit' },
    scene: 0,
    scenes: [{ name: id, nodes: [0] }],
    nodes: [{ name: id, children: [], extras: model.userData }],
    meshes: [], materials: [], accessors: [], bufferViews: [], buffers: [],
  };
  const chunks = [];
  let byteOffset = 0;
  const materialIndices = new Map();

  function addAccessor(attribute, target, includeBounds = false) {
    const { array, itemSize, count } = attribute;
    const componentType = componentTypes.get(array.constructor);
    if (!componentType || !itemTypes[itemSize]) throw new TypeError('Unsupported geometry attribute');
    const bytes = Buffer.from(array.buffer, array.byteOffset, array.byteLength);
    const padded = Buffer.alloc(align4(bytes.length));
    bytes.copy(padded);
    const view = gltf.bufferViews.length;
    gltf.bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.length, target });
    chunks.push(padded);
    byteOffset += padded.length;
    const accessor = { bufferView: view, byteOffset: 0, componentType, count, type: itemTypes[itemSize] };
    if (includeBounds) {
      accessor.min = Array(itemSize).fill(Infinity);
      accessor.max = Array(itemSize).fill(-Infinity);
      for (let i = 0; i < count; i++) for (let component = 0; component < itemSize; component++) {
        const value = array[i * itemSize + component];
        accessor.min[component] = Math.min(accessor.min[component], value);
        accessor.max[component] = Math.max(accessor.max[component], value);
      }
    }
    gltf.accessors.push(accessor);
    return gltf.accessors.length - 1;
  }

  function addMaterial(material) {
    if (materialIndices.has(material.name)) return materialIndices.get(material.name);
    const spec = {
      name: material.name,
      pbrMetallicRoughness: {
        baseColorFactor: [...material.color.toArray(), material.opacity],
        metallicFactor: material.metalness,
        roughnessFactor: material.roughness,
      },
      doubleSided: material.side === THREE.DoubleSide,
    };
    if (material.transparent || material.opacity < 1) spec.alphaMode = 'BLEND';
    if (material.emissive && material.emissive.getHex() !== 0) spec.emissiveFactor = material.emissive.toArray();
    const index = gltf.materials.length;
    gltf.materials.push(spec);
    materialIndices.set(material.name, index);
    return index;
  }

  for (const mesh of model.children) {
    const geometry = mesh.geometry;
    const attributes = { POSITION: addAccessor(geometry.attributes.position, 34962, true) };
    if (geometry.attributes.normal) attributes.NORMAL = addAccessor(geometry.attributes.normal, 34962);
    if (geometry.attributes.uv) attributes.TEXCOORD_0 = addAccessor(geometry.attributes.uv, 34962);
    const primitive = { attributes, material: addMaterial(mesh.material), mode: 4 };
    if (geometry.index) primitive.indices = addAccessor(geometry.index, 34963);
    const meshIndex = gltf.meshes.length;
    gltf.meshes.push({ name: mesh.name, primitives: [primitive] });
    const nodeIndex = gltf.nodes.length;
    gltf.nodes.push({
      name: mesh.name,
      mesh: meshIndex,
      translation: mesh.position.toArray(),
      rotation: mesh.quaternion.toArray(),
      scale: mesh.scale.toArray(),
    });
    gltf.nodes[0].children.push(nodeIndex);
    geometry.dispose();
    mesh.material.dispose();
  }
  const binary = Buffer.concat(chunks);
  gltf.buffers.push({ byteLength: binary.length });
  const jsonBytes = Buffer.from(JSON.stringify(gltf), 'utf8');
  const json = Buffer.alloc(align4(jsonBytes.length), 0x20);
  jsonBytes.copy(json);
  const totalLength = 12 + 8 + json.length + 8 + binary.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(GLB_MAGIC, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(json.length, 0);
  jsonHeader.writeUInt32LE(JSON_CHUNK, 4);
  const binaryHeader = Buffer.alloc(8);
  binaryHeader.writeUInt32LE(binary.length, 0);
  binaryHeader.writeUInt32LE(BIN_CHUNK, 4);
  return Buffer.concat([header, jsonHeader, json, binaryHeader, binary]);
}

export async function buildModels(outputDirectory = fileURLToPath(new URL('../public/assets/models/', import.meta.url))) {
  await mkdir(outputDirectory, { recursive: true });
  const entries = [];
  for (const [id, definition] of Object.entries(MODELS)) {
    const buffer = encodeModel(id);
    await writeFile(resolve(outputDirectory, `${id}.glb`), buffer);
    const model = createAssetModel(THREE, id);
    const box = new THREE.Box3().setFromObject(model);
    const triangles = model.children.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, 0);
    entries.push({
      id, name: definition.name, file: `${id}.glb`, bytes: buffer.length,
      triangles, bounds: { min: box.min.toArray(), max: box.max.toArray() },
      nodes: definition.nodes.length, category: definition.category, reuse: definition.reuse,
    });
    model.children.forEach(mesh => { mesh.geometry.dispose(); mesh.material.dispose(); });
  }
  await writeFile(resolve(outputDirectory, 'manifest.json'), `${JSON.stringify({ version: 1, format: 'glTF 2.0', units: 'metres', up: '+Y', forward: '+Z', assets: entries }, null, 2)}\n`);
  return entries;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  const entries = await buildModels();
  console.log(`Exported ${entries.length} shared GLB assets (${entries.reduce((sum, entry) => sum + entry.bytes, 0)} bytes).`);
}
