import { Server } from 'socket.io';
import { instrument } from "@socket.io/admin-ui";
import socketEvent from '../socket-events';

module.exports = (server) => {
    const ioServer = new Server(server, {
        cors: {
            origin: ["https://admin.socket.io", "http://localhost:3001"],
            credentials: true
        },
    });

    const connectedClient = {};
    
    instrument(ioServer, {auth: false});
    
    // Socket 및 webRTC 관련 Settings
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
        });

        socket.on("test", () => {
            console.log("test 성공 ㅎㅎ");
            socket.emit("test", "성공");
        });

        socket.on("canvasTest", () => {
            console.log("canvastest");
            socket.emit("canvasTest1", "성공");
        });
    
        socket.on("enter_room", (roomName, id, done) => {
            socket.join(roomName); // room
            done();
            socket.to(roomName).emit("welcome", socket.nickname, countRoom(roomName), id);
            ioServer.sockets.emit("room_change", publicRooms());
        });
    
        socket.on("offer", (offer, room, newbieID, offersId) => {
            socket.to(newbieID).emit("offer", offer, offersId);
        });
    
        socket.on("answer", (answer, offersId, newbieId) => {
            socket.to(offersId).emit("answer", answer, newbieId);
        });
    
        socket.on("ice", (ice, room, othersId, myId) => {
            socket.to(othersId).emit("ice", ice, myId);
        });
        
        socket.on("disconnecting", () => {
            socket.rooms.forEach(room => socket.to(room).emit("bye", socket.nickname, countRoom(room) - 1));
        })
        
        socket.on("nickname", (nickname) => (socket["nickname"] = nickname));
    
        socket.on("disconnect", () => {
            ioServer.sockets.emit("room_change", publicRooms());
        });
    
        socket.on("new_message", (msg, room, done) => {
            // console.log("__debug 1 ", here);
            console.log(socket.nickname);
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
    
        // canvas add
        socket.on(socketEvent.DRAW, (data) => {
            const {
              prev,
              curr,
              color,
              thickness,
            } = data;
        
            // const { ctx } = socket.witeboard;
            
            // ctx.beginPath();
            // ctx.strokeStyle = color;
            // ctx.lineWidth = thickness;
            // ctx.moveTo(prev.x, prev.y);
            // ctx.lineTo(curr.x, curr.y);
            // ctx.lineJoin = 'round';
            // ctx.lineCap = 'round';
            // ctx.stroke();
        });
    
        socket.on(socketEvent.DRAW, (data) => {
            const client = connectedClient[socket.id];
    
            client.prev = client.curr || data;
            client.curr = data;    
    
            const currdata = {
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
            }     
    
            socket.to(data.name).emit(socketEvent.DRAW, currdata);
            socket.emit(socketEvent.DRAW, currdata);
        });
    
        socket.on(socketEvent.DRAW_BEGIN_PATH, () => {
            connectedClient[socket.id].curr = null;
        });
    
    });
}