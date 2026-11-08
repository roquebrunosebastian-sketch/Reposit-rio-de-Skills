// Carrega as texturas geradas pelo pxl (assets/*.png + manifest.json) e cria billboards de pixel art.
import * as THREE from "three";

export const PX = 16; // pixels por unidade do mundo

export async function carregarRecursos(base = "assets/") {
  const resposta = await fetch(base + "manifest.json");
  if (!resposta.ok) throw new Error(`não encontrei ${base}manifest.json — rode "npm run arte" em escritorio-3d/`);
  const manifesto = await resposta.json();
  const loader = new THREE.TextureLoader();
  const texturas = {};
  await Promise.all(Object.entries(manifesto).map(([nome, info]) =>
    loader.loadAsync(base + info.arquivo).then((t) => { texturas[nome] = pixelado(t); })));

  return {
    manifesto,
    /** Cópia da textura (compartilha a imagem) com repetição própria. */
    tex(nome, repX = 1, repY = 1) {
      const original = texturas[nome];
      if (!original) throw new Error(`textura '${nome}' não existe no manifest`);
      const t = original.clone();
      t.wrapS = repX === 1 ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
      t.wrapT = repY === 1 ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
      t.repeat.set(repX, repY);
      t.needsUpdate = true;
      return t;
    },
    /** Tamanho em unidades do mundo de um quadro do asset. */
    tamanho(nome) {
      const info = manifesto[nome];
      return { w: info.w / PX, h: info.h / PX };
    },
  };
}

export function pixelado(t) {
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Billboard de pixel art "de pé" no chão (pivô nos pés), sempre virado para a câmera.
 *
 * Um sprite virado para a câmera fica deitado para trás quando a câmera olha de cima: atravessaria
 * paredes e encostos, e mesas logo atrás do agente o cobririam. Por isso o visual é o do sprite
 * virado para a câmera, mas a PROFUNDIDADE de cada vértice é a de um plano vertical em pé no pivô
 * (a mesma altura na tela corresponde a um ponto acima do pivô). Assim a ordenação é a de um
 * objeto fino de pé naquele ponto, como nos RPGs 2.5D. `vies` puxa o sprite um pouco para a câmera.
 */
export function criarBillboard(textura, largura, altura, { vies = 0.15, opacidade = 1 } = {}) {
  const material = new THREE.SpriteMaterial({ map: textura, transparent: opacidade < 1, opacity: opacidade, alphaTest: 0.5 });
  const uniforme = { value: vies };
  material.userData.vies = uniforme;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uVies = uniforme;
    shader.vertexShader = shader.vertexShader
      .replace("void main() {", "uniform float uVies;\nvoid main() {")
      .replace("#include <logdepthbuf_vertex>", `
        vec4 pivoVista = modelViewMatrix[ 3 ];
        vec3 cimaVista = ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz;
        float alturaMundo = rotatedPosition.y / max( cimaVista.y, 0.05 );
        float zVertical = pivoVista.z + cimaVista.z * alturaMundo + uVies;
        vec4 clipVertical = projectionMatrix * vec4( mvPosition.xy, zVertical, 1.0 );
        gl_Position.z = ( clipVertical.z / clipVertical.w ) * gl_Position.w;
        #include <logdepthbuf_vertex>`);
  };
  material.customProgramCacheKey = () => "billboard-plano-vertical";
  const sprite = new THREE.Sprite(material);
  sprite.center.set(0.5, 0);
  sprite.scale.set(largura, altura, 1);
  return sprite;
}

/** Mostra o quadro `indice` de uma tira horizontal (rect do manifest de um sheet), opcionalmente espelhado. */
export function mostrarQuadro(textura, rect, larguraFolha, alturaFolha, indice, espelhar = false) {
  const u0 = (rect.x + indice * rect.w) / larguraFolha;
  const du = rect.w / larguraFolha;
  textura.repeat.set(espelhar ? -du : du, rect.h / alturaFolha);
  textura.offset.set(espelhar ? u0 + du : u0, 1 - (rect.y + rect.h) / alturaFolha);
}
