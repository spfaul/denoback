// const ioClient = io.connect("wss://denoback.onrender.com");
const ioClient = io.connect("ws://172.104.54.249");
const TP_COOLDOWN_MS = 3000;
let roomId = "";
let entities = new Map();
let charImg;
let allPlayers = [];
let player, playerPast, buls, mapData;
let gameState = "menu";
let menu;
let bg;

ioClient.on("buildMapData", _mapData => {
  allSprites.removeAll();
  if (mapData) {
    // p5play does not cleanup empty groups so we'll do it ourselves 
    delete p5play.groups[buls.idNum]
    for (let p of mapData.platforms)
      delete p5play.groups[p.idNum]
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

  playerPast = spawnSprite({
    id: "PAST_PLAYER"+ioClient.id
  });

  gameState = "play";
  menu.hide();

  bg = new ParallaxLayer(mapData.bg);
  bg.load(() => {}); // TODO
});

function createPlayer() {
  player = spawnSprite({
    x: 0,
    y: 0,
    id: "PLAYER"+ioClient.id
  });
  player.positionBuff = [{
    ts: +new Date(),
    x: player.x,
    y: player.y
  }];
  player.knockback = 0.1;
  player.lastTp = 0;
  player.respawn = () => {
    player.x = random(...mapData.spawnPoint.xRange);
    player.y = random(...mapData.spawnPoint.yRange);
    player.vel = createVector(0, 0);
    player.positionBuff = [{
      ts: +new Date(),
      x: player.x,
      y: player.y
    }];
    player.knockback = 0.1;
  }
  player.respawn();
  ioClient.on("respawn", player.respawn);
}

function spawnSprite(data) {
    let s = new Sprite(data.x, data.y);
    if (data.id.startsWith("PLAYER")) {
        s.w = 32;
        s.h = 32;
        s.anis.w = 24;
        s.anis.h = 24;
        s.spriteSheet = charImg;
        s.addAnis({
          idle: {row: 0, frames: 1},
          run: {row: 0, col: 3, frames: 7},
          punch: {row: 0, col: 11, frames: 3}
        });
        s.anis.frameDelay = 4;
        s.anis.punch.frameDelay = 15;
        s.animations.scale = 2;
        s.ani = 'idle';
        s.friction = 0;
        s.rotationLock = true;
        s.jumps = 0;
        allPlayers.push(s);
    } else if (data.id.startsWith("PAST_PLAYER")) {
      s.r = 5;
      s.collider = "none";
      if (data.id === "PAST_PLAYER"+ioClient.id)
        s.color = color(0,0,250,100);
      else 
        s.color = color(250,0,0,100);
      s.layer = 2;
    }
    return s
}

function jump() {
  if (player.jumps >= 2) return;
  player.vel.y = -10;
  player.jumps++;
}

ioClient.on("pos", (selfId, datas) => {
    for (const data of datas) {
      if (data.id === selfId)
        continue;
      let currData = entities.get(data.id);
      if (currData === undefined) {
        entities.set(data.id, {
          sprite: spawnSprite(data),
          shadow: spawnSprite({id: "PAST_PLAYER"+data.id}),
          positionBuff: [],
          lastUpdated: data.lastUpdated
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
      currData.positionBuff.push([+new Date(), currData.sprite.x, currData.sprite.y]);
    }
});


ioClient.on("createBul", (x, y, vx, vy) => {
  let b = new buls.Sprite();
  b.x = x;
  b.y = y;
  b.vel.x = vx;
  b.vel.y = vy;
})

ioClient.on("disconnect", () => {
  pendingInps = [];
  entities = new Map();
});

ioClient.on("updateRoom", (newRoomId) => {
  // const roomIdInput = document.getElementById("joinRoomId");
  // roomIdInput.value = "";
  roomId = newRoomId;
  pendingInps = [];
  entities = new Map();
});


ioClient.on("removeEnts", ids => {
  for (const id of ids) {
    let e = entities.get(id)
    if (e === undefined)
        continue;
    e.sprite.remove();
    entities.delete(id)
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
  new Canvas("fullscreen");
  frameRate(60)
  windowResized();
  camera.true_scroll = [0,0];
  world.gravity.y = 20;
  allSprites.autoCull = false;
  menu = new Menu();
}

let latency = 0;
setInterval(() => {
  if (!ioClient.connected)
    return;
  const start = Date.now();
  ioClient.emit("ping", () => {
    latency = Date.now() - start;
  });
}, 1000)

function draw() {
  background(220);
  if (gameState === "menu")
    draw_menu();
  else if (gameState === "play")
    draw_game();
}

function draw_menu() {
  menu.update();
}

function draw_game() {
  if (!player) {
    push();
    textAlign(CENTER, CENTER);
    text("Retrieving Game Info...", 0, 0, width, height);
    pop();
    return;
  }

  bg.update(player.pos);
  textSize(25);
  textAlign(LEFT, TOP);
  text("Room Id: " + roomId, 20, 20, width, 50)
  textAlign(RIGHT, TOP);
  text(`Danger: ${Math.round(player.knockback*100)}%`, 0, 20, width-20, 50)
  text(`Ping: ${latency}ms`, 0, 100, width-20, 50)

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
  player.vel.x *= .9;
  // punching
  if (player.ani.name ===  "punch" && player.ani.frame === player.ani.lastFrame)
    player.ani = "idle"
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
      for (i=0; i<g.size(); i++) {
        let d = dist(g[i].x, g[i].y, player.x, player.y);
        if (closest_tile === null || d < closest_tile_dist) {
          closest_tile = g[i];
          closest_tile_dist = d;
        }
      }
      const angle_to_closest_tile = player.angleTo(closest_tile.x, closest_tile.y);
      // Only replenish jumps if player is colliding top surface of platform
      if (angle_to_closest_tile > 0)
        player.jumps = 0;
      break;
    }
  }
  if (kb.presses(" "))
    jump();
  // camera adjust
  camera.true_scroll[0] += (player.x - camera.true_scroll[0])/15;
  camera.true_scroll[1] += (player.y - camera.true_scroll[1])/15;
  camera.x = camera.true_scroll[0];
  camera.y = camera.true_scroll[1];

  // self punch knockback
  for (const p of allPlayers) {
    if (p === player) continue;
    if (player.colliding(p) && p.ani.name === "punch") {
      player.moveAway(p.x, p.y, player.knockback);
      player.knockback *= 1.2;
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
    tvis: playerPast.visible
  });
  // render other players
  let render_timestamp = +new Date() - (1000.0 / 50)
  for (const [id, data] of entities) {
    if (id == "PLAYER-"+ioClient.id) {
      player.vel.limit(10);
      continue
    }
    // Interpolation between server updates for non-player entities
    while (data.positionBuff.length >= 2 && data.positionBuff[1][0] <= render_timestamp) {
      data.positionBuff.shift();
    }
    if (data.positionBuff.length >= 2 && data.positionBuff[0][0] <= render_timestamp && render_timestamp <= data.positionBuff[1][0]) {
      let x0 = data.positionBuff[0][1];
      let x1 = data.positionBuff[1][1];
      let y0 = data.positionBuff[0][2];
      let y1 = data.positionBuff[1][2];
      let t0 = data.positionBuff[0][0];
      let t1 = data.positionBuff[1][0];

      data.sprite.x = x0 + (x1 - x0) * (render_timestamp - t0) / (t1 - t0);
      data.sprite.y = y0 + (y1 - y0) * (render_timestamp - t0) / (t1 - t0);
    }
  }
  
  if (+new Date() - player.lastTp >= TP_COOLDOWN_MS)
    playerPast.visible = true;
  if (player.positionBuff.length > 120)
    player.positionBuff.shift();
  if (frameCount % 30) {
    player.positionBuff.push({
      ts: +new Date(),
      x: player.x,
      y: player.y
    });
  }
  const past_player_pos = player.positionBuff[0]; 
  if (past_player_pos) {
    playerPast.x = past_player_pos.x
    playerPast.y = past_player_pos.y
  }
}

function mousePressed() {
  if (!player || !roomId) return;
  if (mouseButton === LEFT)
    punch();
  else if (mouseButton === RIGHT)
    tp();
  // fire bullet
  // let desired = p5.Vector.sub(createVector(mouseX-width/2+camera.x, mouseY-height/2+camera.y), createVector(player.x, player.y));
  // desired.normalize();
  // desired.mult(20);
  // ioClient.emit("spawnBul", player.x+desired.x, player.y+desired.y, desired.x, desired.y);
}

function tp() {
  const now_ts = +new Date();
  if (now_ts - player.lastTp < TP_COOLDOWN_MS)
    return;
  player.pos = playerPast.pos;
  playerPast.visible = false;
  player.lastTp = now_ts;  
}

function punch() {
  if (player.ani.name === "punch")
    return;
  if (player.mirror.x)
    player.vel.x -= 5;
  else
    player.vel.x += 5;
  player.ani = "punch";
  player.ani.play(0)
}