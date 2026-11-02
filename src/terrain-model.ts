/** The editable map prototype has its own terrain model: it does not change level missions. */
export const terrainNames = ['grass', 'stone', 'dirt', 'sand', 'water', 'lava'] as const;
export type TerrainName = (typeof terrainNames)[number];
export type TerrainMap = TerrainName[][];

export const labels: Record<TerrainName, string> = {
  grass: 'Gras', stone: 'Steen', dirt: 'Aarde',
  sand: 'Zand', water: 'Water', lava: 'Lava'
};
export const atlasCoordinates: Record<TerrainName, readonly [number, number]> = {
  grass: [0, 0], stone: [1, 0], dirt: [2, 0],
  sand: [0, 1], water: [1, 1], lava: [2, 1]
};

export const demos: Record<string, TerrainMap> = {
  oever: [
    ['grass', 'grass', 'grass', 'grass', 'stone', 'stone', 'stone'],
    ['grass', 'grass', 'dirt', 'grass', 'stone', 'stone', 'stone'],
    ['grass', 'dirt', 'dirt', 'sand', 'sand', 'water', 'water'],
    ['grass', 'grass', 'sand', 'sand', 'water', 'water', 'water'],
    ['grass', 'grass', 'sand', 'water', 'water', 'water', 'water'],
    ['grass', 'grass', 'grass', 'sand', 'water', 'water', 'water']
  ],
  lavagrot: [
    ['stone', 'stone', 'stone', 'stone', 'stone', 'stone', 'stone'],
    ['stone', 'dirt', 'stone', 'stone', 'lava', 'stone', 'stone'],
    ['dirt', 'dirt', 'sand', 'stone', 'lava', 'lava', 'stone'],
    ['dirt', 'sand', 'sand', 'sand', 'stone', 'lava', 'stone'],
    ['sand', 'sand', 'stone', 'stone', 'stone', 'lava', 'lava'],
    ['sand', 'stone', 'stone', 'lava', 'lava', 'lava', 'lava']
  ]
};

export const cloneMap = (map: TerrainMap): TerrainMap => map.map(row => [...row]);
