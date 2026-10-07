export class AccountScope {
  identity: string | null = null;
  generation = 0;
  setIdentity(value: string | null) {
    if (this.identity === value) return false;
    this.identity = value;
    this.generation++;
    return true;
  }
  capture() {
    return { identity: this.identity, generation: this.generation };
  }
  current(value: { identity: string | null; generation: number }) {
    return (
      value.identity === this.identity && value.generation === this.generation
    );
  }
}
