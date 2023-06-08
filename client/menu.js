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
      textSize(this.opts.textSize);
      textAlign(CENTER, CENTER);
      fill(color(0, 0, 0));
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
      this.requestRoom,
      {
        hoverColor: "#EEECE0",
        defaultColor: "white",
        text: "Create Room",
        textSize: 32,
      }
    );
    this.roomCodeInp = createInput();
    this.roomCodeInp.addClass("form-control");
    this.roomCodeInp.style("height", "70px");
    this.roomCodeInp.style("font-size", "30px");
    this.roomCodeInp.style("border-radius", "50px");
    this.roomCodeInp.attribute("placeholder", "Room Code (e.g. abc12)");
    this.roomCodeInp.attribute("maxlength", 5);
    this.roomCodeInp.input(this.joinRoom);
  }

  requestRoom() {
    if (!ioClient.connected) return;
    ioClient.emit("createRoom");
  }

  joinRoom() {
    const roomId = this.value();
    if (roomId.length !== 5) return;
    ioClient.emit("joinRoom", roomId);
  }

  hide() {
    this.roomCodeInp.style("display", "none");
  }

  show() {
    this.roomCodeInp.style("display", "block");
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

  update() {
    push();
    textSize(20);
    textAlign(LEFT, TOP);
    text("Server Status: ", 30, 30, width, 30);
    if (ioClient.connected) fill("green");
    else fill("red");
    text(ioClient.connected ? "Connected" : "Disconnected", 160, 30, width, 30);
    let inp_width_px = max(width / 4, 400);
    const canv_elemt = document.getElementById("defaultCanvas0");
    const canv_off = this.getOffset(canv_elemt);
    this.roomCodeInp.position(
      canv_off.left + width / 2 - inp_width_px / 2,
      canv_off.top + height / 2
    );
    this.roomCodeInp.style("width", `${inp_width_px}px`);
    this.newRoomBtn.setDimensions(
      width / 2 - inp_width_px / 2,
      height / 5,
      inp_width_px,
      height / 10
    );
    this.newRoomBtn.update();
    if (this.roomCodeInp.value()) {
      fill("red");
      textSize(32);
      textAlign(CENTER, CENTER);
      // let inp_off = this.getOffset(this.roomCodeInp.elt);
      text("X", width / 2 + inp_width_px / 2 + 20, height / 2, 30, height / 10);
    }
    pop();
  }
}
