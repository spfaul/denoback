class ParticleManager {
  constructor() {
    this.groups = new Map();
  }

  createParticleGroup(name, opts = {}) {
    let pg = new Group();
    Object.assign(pg, opts);
    this.groups.set(name, pg);
  }

  spawn(pgName, numParticles, velRange, opts = {}) {
    let pg = this.get(pgName);
    let particles = [];
    for (let i = 0; i < numParticles; i++) {
      let s = new pg.Sprite();
      Object.assign(s, opts);
      s.vel = createVector(
        random(velRange[0][0], velRange[0][1]),
        random(velRange[1][0], velRange[1][1])
      );
      particles.push(s);
    }
    return particles;
  }

  get(pgName) {
    return this.groups.get(pgName);
  }
}
