import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../public/lib/three.mjs';
import { MATERIALS, MODELS } from '../src/models/arcade-kit.js';
import { createAssetModel, getAssetSprite, init3DModels, is3DSupported, getSoldierSprite, getCoinSprite } from '../src/ui/scene/three-models.js';
import { encodeModel } from '../scripts/build-models.mjs';

function decodeGlb(buffer) {
  assert.equal(buffer.readUInt32LE(0), 0x46546c67, 'glTF magic');
  assert.equal(buffer.readUInt32LE(4), 2, 'GLB version');
  assert.equal(buffer.readUInt32LE(8), buffer.length, 'GLB total length');
  assert.equal(buffer.length % 4, 0);
  const jsonLength = buffer.readUInt32LE(12);
  assert.equal(buffer.readUInt32LE(16), 0x4e4f534a);
  assert.equal(jsonLength % 4, 0);
  const gltf = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength));
  const binOffset = 20 + jsonLength;
  assert.equal(buffer.readUInt32LE(binOffset + 4), 0x004e4942);
  const binLength = buffer.readUInt32LE(binOffset);
  assert.equal(binOffset + 8 + binLength, buffer.length);
  const binary = buffer.subarray(binOffset + 8);
  assert.equal(gltf.buffers[0].byteLength, binary.length);
  return { gltf, binary };
}

const itemSizes = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
const componentReaders = {
  5121: { bytes: 1, get: (b, offset) => b.readUInt8(offset) },
  5123: { bytes: 2, get: (b, offset) => b.readUInt16LE(offset) },
  5125: { bytes: 4, get: (b, offset) => b.readUInt32LE(offset) },
  5126: { bytes: 4, get: (b, offset) => b.readFloatLE(offset) },
};

function readAccessor(gltf, binary, index) {
  const accessor = gltf.accessors[index];
  assert.ok(accessor);
  const view = gltf.bufferViews[accessor.bufferView];
  const component = componentReaders[accessor.componentType], components = itemSizes[accessor.type];
  assert.ok(view && component && components);
  assert.equal(view.buffer, 0);
  assert.equal(view.byteOffset % 4, 0);
  assert.ok(view.byteOffset + view.byteLength <= binary.length);
  const count = accessor.count * components;
  assert.ok((accessor.byteOffset ?? 0) + count * component.bytes <= view.byteLength);
  const offset = view.byteOffset + (accessor.byteOffset ?? 0);
  return Array.from({ length: count }, (_, i) => component.get(binary, offset + i * component.bytes));
}

function dispose(model) {
  model.children.forEach(mesh => { mesh.geometry.dispose(); mesh.material.dispose(); });
}

test('共享3D资产：24份真实GLB头、JSON、索引、PBR及几何与definitions一致', async () => {
  assert.equal(Object.keys(MODELS).length, 24);
  for (const [id, definition] of Object.entries(MODELS)) {
    const buffer = await readFile(new URL(`../public/assets/models/${id}.glb`, import.meta.url));
    assert.deepEqual(buffer, encodeModel(id), `${id} is stale; run node scripts/build-models.mjs`);
    const { gltf, binary } = decodeGlb(buffer);
    assert.equal(gltf.asset.version, '2.0');
    assert.deepEqual(gltf.scenes[gltf.scene].nodes, [0]);
    assert.equal(gltf.nodes[0].name, id);
    assert.deepEqual(gltf.nodes[0].extras.reuse, definition.reuse);
    assert.equal(gltf.nodes[0].children.length, definition.nodes.length);
    assert.equal(gltf.meshes.length, definition.nodes.length);
    for (const [nodeIndex, spec] of definition.nodes.entries()) {
      const node = gltf.nodes[gltf.nodes[0].children[nodeIndex]];
      assert.equal(node.name, spec.name);
      assert.deepEqual(node.translation, spec.position ?? [0, 0, 0]);
      assert.deepEqual(node.scale, spec.scale ?? [1, 1, 1]);
      const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(spec.rotation ?? [0, 0, 0])));
      assert.deepEqual(node.rotation, quaternion.toArray().map(value => value === 0 ? 0 : value));
      const primitive = gltf.meshes[node.mesh].primitives[0];
      assert.equal(primitive.mode, 4);
      const positions = readAccessor(gltf, binary, primitive.attributes.POSITION);
      const normals = readAccessor(gltf, binary, primitive.attributes.NORMAL);
      const indices = readAccessor(gltf, binary, primitive.indices);
      assert.equal(positions.length, normals.length);
      assert.ok(positions.every(Number.isFinite));
      assert.ok(normals.every(Number.isFinite));
      assert.ok(indices.length > 0 && indices.length % 3 === 0);
      assert.ok(indices.every(index => Number.isInteger(index) && index >= 0 && index < positions.length / 3));
      const positionAccessor = gltf.accessors[primitive.attributes.POSITION];
      for (let axis = 0; axis < 3; axis++) {
        const values = positions.filter((_, index) => index % 3 === axis);
        assert.equal(positionAccessor.min[axis], Math.min(...values));
        assert.equal(positionAccessor.max[axis], Math.max(...values));
      }
      const material = gltf.materials[primitive.material];
      const source = MATERIALS[spec.material];
      assert.equal(material.name, spec.material);
      assert.deepEqual(material.pbrMetallicRoughness.baseColorFactor, [...new THREE.Color(source.color).toArray(), source.opacity ?? 1]);
      assert.equal(material.pbrMetallicRoughness.metallicFactor, source.metalness);
      assert.equal(material.pbrMetallicRoughness.roughnessFactor, source.roughness);
      if (source.opacity < 1) assert.equal(material.alphaMode, 'BLEND');
      if (source.emissive) assert.deepEqual(material.emissiveFactor, new THREE.Color(source.emissive).toArray());
    }
  }
});

test('共享3D资产：下载清单体积、三角形与世界包围盒真实匹配', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/assets/models/manifest.json', import.meta.url), 'utf8'));
  assert.equal(manifest.format, 'glTF 2.0');
  assert.equal(manifest.units, 'metres');
  assert.deepEqual(manifest.assets.map(asset => asset.id), Object.keys(MODELS));
  for (const asset of manifest.assets) {
    const buffer = await readFile(new URL(`../public/assets/models/${asset.file}`, import.meta.url));
    const model = createAssetModel(THREE, asset.id);
    const box = new THREE.Box3().setFromObject(model);
    assert.equal(asset.bytes, buffer.length);
    assert.equal(asset.nodes, model.children.length);
    assert.equal(asset.triangles, model.children.reduce((sum, mesh) => sum + mesh.geometry.index.count / 3, 0));
    assert.deepEqual(asset.bounds.min, box.min.toArray());
    assert.deepEqual(asset.bounds.max, box.max.toArray());
    assert.ok(asset.bounds.min[1] >= -1e-7, `${asset.id} must not extend below its ground pivot (Float32 tolerance)`);
    assert.ok(asset.triangles > 0 && asset.triangles < 10000, 'Assets stay practical for reuse on mobile');
    dispose(model);
  }
});

test('共享3D资产：实例资源独立、染色只改主材、玻璃透明且双面', () => {
  const before = JSON.stringify(MATERIALS);
  const original = createAssetModel(THREE, 'scout-bot');
  const colored = createAssetModel(THREE, 'scout-bot', '#ff0000');
  assert.ok(original.isGroup);
  assert.equal(original.children.length, MODELS['scout-bot'].nodes.length);
  original.children.forEach((mesh, index) => {
    const next = colored.children[index];
    assert.notEqual(mesh.geometry, next.geometry);
    assert.notEqual(mesh.material, next.material);
    assert.equal(next.material.color.getHexString(), MATERIALS[mesh.material.name].tintable ? 'ff0000' : mesh.material.color.getHexString());
  });
  const glass = createAssetModel(THREE, 'test-tube');
  for (const mesh of glass.children.filter(mesh => mesh.material.name === 'glass')) {
    assert.equal(mesh.material.transparent, true);
    assert.equal(mesh.material.opacity, .22);
    assert.equal(mesh.material.side, THREE.DoubleSide);
  }
  assert.equal(JSON.stringify(MATERIALS), before);
  assert.equal(createAssetModel(THREE, 'missing'), null);
  [original, colored, glass].forEach(dispose);
});

test('共享3D资产：没有WebGL的运行环境安全返回2D降级，旧接口保持可用', async () => {
  assert.equal(is3DSupported(), false);
  const first = init3DModels(), second = init3DModels();
  assert.equal(first, second, 'Concurrent initialization shares one promise');
  assert.equal(await first, false);
  assert.equal(await getAssetSprite('scout-bot'), null);
  assert.equal(await getAssetSprite('missing'), null);
  assert.equal(await getSoldierSprite('#00ff00'), null);
  assert.equal(await getCoinSprite(), null);
});
