class Button {
  constructor(x, y, w, h, onPress, opts) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.onPress = onPress;
    this.opts = opts;
    this.prevClick = false;
  }

  update() {
    let isHover =
      mouseX > this.x &&
      mouseX < this.x + this.w &&
      mouseY > this.y &&
      mouseY < this.y + this.h;
    if (isHover && this.opts.hoverColor) fill(this.opts.hoverColor);
    else if (this.opts.defaultColor) fill(this.opts.defaultColor);
    else fill(color(240, 240, 240));
    let isClick = mouseIsPressed && mouseButton === LEFT;
    if (!isClick) this.prevClick = false;
    if (isHover && isClick && !this.prevClick) {
      this.prevClick = true;
      this.onPress();
    }
    this.prevClick = isHover && isClick;

    rect(this.x, this.y, this.w, this.h, 100);

    if (this.opts.text && this.opts.textSize) {
      if (!this.opts.textColor)
        fill("black");
      else
        fill(this.opts.textColor);
      textSize(this.opts.textSize);
      textAlign(CENTER, CENTER);
      text(this.opts.text, this.x, this.y, this.w, this.h);
    }
  }

  setDimensions(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }
}

class Menu {
  constructor() {
    this.newRoomBtn = new Button(
      width / 2 - width / 5,
      height / 5,
      (width * 2) / 5,
      height / 10,
      () => this.requestRoom(),
      {
        hoverColor: "#EEECE0",
        defaultColor: "white",
        text: "Create Room",
        textSize: 32,
      }
    );
    this.roomCodeInp = createInput()
      .addClass("form-control")
      .style("height", "70px")
      .style("font-size", "30px")
      .style("border-radius", "50px")
      .attribute("placeholder", "Room Code (e.g. abc12)")
      .attribute("maxlength", 5)
      .input(() => this.joinRoom());
    this.ignInp = createInput()
      .addClass("form-control")
      .style("height", "40px")
      .style("font-size", "30px")
      .style("border-radius", "50px")
      .attribute("placeholder", "IGN (e.g. Gary21)")
      .attribute("maxlength", 20);
    this.selectedDino = "doux";
    this.updateDino(this.selectedDino);

    // Overlay
    this.danger_perc = 0;
    this.countdownStr = null;
    this.event = null;
    this.startGameBtn = new Button(
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
        textSize: 24,
        textColor: "white"
      }
    );
    this.winnerName = "";
    this.fps = null;
    this._fpsStartTime = null;
  }

  preload() {
    this.dinoPreviewImgs = {
      doux: loadImage("./assets/doux_preview.png"),
      mort: loadImage("./assets/mort_preview.png"),
      tard: loadImage("./assets/tard_preview.png"),
      vita: loadImage("./assets/vita_preview.png"),
    };
  }

  requestRoom() {
    if (!ioClient.connected) return;
    ioClient.emit("createRoom", this.selectedDino, this.ignInp.value());
  }

  joinRoom() {
    const roomId = this.roomCodeInp.value();
    if (roomId.length !== 5) return;
    ioClient.emit("joinRoom", roomId, this.selectedDino, this.ignInp.value());
  }

  hide() {
    this.roomCodeInp.style("display", "none");
    this.ignInp.style("display", "none");
  }

  show() {
    this.roomCodeInp.style("display", "block");
    this.ignInp.style("display", "block");
  }

  getOffset(el) {
    // Taken from:
    // https://stackoverflow.com/questions/442404/retrieve-the-position-x-y-of-an-html-element
    var _x = 0;
    var _y = 0;
    while (el && !isNaN(el.offsetLeft) && !isNaN(el.offsetTop)) {
      _x += el.offsetLeft - el.scrollLeft;
      _y += el.offsetTop - el.scrollTop;
      el = el.offsetParent;
    }
    return { top: _y, left: _x };
  }

  updateDino(dinoName) {
    this.selectedDino = dinoName;
    this.dino = loadAnimation(imgs[this.selectedDino], {
      frameSize: [24, 24],
      frames: 18,
    });
    this.dino.frameDelay = 10;
    this.dino.scale = 3;
  }

  update() {
    push();
    textSize(20);
    textAlign(LEFT, TOP);
    text("Server Status: ", 30, 30, width, 30);
    if (ioClient.connected) fill("green");
    else fill("red");
    text(ioClient.connected ? "Connected" : "Disconnected", 160, 30, width, 30);
    const roomCodeInpWidthPx = max(width / 4, 400);
    const canv_elemt = document.getElementById("defaultCanvas0");
    const canv_off = this.getOffset(canv_elemt);
    this.roomCodeInp.position(
      canv_off.left + width / 2 - roomCodeInpWidthPx / 2,
      canv_off.top + height / 2
    );
    this.roomCodeInp.style("width", `${roomCodeInpWidthPx}px`);
    this.newRoomBtn.setDimensions(
      width / 2 - roomCodeInpWidthPx / 2,
      height / 5,
      roomCodeInpWidthPx,
      height / 10
    );
    this.newRoomBtn.update();
    if (this.roomCodeInp.value()) {
      fill("red");
      textSize(32);
      textAlign(CENTER, CENTER);
      text(
        "X",
        width / 2 + roomCodeInpWidthPx / 2 + 20,
        height / 2,
        30,
        height / 10
      );
    }
    this.dino.x = width / 8;
    this.dino.y = height / 5;
    animation(this.dino, this.dino.x, this.dino.y);
    let dino_offx = this.dino.x - 100;
    let dino_offy = this.dino.y + 50;
    for (let [dinoName, img] of Object.entries(this.dinoPreviewImgs)) {
      img.resize(50, 0);
      if (
        mouseIsPressed &&
        mouseX > dino_offx &&
        mouseX < dino_offx + img.width &&
        mouseY > dino_offy &&
        mouseY < dino_offy + img.height
      ) {
        this.updateDino(dinoName);
      }
      image(this.dinoPreviewImgs[dinoName], dino_offx, dino_offy);
      dino_offx += img.width;
    }
    const ignroomCodeInpWidthPx = 300;
    this.ignInp.position(
      max(canv_off.left + width / 8 - ignroomCodeInpWidthPx / 2, canv_off.left),
      canv_off.top + height / 5 + 100
    );
    this.ignInp.style("width", `${ignroomCodeInpWidthPx}px`);
    pop();
  }

  setWinner(name) {
    this.winnerName = name;
    const WINNER_DISPLAY_DURATION_MS = 5000;
    this._winnerDisplayStart = +new Date();
    this._winnerDisplayEnd =
      this._winnerDisplayStart + WINNER_DISPLAY_DURATION_MS;
  }

  drawGameOverlay() {
    if (!player) {
      push();
      textAlign(CENTER, CENTER);
      text("Retrieving Game Info...", 0, 0, width, height);
      pop();
      return;
    }

    push();
    stroke(0);
    fill("white");
    strokeWeight(3);
    textSize(25);
    textAlign(LEFT, TOP);
    text("Room Id: " + ioClient.roomId, 20, 20, width, 50);
    textAlign(RIGHT, TOP);
    if (!this._fpsStartTime || +new Date() - this._fpsStartTime > 250) {
      this.fps = getFPS();
      this._fpsStartTime = +new Date();
    }
    text(`FPS: ${this.fps}`, 0, 20, width - 20, 50);
    text(`Ping: ${latency}ms`, 0, 50, width - 20, 50);

    const BAR_TRANSITION_SMOOTHNESS = 20;
    if (this.danger_perc < player.knockback / MAX_KNOCKBACK)
      this.danger_perc +=
      player.knockback / MAX_KNOCKBACK / BAR_TRANSITION_SMOOTHNESS;
      else this.danger_perc = player.knockback / MAX_KNOCKBACK;
      
      if (this.danger_perc < 0.3) fill(color(10, 200, 10));
      else if (this.danger_perc < 0.5) fill(color(255, 248, 36));
      else if (this.danger_perc < 0.8) fill(color(255, 131, 26));
      else fill(color(255, 36, 36));
      
    rect(width / 3, 50, this.danger_perc * (width / 3), 40);
    fill(color(0, 0, 0, 0));
    rect(
      width / 3,
      50,
      (width / 3),
      40,
    );
    textAlign(CENTER, CENTER);
    stroke(0);
    fill("white");
    text(
      `Danger: ${Math.round(player.knockback * 100)}%`,
      width / 3,
      50,
      width / 3,
      40
    );

    stroke(0);
    fill("white");
    let playerCountText = "";
    if (entities.size === 0) {
      playerCountText += "Waiting For More Players...\n";
    }
    playerCountText += `Players: ${entities.size + 1}`;
    textAlign(LEFT, TOP);
    textSize(25);
    text(playerCountText, 20, 100, width, height);
    if (ioClient.isRoomHost && entities.size && this.countdownStr === null) {
      strokeWeight(4);
      this.startGameBtn.setDimensions(width / 2 - 100, height / 6, 200, 50);
      this.startGameBtn.update();
    }
    if (this.countdownStr) {
      textSize(70);
      textAlign(CENTER, CENTER);
      text(this.countdownStr, 0, 0, width, (height * 3) / 4);
    }

    if (this.event) {
      textSize(40);
      stroke(0);
      strokeWeight(4);
      fill("yellow");
      textAlign(CENTER, CENTER);
      text(
        `Event Active: ${this.event.eventName}`,
        0,
        (height * 3) / 4,
        width,
        (height * 1) / 4
      );
    }

    if (this.winnerName) {
      textSize(50);
      noStroke();
      const opacity = map(
        +new Date(),
        this._winnerDisplayStart,
        this._winnerDisplayEnd,
        255,
        0
      );
      fill(180, 0, 158, opacity);
      textAlign(CENTER, CENTER);
      text(`${this.winnerName} Wins!`, 0, 0, width, (height * 3) / 4);
      if (opacity <= 0) {
        this.winnerName = "";
      }
    }

    if (player.lives !== null) {
      if (imgs.skull.width !== 30 || imgs.heart.width !== 30) {
        imgs.skull.resize(30, 0);
        imgs.heart.resize(30, 0);
      }
      const total_width =
        imgs.heart.width * player.lives + imgs.skull.width * (3 - player.lives);
      for (let i = 0; i < player.lives; i++) {
        image(
          imgs.heart,
          width / 2 + i * imgs.heart.width - total_width / 2,
          10
        );
      }
      for (let j = 0; j < 3 - player.lives; j++) {
        image(
          imgs.skull,
          width / 2 +
            player.lives * imgs.heart.width +
            j * imgs.skull.width -
            total_width / 2,
          10
        );
      }
    }
    pop();
  }
}
