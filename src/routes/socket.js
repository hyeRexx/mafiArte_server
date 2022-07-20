import { Server } from 'socket.io';
import { instrument } from "@socket.io/admin-ui";
import socketEvent from '../socket-events';
import {userInfo} from '../server.js'
import Game from '../lib/gamemode.js'
// import Game from './dummy.js'

let games = {};

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
        const publicRooms = [];
        rooms.forEach((_, key) => {
            if(sids.get(key) === undefined) {
                publicRooms.push(key);
            }
        });
        return publicRooms;
    }
    
    // room에 몇 명 있나 확인용
    function countRoom(roomId) {
        return ioServer.sockets.adapter.rooms.get(roomId)?.size;
    }
    
    ioServer.on("connection", (socket) => {

        socket.on("canvasTest", () => {
            console.log("canvastest");
            socket.emit("canvasTest1", "성공");
        });


        socket.on("checkEnterableRoom", done => {
            const roomId = Date.now();
            done(roomId); // >> emit.checkEnterableRoom으로 roomId 보냄
        });
        
        // socket enterRoom event 이름 수정 확인 필요
        socket.on("enterRoom", (userId, socketId, roomId, done) => {
            socket["userid"] = userId;
            socket.join(roomId);
            
            done();
            socket.to(roomId).emit("welcome", roomId, countRoom(roomId), userId, socketId);
            socket.room = roomId;
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
            // userInfo[id].socketId = socket.id;
            user = userInfo[id];
            user["socket"] = socket; // hyeRexx added
            socket["userid"] = id;
            console.log(userInfo);
        })

        socket.on("nickname", (nickname) => (socket["nickname"] = nickname));
    
        socket.on("disconnect", () => {
            ioServer.sockets.emit("room_change", publicRooms());
        });
        
        socket.on("new_message", (msg, room, done) => {
            // console.log("__debug 1 ", here);
            // console.log(socket.nickname);
            console.log(`roomId2 : ${room}`);
            socket.to(room).emit("new_message", `socket: ${msg}`); //???
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

        
        /*** for A Game : hyeRexx ***/

        // request from a host player in the lobby
        // need client!
        socket.on("makeGame", (data) => {
            let user = userInfo[data.userId];

            games[data.gameId] = new Game(data.gameId);
            games[data.gameId].joinGame(user)
        }) 

        // request from a general players in the lobby 
        // need client!
        socket.on("joinGame", (data) => {
            let user = userInfo[data.userId];

            // 랜덤 입장 요청 : from START btn.
            if (data.gameId === 0) {
                Object.keys(games).forEach((id) => {
                    if (games[id].joinable) {
                        user.socket.join(games[id].gameId);
                        games[id].joinGame(user);
                        return false;
                    }
                });

            // 일반 입장 요청 : from invitation ACCEPT btn.
            } else {
                games[data.gameId].joinGame(user);
            }
        });

        // request for generalPlayer
        // this event emit to ALLPlayer with this user's ready info
        // need client!
        socket.on("singleReady", (data) => {
            let user = userInfo[data.userId];
            games[data.gameId].readyGame(user);
        })
        
        // request for start game from client, host!
        // need client!
        socket.on("startupRequest", (data) => {
            let game = games[data.gameId];

            if (game.host === data.userId) {        
                game.startGame();
            }
        }); 

        // request from nowPlayer
        // this event emit to ALLPlayer with next turn info.
        // need client!
        socket.on("openTurn", (data) => {
            games[data.gameId].openTurn();
        });

        // request from lastPlayer in a cycle
        // this event emit to ALLPlayer with event result
        // need client!
        socket.on("nightEvent", (data) => {
            let user = userInfo[data.userId];
            let submit = data.gamedata.submit;
            
            games[data.gameId].nightWork(user, submit);
        });

        // request from mafiaPlayer in the game
        // this event emit to ALLPlayer with new turn info.
        socket.on("newCycleRequest", (data) => {
            games[data.gameId].openNewCycle();
        });

        /*** for A Game : hyeRexx : end ***/

    });
}