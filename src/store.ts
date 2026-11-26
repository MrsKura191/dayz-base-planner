export interface Piece {
  id: number;
  /** part id */
  t: string;
  x: number;
  y: number;
  z: number;
  /** yaw in radians */
  r: number;
  /** storey the piece belongs to */
  l: number;
}

type Listener = () => void;

/** Holds the pieces of the current design, with undo/redo by snapshot. */
export class Store {
  pieces = new Map<number, Piece>();
  private nextId = 1;
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  private listeners = new Set<Listener>();

  on(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  all(): Piece[] {
    return [...this.pieces.values()];
  }

  private snapshot() {
    return JSON.stringify(this.all());
  }

  private restore(json: string) {
    this.pieces.clear();
    for (const p of JSON.parse(json) as Piece[]) {
      this.pieces.set(p.id, p);
      this.nextId = Math.max(this.nextId, p.id + 1);
    }
  }

  private checkpoint() {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 200) this.undoStack.shift();
    this.redoStack = [];
  }

  add(p: Omit<Piece, 'id'>) {
    this.checkpoint();
    const piece = { ...p, id: this.nextId++ };
    this.pieces.set(piece.id, piece);
    this.emit();
    return piece;
  }

  remove(ids: number[]) {
    if (!ids.length) return;
    this.checkpoint();
    for (const id of ids) this.pieces.delete(id);
    this.emit();
  }

  /** Replace everything (load); clears history. */
  load(pieces: Omit<Piece, 'id'>[]) {
    this.pieces.clear();
    this.nextId = 1;
    for (const p of pieces) {
      const piece = { ...p, id: this.nextId++ };
      this.pieces.set(piece.id, piece);
    }
    this.undoStack = [];
    this.redoStack = [];
    this.emit();
  }

  clear() {
    if (!this.pieces.size) return;
    this.checkpoint();
    this.pieces.clear();
    this.emit();
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  undo() {
    const s = this.undoStack.pop();
    if (s === undefined) return;
    this.redoStack.push(this.snapshot());
    this.restore(s);
    this.emit();
  }

  redo() {
    const s = this.redoStack.pop();
    if (s === undefined) return;
    this.undoStack.push(this.snapshot());
    this.restore(s);
    this.emit();
  }
}
