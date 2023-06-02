const { readFileSync } = require("fs");
// const { createServer } = require("https");
const { createServer } = require("http");
const { Server } = require("socket.io");

// const httpServer = createServer({
    // key: readFileSync("cert/key.pem"),
    // cert: readFileSync("cert/cert.pem")
// });

const io = new Server(80, {
    cors: {
            origin: "*"
    }
});

// httpServer.listen(8080);

let rooms = []
const MAX_ROOMS = 3;
const mapData = {
    standoff: {
        spawnPoint: {
            xRange: [400, 600],
            yRange: [-200,-200]
        },
        groups: {
            bricks: {
                collider: "static",
                w: 100,
                h: 20,
                tile: "=",
                color: "#3A506D",
                tiles: {
                    map: [" ===   ===",
                          "","","","","","","","","","","",
                          "==========="],
                    x: 0,
                    y: 0  
                }
            }
        }
    }
};

function Client(sock) {
    this.sock = sock;
    this.id = "PLAYER-" + this.sock.id;
    this.x = randomInt(200);
    this.y = randomInt(200);
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
        this.id = id;
        this.mapName = mapName;
    }

    addClient(c) {
        if (c.room) {
            c.room.removeClient(c);
        }
        this.clients.push(c);
        c.room = this;
    }

    removeClient(c) {
        this.clients.splice(this.clients.indexOf(c), 1);
        c.room = null;
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

    socket.on("ping", cb => {
        if (typeof cb === 'function')
            cb()
    });

    socket.on("createRoom", () => {
        if (rooms.length >= MAX_ROOMS) return;
        if (client.room)
            leaveRoom();
        let newRoom = new Room((+new Date).toString(36).slice(-5), "standoff")
        newRoom.addClient(client);
        rooms.push(newRoom);
        socket.emit("updateRoom", newRoom.id);
        socket.emit("buildMapData", mapData[newRoom.mapName]);
    })

    socket.on("joinRoom", (roomId) => {
        if (client.room && client.room.id === roomId) return;
        for (let r of rooms) {
            if (roomId === r.id) {
                if (client.room)
                    leaveRoom();
                r.addClient(client);
                socket.emit("updateRoom", r.id);
                socket.emit("buildMapData", mapData[r.mapName]);
                return;
            }
        }
        console.log(rooms)
    })

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

function constrain(n, low, high) {
    if (n < low) return low;
    if (n > high) return high;
    return n;
}


function tick(room) {
    let render_timestamp = +new Date();
    let allPos = room.clients.map(c => {
        if (c.y > 800) {
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
