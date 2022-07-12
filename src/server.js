import express from "express";
import WebSocket, { WebSocketServer } from "ws";
import http from "http";
import {Server} from "socket.io";
import {instrument} from "@socket.io/admin-ui";

const app = express(); // app = express instance
// app set?
app.set("view engine", "pug"); // set views
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (_, res) => res.render("index")); // rendering
app.get("/*", (_, res) => res.redirect("/"));

const handleListen = () => console.log(`Listening on http://localhost:3000`);

const httpServer = http.createServer(app); // create server하려면 request Listner 경로가 있어야 함. 당연.
const ioServer = new Server(httpServer, {
    cors: {
        origin: ["https://admin.socket.io"],
        credentials: true
    },
});
const socketEvent = require('./socket-events'); // canvas added
const connectedClient = {};

instrument(ioServer, {auth: false});

function publicRooms() {
    const {sockets: {adapter: {sids, rooms}}} = ioServer;
    // const sids = ioServer.sockets.adapter.sids;
    // const rooms = ioServer.sockets.adapter.rooms;
    const publicRooms = [];
    rooms.forEach((_, key) => {
        if(sids.get(key) === undefined) {
            publicRooms.push(key);
        }
    });
    return publicRooms;
}

function countRoom(roomName) {
    return ioServer.sockets.adapter.rooms.get(roomName)?.size;
}

ioServer.on("connection", (socket) => {
    socket["nickname"] = "Anon";

    socket.onAny((event) => {
        // console.log(`Socket event : ${event}`);
    })

    socket.on("nickname", (nickname) => (socket["nickname"] = nickname))

    socket.on("enter_room", (roomName, done) => {
        socket.join(roomName); // room
        done();
        socket.to(roomName).emit("welcome", socket.nickname, countRoom(roomName));
        ioServer.sockets.emit("room_change", publicRooms());
    });
    
    socket.on("disconnecting", () => {
        socket.rooms.forEach(room => socket.to(room).emit("bye", socket.nickname, countRoom(room) - 1));
    })
    
    socket.on("disconnect", () => {
        ioServer.sockets.emit("room_change", publicRooms());
    });

    socket.on("new_message", (msg, room, done) => {
        // console.log("__debug 1 ", here);
        socket.to(room).emit("new_message", `${socket.nickname} : ${msg}`);
        done();
    });

    console.log(`A client has connected (id: ${socket.id})`);
        if (!(socket.id in connectedClient)) {
            connectedClient[socket.id] = {};
    } // client 관리용

    socket.on('disconnect', () => {
        console.log(`Client disconnected (id: ${socket.id})`);
        delete connectedClient[socket.id];
    }); // client 관리용

    socket.on(socketEvent.DRAW, (data) => {
        const client = connectedClient[socket.id];
        // // console.log(data.name);

        // // socket.to(roomName).emit("welcome", socket.nickname, countRoom(roomName));

        client.prev = client.curr || data;
        client.curr = data;             
        
        // socket.to(data.room).emit(socketEvent.DRAW, {
        //     prev: {
        //         x: client.prev.x,
        //         y: client.prev.y,
        //       },
        //       curr: {
        //         x: client.curr.x,
        //         y: client.curr.y,
        //       },
        //       color: client.curr.color,
        //       thickness: client.curr.thickness,
        // });

        ioServer.sockets.emit(socketEvent.DRAW, {
            prev: {
                x: client.prev.x,
                y: client.prev.y,
              },
              curr: {
                x: client.curr.x,
                y: client.curr.y,
              },
              color: client.curr.color,
              thickness: client.curr.thickness,
        });
    });

    socket.on(socketEvent.DRAW_BEGIN_PATH, () => {
        connectedClient[socket.id].curr = null;
    });

});

httpServer.listen(3000, handleListen);