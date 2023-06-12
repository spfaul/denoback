const ioClient = io.connect("wss://denoback.onrender.com");
// const ioClient = io.connect("ws://172.104.54.249");
let entities = new Map();
let player, playerPast, mapData;
let gameState = "menu";
let charImg;
let menu;
let bg;
let pm;
let startGameBtn
let countdownStr = null;
const TP_COOLDOWN_MS = 3000;

document.addEventListener("visibilitychange", () => {  
  if (document.visibilityState === "visible")
    ioClient.emit("activeState", true);
  else if (document.visibilityState === "hidden")
    ioClient.emit("activeState", false);
})

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

function drawGameText() {
  if (!player) {
    push();
    textAlign(CENTER, CENTER);
    text("Retrieving Game Info...", 0, 0, width, height);
    pop();
    return;
  }

  push()
  textSize(25);
  textAlign(LEFT, TOP);
  text("Room Id: " + ioClient.roomId, 20, 20, width, 50);
  textAlign(RIGHT, TOP);
  text(`Danger: ${Math.round(player.knockback * 100)}%`, 0, 20, width - 20, 50);
  text(`Ping: ${latency}ms`, 0, 100, width - 20, 50);

  let playerCountText = "";
  if (entities.size === 0) {
    playerCountText += "Waiting For More Players...\n";
  }
  playerCountText += `Players: ${entities.size+1}`;
  textAlign(LEFT, TOP);
  textSize(25);
  text(playerCountText, 20, 100, width, height);
  if (ioClient.isRoomHost && entities.size && countdownStr === null) {
    startGameBtn.setDimensions(
      width / 2 - 100,
      height / 10,
      200,
      70
    );
    startGameBtn.update();
  }
  if (countdownStr) {
    textSize(70);
    textAlign(CENTER, CENTER);
    text(countdownStr, 0, 0, width, height*3/4);
  }
  pop()
}

function createPlayer() {
  player = spawnSprite("PLAYER" + ioClient.id, 0, 0);
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

function spawnSprite(id, x, y) {
  let s = new Sprite(x, y);
  if (id.startsWith("PLAYER")) {
    s.w = 32;
    s.h = 32;
    s.anis.w = 24;
    s.anis.h = 24;
    s.spriteSheet = charImg;
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
    if (id === "PAST_PLAYER" + ioClient.id)
      s.color = color(0, 0, 250, 100);
    else s.color = color(250, 0, 0, 100);
    s.layer = 2;
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
    if (data.id === selfId) continue;
    let currData = entities.get(data.id);
    if (currData === undefined) {
      entities.set(data.id, {
        sprite: spawnSprite("PLAYER" + data.id, data.x, data.y),
        shadow: spawnSprite("PAST_PLAYER" + data.id),
        positionBuff: [],
        lastUpdated: data.lastUpdated,
      });
      continue;
    }
    if (currData.lastUpdated > data.lastUpdated) continue;
    currData.shadow.x = data.tx;
    currData.shadow.y = data.ty;
    currData.shadow.visible = data.tvis;
    currData.sprite.x = data.x;
    currData.sprite.y = data.y;
    currData.sprite.vel.x = data.vx;
    currData.sprite.vel.y = data.vy;
    currData.sprite.ani = data.ani;
    currData.sprite.mirror.x = data.flipXAni;
    currData.lastUpdated = data.lastUpdated;
    currData.positionBuff.push([
      +new Date(),
      currData.sprite.x,
      currData.sprite.y,
    ]);
  }
});

ioClient.on("setPlayerLock", doLock => {
  player.static = doLock;
});

ioClient.on("updateCountdown", s => {
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

ioClient.on("updateRoom", (newRoomId, isHost) => {
  ioClient.isRoomHost = isHost;
  ioClient.roomId = newRoomId;
  pendingInps = [];
  entities = new Map();
});

ioClient.on("removeEnts", (ids) => {
  for (const id of ids) {
    let e = entities.get(id);
    if (e === undefined) continue;
    e.sprite.remove();
    e.shadow.remove();
    entities.delete(id);
  }
});

function preload() {
  charImg = loadImage("./assets/doux.png");
}

function windowResized() {
  const MAX_CANV_HEIGHT = 864;
  const MAX_CANV_WIDTH = 1536;
  if (windowWidth > MAX_CANV_WIDTH || windowHeight > MAX_CANV_HEIGHT) {
    resizeCanvas(MAX_CANV_WIDTH, MAX_CANV_HEIGHT);
    return;
  }
  resizeCanvas(windowWidth, windowHeight);
  world.resize(windowWidth, windowHeight);
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
  menu = new Menu();
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
    height / 10,
    200,
    70,
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
  camera.true_scroll[0] += (player.x - camera.true_scroll[0]) / 15;
  camera.true_scroll[1] += (player.y - camera.true_scroll[1]) / 15;
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
    if (player.colliding(pSprite) && pSprite.ani.name === "punch" && isValidPunchAngle) {
      const PUNCH_KNOCKBACK_MULTIPLIER = 1.3;
      player.moveAway(pSprite.x, pSprite.y, player.knockback);
      player.knockback *= PUNCH_KNOCKBACK_MULTIPLIER;
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
