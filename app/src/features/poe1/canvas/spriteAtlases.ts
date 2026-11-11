import type {
  Poe1SpriteAtlases,
  Poe1SpriteFrame,
  Poe1SpriteVariant,
} from "../types";
import {
  getPoe1AssetUrl,
  POE1_RUNTIME_ATLAS_NAMES,
} from "../data/source.mjs";

export interface LoadedPoe1Atlas {
  image: HTMLImageElement;
  frames: Record<string, Poe1SpriteFrame>;
  scale: number;
}

export type LoadedPoe1Atlases = Record<string, LoadedPoe1Atlas>;

const REQUIRED_ATLASES = ["normalActive", "normalInactive", "frame"];
const imageCache = new Map<string, Promise<HTMLImageElement>>();

function chooseVariant(
  variants: Record<string, Poe1SpriteVariant>,
): [string, Poe1SpriteVariant] | null {
  if (variants["0.5"]) return ["0.5", variants["0.5"]];
  const entries = Object.entries(variants)
    .filter(([zoom, variant]) => Number.isFinite(Number(zoom)) && variant?.filename)
    .sort(([left], [right]) => Number(right) - Number(left));
  return entries[0] ?? null;
}

function loadImage(source: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(source);
  if (cached) return cached;

  const request = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => {
      imageCache.delete(source);
      reject(new Error(`Could not load the local PoE1 sprite ${source}.`));
    };
    image.src = source;
  });
  imageCache.set(source, request);
  return request;
}

export async function loadPoe1Atlases(
  sprites: Poe1SpriteAtlases,
  baseUrl: string,
  versionId = "current",
): Promise<LoadedPoe1Atlases> {
  for (const name of REQUIRED_ATLASES) {
    if (!sprites[name]) throw new Error(`The PoE1 tree is missing its ${name} sprite atlas.`);
  }

  const entries = await Promise.all(
    POE1_RUNTIME_ATLAS_NAMES.filter((name) => sprites[name]).map(async (name) => {
      const selected = chooseVariant(sprites[name]);
      if (!selected) {
        if (REQUIRED_ATLASES.includes(name)) {
          throw new Error(`The PoE1 ${name} sprite atlas has no usable resolution.`);
        }
        return null;
      }

      const [zoom, variant] = selected;
      const source = getPoe1AssetUrl(baseUrl, variant.filename, versionId);
      const image = await loadImage(source);
      return [
        name,
        {
          image,
          frames: variant.coords,
          scale: Number(zoom),
        },
      ] as const;
    }),
  );

  return Object.fromEntries(entries.filter((entry) => entry !== null));
}
