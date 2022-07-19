import { Server } from 'socket.io';
import { instrument } from "@socket.io/admin-ui";
import socketEvent from '../socket-events';
import {userInfo} from '../server.js'

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
        // socket.onAny((event) => {
        //     // console.log(`Socket event : ${event}`);
        // });

        // socket.on("test", () => {
        //     console.log("test 성공 ㅎㅎ");
        //     socket.emit("test", "성공");
        // });

        socket.on("canvasTest", () => {
            console.log("canvastest");
            socket.emit("canvasTest1", "성공");
        });
        socket.on("checkEnterableRoom", done => {
            const roomNumber = 0; // debugging - 추후 자동 생성되도록 수정 필요. 임시로 그냥 0 넣음
            done(roomNumber);
        });
         // socket enterRoom event 이름 수정 확인 필요
        socket.on("enterRoom", (userId, socketId, roomNumber, done) => {
            socket["userid"] = userId;
            socket.join(roomNumber); // room + debugging - roomName 변경필요 (자동으로 가능한 방으로 들어가도록)
            socket.room = roomNumber;
         // 해인이꺼
        socket.on("enter_room", (roomName, id, done) => {
            console.log(`enter room까지 성공 ${roomName}`);
            socket.join(roomName); // room
            done();
            socket.to(roomNumber).emit("welcome", roomNumber, countRoom(roomNumber), userId, socketId);
            // ioServer.sockets.emit("room_change", publicRooms());
        });

        socket.on("offer", async (offer, offersSocket, newbieSocket, offersId) => {
            console.log("new offer received");
            socket.to(newbieSocket).emit("offer", offer, offersSocket, offersId);
        });
    
        socket.on("answer", (answer, offersSocket, newbieId) => {
            socket.to(offersSocket).emit("answer", answer, newbieId);
        });
    
        socket.on("ice", (ice, sendersId, othersSocket) => {
            socket.to(othersSocket).emit("ice", ice, sendersId);
        });
        
        socket.on("exit", () => {
            console.log("someone exiting", socket.userid, socket.room);
            socket.to(socket.room).emit("roomExit", socket.userid);
            socket.leave(socket.room);
            socket.room = null;
        });

        socket.on("disconnecting", () => {
            console.log("someone disconnecting");
            socket.rooms.forEach(room => {
                socket.to(room).emit("roomExit", socket.userid);
                room != socket.id && socket.leave(room);
            });
        });
        
        socket.on("nickname", (nickname) => {
            socket["nickname"] = nickname;
        });
        
        socket.on('userinfo', (id) => {
            userInfo[id].socketId =socket.id;
            console.log(userInfo);
        })

        socket.on("nickname", (nickname) => (socket["nickname"] = nickname));
    
        socket.on("disconnect", () => {
            ioServer.sockets.emit("room_change", publicRooms());
        });
        
        socket.on("new_message", (msg, room, done) => {
            // console.log("__debug 1 ", here);
            console.log(socket.nickname);
            socket.to(room).emit("new_message", `${socket.nickname} : ${msg}`); //???
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
            
            if (client.curr.color == '#ffffff') {
                currdata.thickness = 30;
            }
    
            socket.to(data.name).emit(socketEvent.DRAW, currdata);
            socket.emit(socketEvent.DRAW, currdata);
        });
    
        socket.on(socketEvent.DRAW_BEGIN_PATH, () => {
            connectedClient[socket.id].curr = null;
        });
    
    });
}