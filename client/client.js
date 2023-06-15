const ioClient = io.connect("wss://denoback.onrender.com");
// const ioClient = io.connect("ws://172.104.54.249");
let entities = new Map();
let player, playerPast, mapData;
let gameState = "menu";
let imgs;
let menu;
let bg;
let pm;
let startGameBtn;
let countdownStr = null;
const TP_COOLDOWN_MS = 3000;
const MAX_KNOCKBACK = 5;

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible")
    ioClient.emit("activeState", true);
  else if (document.visibilityState === "hidden")
    ioClient.emit("activeState", false);
});

ioClient.on("buildMapData", (_mapData) => {
  allSprites.removeAll();
  if (mapData) {
    // p5play does not cleanup empty groups so we'll do it ourselves
    delete p5play.groups[buls.idNum];
    for (let p of mapData.platforms) delete p5play.groups[p.idNum];
  }
  mapData = _mapData;
  mapData.platforms = [];
  for (const [gName, gData] of Object.entries(_mapData.groups)) {
    let grp = new Group();
    Object.assign(grp, gData);
    new Tiles(gData.tiles.map, gData.tiles.x, gData.tiles.y, gData.w, gData.h);
    mapData.platforms.push(grp);
  }
  // buls = new Group();
  // buls.color = "cyan";
  // buls.r = 5;
  createPlayer();
  camera.target = player;

  playerPast = spawnSprite("PAST_PLAYER" + ioClient.id);

  gameState = "play";
  menu.hide();

  bg = new ParallaxLayer(mapData.bg);
  bg.load();

  // p5play draws over our draw() loop, so we
  // have to jump thru hoops to draw our text
  // over our sprites...... by making a another
  // sprite. appauling.
  let text_layer = new Sprite();
  text_layer.visible = false;
  text_layer.collider = "none";
  text_layer.update = drawGameText;
  text_layer.r = 0;
});

let danger_perc = 0;
function drawGameText() {
  if (!player) {
    push();
    textAlign(CENTER, CENTER);
    text("Retrieving Game Info...", 0, 0, width, height);
    pop();
    return;
  }

  push();
  textSize(25);
  textAlign(LEFT, TOP);
  text("Room Id: " + ioClient.roomId, 20, 20, width, 50);
  textAlign(RIGHT, TOP);
  text(`Ping: ${latency}ms`, 0, 100, width - 20, 50);
  
  const BAR_TRANSITION_SMOOTHNESS = 20;
  if (danger_perc < player.knockback / MAX_KNOCKBACK)
    danger_perc += player.knockback / MAX_KNOCKBACK / BAR_TRANSITION_SMOOTHNESS;
  else
    danger_perc = player.knockback / MAX_KNOCKBACK;

  if (danger_perc < .3)
    fill(color(10,200,10));
  else if (danger_perc < .5)
    fill(color(255,248,36));
  else if (danger_perc < .8)
    fill(color(255, 131, 26));
  else
    fill(color(255, 36, 36));

  rect(width/3, 50, danger_perc * (width/3), 40);
  fill(color(0,0,0,0));
  rect(width/3 + danger_perc * (width/3), 50, (1-danger_perc) * (width/3), 40)
  textAlign(CENTER, CENTER);
  fill("black");
  text(`Danger: ${Math.round(player.knockback * 100)}%`, width/3, 50, width/3, 40);

  let playerCountText = "";
  if (entities.size === 0) {
    playerCountText += "Waiting For More Players...\n";
  }
  playerCountText += `Players: ${entities.size + 1}`;
  textAlign(LEFT, TOP);
  textSize(25);
  text(playerCountText, 20, 100, width, height);
  if (ioClient.isRoomHost && entities.size && countdownStr === null) {
    startGameBtn.setDimensions(width / 2 - 100, height / 6, 200, 50);
    startGameBtn.update();
  }
  if (countdownStr) {
    textSize(70);
    textAlign(CENTER, CENTER);
    text(countdownStr, 0, 0, width, (height * 3) / 4);
  }

  if (player.lives !== null) {
    imgs.skull.resize(30,0);
    imgs.heart.resize(30,0);
    const total_width = imgs.heart.width * player.lives + imgs.skull.width * (3-player.lives);
    for (let i=0; i<player.lives; i++) {
      image(imgs.heart, width/2+i*imgs.heart.width-total_width/2, 10);
    }
    for (let j=0; j<3-player.lives; j++) {
      image(imgs.skull, width/2+player.lives*imgs.heart.width+j*imgs.skull.width-total_width/2, 10);
    }
  }
  pop();
}

function createPlayer() {
  player = spawnSprite("PLAYER" + ioClient.id, 0, 0, menu.selectedDino);
  player.positionBuff = [
    {
      ts: +new Date(),
      x: player.x,
      y: player.y,
    },
  ];
  player.knockback = 0.1;
  player.lastTp = 0;
  player.locked = false;
  player.lives = null;
  player.respawn = (x, y) => {
    // Nasty hack. Accounts for server sometimes
    // signalling client respawn while client is respawning.
    if (player.positionBuff.length < 5) return;
    spawnParticles("death", player.x, player.y);
    ioClient.emit("particles", "death", player.x, player.y);
    player.x = x;
    player.y = y;
    player.vel = createVector(0, 0);
    player.positionBuff = [
      {
        ts: +new Date(),
        x: player.x,
        y: player.y,
      },
    ];
    player.knockback = 0.1;
  };
  ioClient.on("respawn", player.respawn);
}

function spawnSprite(id, x, y, dino = "") {
  let s = new Sprite(x, y);
  if (id.startsWith("PLAYER")) {
    s.w = 32;
    s.h = 32;
    s.anis.w = 24;
    s.anis.h = 24;
    s.spriteSheet = imgs[dino];
    s.addAnis({
      idle: { row: 0, frames: 1 },
      run: { row: 0, col: 3, frames: 7 },
      punch: { row: 0, col: 11, frames: 3 },
    });
    s.anis.frameDelay = 4;
    s.anis.punch.frameDelay = 15;
    s.animations.scale = 2;
    s.ani = "idle";
    s.friction = 0;
    s.rotationLock = true;
    s.jumps = 0;
  } else if (id.startsWith("PAST_PLAYER")) {
    s.r = 5;
    s.collider = "none";
    if (id === "PAST_PLAYER" + ioClient.id) s.color = color(0, 0, 250, 100);
    else s.color = color(250, 0, 0, 100);
    s.layer = 2;
  } else if (id.startsWith("STATS")) {
    s.collider = "none";
    s.draw = () => {
      let entData = entities.get(id.substring(5));
      if (!entData) return;
      imgs.miniHeart.resize(15,0);
      const total_width = imgs.miniHeart.width * entData.lives;
      imageMode(LEFT, TOP);
      for (let i=0; i<entData.lives; i++) {
        // Center hearts over player body
        image(imgs.miniHeart, i*imgs.miniHeart.width-total_width/2+entData.sprite.w/4, -30);
      }
    };
  }
  return s;
}

function jump() {
  if (player.jumps >= 2) return;

  player.vel.y = -10;
  player.jumps++;
}

ioClient.on("pos", (selfId, datas) => {
  for (const data of datas) {
    if (data.id === selfId) {
      player.lives = data.lives;
      continue;
    };
    let currData = entities.get(data.id);
    if (currData === undefined) {
      entities.set(data.id, {
        sprite: spawnSprite("PLAYER" + data.id, data.x, data.y, data.dino),
        shadow: spawnSprite("PAST_PLAYER" + data.id),
        stats: spawnSprite("STATS" + data.id, data.x, data.y),
        positionBuff: [],
        lastUpdated: data.lastUpdated,
        lives: data.lives,
      });
      continue;
    }
    if (currData.lastUpdated > data.lastUpdated) continue;
    currData.shadow.x = data.tx;
    currData.shadow.y = data.ty;
    currData.shadow.visible = data.tvis;
    currData.sprite.x = data.x;
    currData.sprite.y = data.y;
    currData.stats.pos = currData.sprite.pos;
    currData.sprite.vel.x = data.vx;
    currData.sprite.vel.y = data.vy;
    currData.sprite.ani = data.ani;
    currData.lives = data.lives;
    currData.sprite.visible = data.lives !== 0;
    currData.sprite.mirror.x = data.flipXAni;
    currData.lastUpdated = data.lastUpdated;
    currData.positionBuff.push([
      +new Date(),
      currData.sprite.x,
      currData.sprite.y,
    ]);
  }
});

ioClient.on("setPlayerLock", (doLock) => {
  player.static = doLock;
});

ioClient.on("updateCountdown", (s) => {
  countdownStr = s;
});

ioClient.on("createBul", (x, y, vx, vy) => {
  let b = new buls.Sprite();
  b.x = x;
  b.y = y;
  b.vel.x = vx;
  b.vel.y = vy;
});

ioClient.on("disconnect", () => {
  pendingInps = [];
  entities = new Map();
});

ioClient.on("updateRoom", (newRoomId) => {
  ioClient.roomId = newRoomId;
  pendingInps = [];
  entities = new Map();
});

ioClient.on("updateRoomRole", (isHost) => {
  ioClient.isRoomHost = isHost;
});

ioClient.on("removeEnt", (id) => {
  let e = entities.get(id);
  if (e === undefined) return;
  e.sprite.remove();
  e.shadow.remove();
  e.stats.remove();
  entities.delete(id);
});

ioClient.on("dead", () => {
  if (!entities.size) return;
  player.visible = false;
  player.collider = "static";
  camera.target = Array.from(entities.values())[0].sprite;
});

ioClient.on("reset", () => {
  player.visible = true;
  player.collider = "dynamic";
  camera.target = player;
});

function preload() {
  imgs = {
    doux: loadImage("./assets/doux.png"),
    mort: loadImage("./assets/mort.png"),
    tard: loadImage("./assets/tard.png"),
    vita: loadImage("./assets/vita.png"),
    heart: loadImage("./assets/heart.png"),
    miniHeart: loadImage("assets/heart.png"), // p5js returns same img object if url params are the same
                                              // but we need to manipulate both seperately...
    skull: loadImage("./assets/skull.png")
  };
  menu = new Menu();
  menu.preload();
}

function windowResized() {
  const MAX_CANV_HEIGHT = 864;
  const MAX_CANV_WIDTH = 1536;
  const ASPECT_RATIO = MAX_CANV_HEIGHT / MAX_CANV_WIDTH;

  windowWidth = min(MAX_CANV_WIDTH, windowWidth);
  const desired_height = min(windowWidth * ASPECT_RATIO, windowHeight);
  resizeCanvas(windowWidth, desired_height);
  world.resize(windowWidth, desired_height);
}

function setup() {
  ioClient.roomId = "";
  // p5play.playIntro = () => {}; // Override builtin splash screen
  new Canvas("fullscreen");
  frameRate(60);
  textFont("Changa");
  windowResized();
  camera.true_scroll = [0, 0];
  world.gravity.y = 20;
  allSprites.autoCull = false;
  pm = new ParticleManager();
  pm.createParticleGroup("tp", {
    color: color(85, 23, 255),
    r: 4,
    collider: "none",
  });
  pm.createParticleGroup("death", {
    color: color(255, 0, 0),
    width: 20,
    height: 20,
    autoCull: false,
  });
  startGameBtn = new Button(
    width / 2 - 100,
    height / 6,
    200,
    50,
    () => {
      ioClient.emit("requestGameStart");
    },
    {
      hoverColor: "#EEECE0",
      defaultColor: "white",
      text: "Start Game",
      textSize: 28,
    }
  );
}

let latency = 0;
setInterval(() => {
  if (!ioClient.connected) return;
  const start = Date.now();
  ioClient.emit("ping", () => {
    latency = Date.now() - start;
  });
}, 1000);

function draw() {
  background(220);
  if (gameState === "menu") drawMenu();
  else if (gameState === "play") {
    if (!gameIsLoaded()) drawLoading();
    else drawGame();
  }
}

function gameIsLoaded() {
  return bg && bg.loaded && player && playerPast;
}

function drawLoading() {
  // Platforms can be visible during loading as they are instantiated
  // first so ill just hide them nicely
  allSprites.visible = false;
  push();
  textSize(32);
  textAlign(CENTER, CENTER);
  text("Loading...", 0, 0, width, height);
  pop();
}

function drawMenu() {
  menu.update();
}

function drawGame() {
  if (!allSprites.visible) {
    allSprites.visible = true;
  }

  bg.update(player.pos);

  // strafing
  const speed = 1;
  let moved = false;
  if (kb.pressing("a") || kb.pressing("A")) {
    player.vel.x -= speed;
    player.mirror.x = true;
    moved = true;
  }
  if (kb.pressing("d") || kb.pressing("D")) {
    player.vel.x += speed;
    player.mirror.x = false;
    moved = true;
  }
  player.vel.x *= 0.9;
  // punching
  if (player.ani.name === "punch" && player.ani.frame === player.ani.lastFrame)
    player.ani = "idle";
  if (!moved && player.ani.name !== "punch") {
    player.ani = "idle";
    player.animations.run.play(0);
  }
  if (moved && player.ani.name !== "punch") {
    player.ani = "run";
  }
  // jumping
  for (const g of mapData.platforms) {
    if (player.collides(g)) {
      let closest_tile = null;
      let closest_tile_dist = Infinity;
      for (i = 0; i < g.size(); i++) {
        let d = dist(g[i].x, g[i].y, player.x, player.y);
        if (closest_tile === null || d < closest_tile_dist) {
          closest_tile = g[i];
          closest_tile_dist = d;
        }
      }
      const angle_to_closest_tile = player.angleTo(
        closest_tile.x,
        closest_tile.y
      );
      // Only replenish jumps if player is colliding top surface of platform
      if (angle_to_closest_tile > 0) player.jumps = 0;
      break;
    }
  }
  if (kb.presses(" ")) jump();
  // camera adjust
  camera.true_scroll[0] += (camera.target.x - camera.true_scroll[0]) / 15;
  camera.true_scroll[1] += (camera.target.y - camera.true_scroll[1]) / 15;
  camera.x = camera.true_scroll[0];
  camera.y = camera.true_scroll[1];

  // self punch knockback
  for (const pData of entities.values()) {
    const pSprite = pData.sprite;
    if (pSprite === player) continue;
    /*
    Punched directly left of punching -> punchAngle = 0 degrees
    Punched directly right of punching -> punchAngle = -180/180 degrees
    For punch to be considered valid (prevent top-down punches):
      punchAngle = Punched must be directly left/right of punching +- MAX_PUNCH_ANGLE
    */
    const MAX_PUNCH_ANGLE = 40;
    const punchAngle = player.angleTo(pSprite.x, pSprite.y);
    const isValidPunchAngle =
      (-MAX_PUNCH_ANGLE < punchAngle && punchAngle < MAX_PUNCH_ANGLE) ||
      -180 + MAX_PUNCH_ANGLE > punchAngle ||
      punchAngle > 180 - MAX_PUNCH_ANGLE;
    if (
      player.colliding(pSprite) &&
      pSprite.ani.name === "punch" &&
      isValidPunchAngle
    ) {
      const PUNCH_KNOCKBACK_MULTIPLIER = 1.3;
      player.moveAway(pSprite.x, pSprite.y, player.knockback);
      player.knockback *= PUNCH_KNOCKBACK_MULTIPLIER;
      player.knockback = min(player.knockback, MAX_KNOCKBACK);
    }
  }
  // send player info
  ioClient.emit("update", {
    x: player.x,
    y: player.y,
    vx: player.vel.x,
    vy: player.vel.y,
    ani: player.ani.name,
    flipXAni: player.mirror.x,
    tx: playerPast.x,
    ty: playerPast.y,
    tvis: playerPast.visible,
  });
  // render other players
  let render_timestamp = +new Date() - 1000.0 / 50;
  for (const [id, data] of entities) {
    if (id == "PLAYER-" + ioClient.id) {
      player.vel.limit(10);
      continue;
    }
    // Interpolation between server updates for non-player entities
    while (
      data.positionBuff.length >= 2 &&
      data.positionBuff[1][0] <= render_timestamp
    ) {
      data.positionBuff.shift();
    }
    if (
      data.positionBuff.length >= 2 &&
      data.positionBuff[0][0] <= render_timestamp &&
      render_timestamp <= data.positionBuff[1][0]
    ) {
      let x0 = data.positionBuff[0][1];
      let x1 = data.positionBuff[1][1];
      let y0 = data.positionBuff[0][2];
      let y1 = data.positionBuff[1][2];
      let t0 = data.positionBuff[0][0];
      let t1 = data.positionBuff[1][0];

      data.sprite.x = x0 + ((x1 - x0) * (render_timestamp - t0)) / (t1 - t0);
      data.sprite.y = y0 + ((y1 - y0) * (render_timestamp - t0)) / (t1 - t0);
    }
  }

  if (+new Date() - player.lastTp >= TP_COOLDOWN_MS) playerPast.visible = true;
  if (player.positionBuff.length > 120) player.positionBuff.shift();
  if (frameCount % 30) {
    player.positionBuff.push({
      ts: +new Date(),
      x: player.x,
      y: player.y,
    });
  }
  const past_player_pos = player.positionBuff[0];
  if (past_player_pos) {
    playerPast.x = past_player_pos.x;
    playerPast.y = past_player_pos.y;
  }
}

function mousePressed() {
  if (!player || !ioClient.roomId) return;
  if (mouseButton === LEFT) punch();
  else if (mouseButton === RIGHT) tp();
  // fire bullet
  // let desired = p5.Vector.sub(createVector(mouseX-width/2+camera.x, mouseY-height/2+camera.y), createVector(player.x, player.y));
  // desired.normalize();
  // desired.mult(20);
  // ioClient.emit("spawnBul", player.x+desired.x, player.y+desired.y, desired.x, desired.y);
}

function tp() {
  const now_ts = +new Date();
  if (now_ts - player.lastTp < TP_COOLDOWN_MS) return;
  spawnParticles("tp", player.x, player.y);
  ioClient.emit("particles", "tp", player.x, player.y);
  player.pos = playerPast.pos;
  playerPast.visible = false;
  player.lastTp = now_ts;
}

function spawnParticles(name, x, y) {
  if (name === "tp")
    pm.spawn(
      "tp",
      10,
      [
        [-50, 50],
        [-50, 50],
      ],
      { x: x, y: y, life: 60 * 3 }
    );
  else if (name === "death")
    pm.spawn(
      "death",
      20,
      [
        [-100, 100],
        [0, -200],
      ],
      { x: x, y: y, life: 60 * 3 }
    );
}

ioClient.on("particles", spawnParticles);

function punch() {
  if (player.ani.name === "punch") return;
  const PUNCH_THRUST = 5;
  if (player.mirror.x) player.vel.x -= PUNCH_THRUST;
  else player.vel.x += PUNCH_THRUST;
  player.ani = "punch";
  player.ani.play(0);
}
