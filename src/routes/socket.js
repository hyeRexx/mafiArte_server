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
            origin: ["https://admin.socket.io", "https://d2wm85v592lxtd.cloudfront.net", "http://localhost:3001"],
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

        socket.onAny((event) => {
            console.log(`socket의 id : ${socket.id}`)
            // console.log(`Socket event : ${event}`);
        });

        socket.on('loginoutAlert', (userId, status) => {
            console.log('loginoutAlert', userId, status);
            socket.broadcast.emit("friendList", userId, status);
        })

        socket.on("checkEnterableRoom", done => {
            const roomId = + new Date();
            done(roomId);
        });
        
         // socket enterRoom event 이름 수정 확인 필요
        socket.on("enterRoom", (userId, socketId, roomId, done) => {
            console.log(`enterRoom의 ${roomId}`);

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
            const user = userInfo[id];
            user["socket"] = socket.id;
            socket["userId"] = id;
        })

        socket.on("nickname", (nickname) => (socket["nickname"] = nickname));
    
        socket.on("disconnect", () => {
            ioServer.sockets.emit("room_change", publicRooms());
        });
        
        socket.on("new_message", (msg, room, done) => {
            console.log(`메시지 : ${msg}`);
            console.log(`roomId2 : ${room}`);
            socket.to(room).emit("new_message", `socket: ${msg}`); //???
            console.log(`RoomName3 : ${room}`);
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

        // 여러 명의 socketId 반환
        socket.on('listuserinfo', (listuserid) => {
            let listsocketid = new Array();
            for (var i = 0; i < listuserid.length; i++) {
                console.log(`유저의 socket id ${userInfo[listuserid[i]]["socket"]}`);
                listsocketid.push(userInfo[listuserid[i]]["socket"]);
            }

            console.log(`socketid 리스트 ${listsocketid}`);
            
            // 초대하고 싶은 사람 리스트 반환
            socket.emit("listsocketid", listsocketid);
        });

        // 초대 보내기
        socket.on("sendinvite",(listsocketid, roomId, myId, done) => {
            for (var i = 0; i < listsocketid.length; i++) {
                console.log(`초대하는 socket id ${listsocketid[i]}`);
                ioServer.to(listsocketid[i]).emit("getinvite", roomId, myId);
            }
            // HOST가 방으로 이동
            done(roomId);
        });

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
        socket.on("makeGame", (data, done) => {
            let user = userInfo[data.userId];
            games[data.gameId] = new Game(data.gameId);
            games[data.gameId].joinGame(user, socket);
            socket.join(data.gameId);
            console.log("debug__ : games object :", games);
            done(data.gameId);
        }) 

        // request from a general players in the lobby 
        // need client!
        socket.on("joinGame", (data, done) => {
            let user = userInfo[data.userId];
            let thisGameId;
            // 랜덤 입장 요청 : from START btn.
            if (data.gameId === 0) {
                Object.keys(games).forEach((id) => {
                    console.log("iterate in");
                    if (games[id].joinable) {
                        console.log("debug__ : iterate games :", games[id]);
                        socket.join(games[id].gameId);
                        games[id].joinGame(user, socket);
                        thisGameId = games[id].gameId;
                        return false;
                    }
                });

            // 일반 입장 요청 : from invitation ACCEPT btn.
            } else {
                games[data.gameId].joinGame(user,socket);
                thisGameId = data.gameId;
                socket.join(data.gameId);
            }
            console.log("debug__ : joined games object :", games);
            done(thisGameId);
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
        socket.on("startupRequest", (data, done) => {
            let game = games[data.gameId];

            if (game.host === data.userId) {        
                game.startGame();
                done();
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
            let submit = data.gamedata.submit; // 제출한 정보
            
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