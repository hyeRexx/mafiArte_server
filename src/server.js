import express from "express";
// import WebSocket, { WebSocketServer } from "ws"; // 불필요로 주석처리. 이후 삭제 가능
import http from "http";
import createError from 'http-errors';
import cookieParser from 'cookie-parser';
import {Server} from "socket.io";
import {instrument} from "@socket.io/admin-ui";
import cors from 'cors';
import dbpool from './lib/db';
import { userInfo } from "os";

// 라우터 임포트
const authRouter = require('./routes/auth');

const app = express(); // app = express instance

// 동적페이지(view) 관련된 부분 -> react로 완전 적용시엔 지워도 관계 없을듯.
app.set("views", __dirname + "/views");
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);

// CORS Setting
let corsOptions = {
    origin: '*', // 추후 client 도메인 정해지면 값 세팅 필요
    credentials: true
}
app.use(cors(corsOptions));

// 미들웨어 세팅
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// 정적 data 제공 - react에서 자체적으로 정적 data제공하나 임시로 남겨둠. 추후 불필요시 삭제 가능할듯.
app.use("/public", express.static(__dirname + "/public"));

// 라우팅
app.get("/", (_, res) => res.render("index.html")); // 메인 페이지에 대해선 aws cloudfront를 통해 제공할 예정이라 추후 불필요시 삭제 가능
// app.get("/*", (_, res) => res.redirect("/")); // 잘못된 주소 접근 관련 처리 따로 함으로 주석처리함. 이후 삭제 가능.


app.use('/api/auth', authRouter);

// 잘못된 주소로 접근했을 경우 에러처리 (에러발생 및 핸들러)
app.use(function(req, res, next) {
    next(createError(404));
});
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

// Server 생성
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
        // console.log(socket.nickname);
        socket.to(room).emit("new_message", `${socket.nickname} : ${msg}`);
        done();
    });

    // console.log(`A client has connected (id: ${socket.id})`);
        if (!(socket.id in connectedClient)) {
            connectedClient[socket.id] = {};
    } // client 관리용

    socket.on('disconnect', () => {
        // console.log(`Client disconnected (id: ${socket.id})`);
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

httpServer.listen(3000, handleListen);