/**
 * Collision-checked BFS storage. Five six-bit tiles fit in each word; rooted cells
 * never enter the key. Records and hash buckets use typed arrays rather than one
 * string, tuple and Move object per visited board.
 */
const BLOCK = 16_384;

// Packed keys use five six-bit tiles per word and two 16-bit counters.
export const TILE_BITS = 6;
export const TILES_PER_WORD = 5;
export const FIELD_BITS = 16;
export const TILE_MASK = (1 << TILE_BITS) - 1;
export const FIELD_MASK = (1 << FIELD_BITS) - 1;

export class SolverStates {
  private readonly blocks: Uint32Array[] = [];
  private buckets = new Uint32Array(1024);
  private readonly stride: number;
  size = 0;

  constructor(readonly words: number) {
    this.stride = words + 2; // key, parent index, encoded move
  }

  private hash(key: Uint32Array): number {
    let h = 0x811c9dc5;
    for (let i = 0; i < this.words; i++) h = Math.imul(h ^ key[i], 0x01000193);
    // Avalanche the upper bits too: neighbouring rotations often differ there.
    h ^= h >>> 16;
    h = Math.imul(h, 0x85ebca6b);
    return (h ^ (h >>> 13)) >>> 0;
  }

  private record(id: number): Uint32Array {
    const offset = (id % BLOCK) * this.stride;
    return this.blocks[Math.floor(id / BLOCK)].subarray(offset, offset + this.stride);
  }

  private slot(key: Uint32Array): number {
    const mask = this.buckets.length - 1;
    let slot = this.hash(key) & mask;
    search: while (this.buckets[slot]) {
      const id = this.buckets[slot] - 1;
      const block = this.blocks[Math.floor(id / BLOCK)];
      const offset = (id % BLOCK) * this.stride;
      for (let i = 0; i < this.words; i++) {
        if (block[offset + i] !== key[i]) {
          slot = (slot + 1) & mask;
          continue search;
        }
      }
      break;
    }
    return slot;
  }

  /** Existing keys return -1; new keys get consecutive BFS indices. */
  add(key: Uint32Array, parent: number, move: number): number {
    let slot = this.slot(key);
    if (this.buckets[slot]) return -1;
    if ((this.size + 1) * 10 > this.buckets.length * 7) {
      this.buckets = new Uint32Array(this.buckets.length * 2);
      for (let id = 0; id < this.size; id++) this.buckets[this.slot(this.record(id))] = id + 1;
      slot = this.slot(key);
    }
    const id = this.size++;
    if (id % BLOCK === 0) this.blocks.push(new Uint32Array(BLOCK * this.stride));
    const record = this.record(id);
    for (let i = 0; i < this.words; i++) record[i] = key[i];
    record[this.words] = parent;
    record[this.words + 1] = move;
    this.buckets[slot] = id + 1;
    return id;
  }

  read(id: number): Uint32Array {
    return this.record(id);
  }
}
