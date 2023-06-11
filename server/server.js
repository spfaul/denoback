const { readFileSync } = require("fs");
const { createServer } = require("http");
const { Server } = require("socket.io");

const io = new Server(80, {
    cors: {
            origin: "*"
    }
});


let rooms = []
const MAX_ROOMS = 3;
const mapData = JSON.parse(readFileSync('./maps.json'));

function Client(sock) {
    this.sock = sock;
    this.active = true;
    this.id = "PLAYER-" + this.sock.id;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.tx = 0;
    this.ty = 0;
    this.lastUpdated = 0;
    this.room = null;
    this.ani = "idle";
}

class Room {
    constructor(id, mapName) {
        this.clients = [];
        this.host = null;
        this.id = id;
        this.mapName = mapName;
        this.state = "waiting";
    }

    startGame() {
        if (this.state !== "waiting")
            return;
        this.state = "play";
        for (const c of this.clients) {
            c.sock.emit("respawn");
            c.sock.emit("setPlayerLock", true);
        }
        const COUNTDOWN_SECS = 5;
        for (let i=COUNTDOWN_SECS; i>0; i--) {
            setTimeout(() => {
                for (const c of this.clients) {
                    c.sock.emit("updateCountdown", COUNTDOWN_SECS+1-i);
                }
            }, (i-1)*1000)
        }
        setTimeout(() => {
            for (const c of this.clients)
                c.sock.emit("setPlayerLock", false);
        }, COUNTDOWN_SECS*1000);
        
    }

    addClient(c) {
        if (c.room) {
           c.room.removeClient(c);
        }
        if (this.clients.length === 0) {
            this.host = c;
        }
        this.clients.push(c);
        c.room = this;
    }

    removeClient(c) {
        this.clients.splice(this.clients.indexOf(c), 1);
        c.room = null;
        if (this.host === c) {
            if (this.clients.length === 0) {
                this.host = null;
            } else {
                this.host = this.clients[0];
            }
        }
    }
}

// event fired every time a new client connects:
io.on("connection", (socket) => {
    console.info(`Client connected [id=${socket.id}]`);
    let client = new Client(socket);
    
    const leaveRoom = () => {
        if (client.room.clients.length === 1)
            rooms.splice(rooms.indexOf(client.room), 1);
        client.room.removeClient(client);
    }

    socket.on("activeState", isActive => {
       client.active = isActive; 
    });

    socket.on("ping", cb => {
        if (typeof cb === 'function')
            cb()
    });

    socket.on("particles", (pType, x, y) => {
        for (const c of client.room.clients) {
            if (c === client) continue;
            c.sock.emit("particles", pType, x, y);
        }
    });

    socket.on("createRoom", () => {
        if (rooms.length >= MAX_ROOMS) return;
        if (client.room)
            leaveRoom();
        let newRoom = new Room((+new Date).toString(36).slice(-5), "standoff")
        newRoom.addClient(client);
        rooms.push(newRoom);
        socket.emit("updateRoom", newRoom.id, newRoom.host === client);
        socket.emit("buildMapData", mapData[newRoom.mapName]);
    })

    socket.on("joinRoom", (roomId) => {
        if (client.room && client.room.id === roomId) return;
        for (let r of rooms) {
            if (roomId === r.id) {
                if (client.room)
                    leaveRoom();
                r.addClient(client);
                socket.emit("updateRoom", r.id, r.host === client);
                socket.emit("buildMapData", mapData[r.mapName]);
                return;
            }
        }
    })

    socket.on("requestGameStart", () => {
        if (!client.room || client !== client.room.host)
            return;
        client.room.startGame();
    });

    // when socket disconnects, remove it from the list:
    socket.on("disconnect", () => {
        console.info(`Client gone [id=${socket.id}]`);
        let room = client.room;
        if (room === null) return;
        // broadcast dc to other clients
        for (const c of room.clients)
            c.sock.emit("removeEnts", [client.id]);
        leaveRoom();
    });

    socket.on("update", data => {
        Object.assign(client, data);
    })


    socket.on("spawnBul", (x, y, xVel, yVel) => {
        if (!client.room) return;
        for (let c of client.room.clients) {
            c.sock.emit("createBul", x, y, xVel, yVel);
        }
    });
});

function tick(room) {
    let render_timestamp = +new Date();
    let allPos = room.clients
        // .filter(c => c.active)
        .map(c => {
            let _mapData = mapData[room.mapName];
            if (c.x < _mapData.playArea.xRange[0] || 
                c.x > _mapData.playArea.xRange[1] || 
                c.y < _mapData.playArea.yRange[0] || 
                c.y > _mapData.playArea.yRange[1]) {
                c.sock.emit("respawn");
            }
            c.lastUpdated = render_timestamp;
            return {
               id: c.id,
               x: c.x,
               y: c.y,
               vx: c.vx,
               vy: c.vy,
               tx: c.tx,
               ty: c.ty,
               tvis: c.tvis,
               lastUpdated: c.lastUpdated,
               ani: c.ani,
               flipXAni: c.flipXAni 
            };
    });
    for (const c of room.clients) {
        c.sock.emit("pos", c.id, allPos);
    }
}
setInterval(() => {
    for (const r of rooms) {
        tick(r);
    }
}, 1000/60);

function randomInt(a, b) {
    return Math.random() * (b-a) + a
}
