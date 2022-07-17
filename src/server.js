import express from "express";
// import WebSocket, { WebSocketServer } from "ws"; // 불필요로 주석처리. 이후 삭제 가능
import http from "http";
import createError from 'http-errors';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dbpool from './lib/db';
// 라우터 임포트
import apiMember from './routes/member';
import apiCanvas from './routes/canvas';
import WebSocket from './routes/socket';
import ingameRouter from './routes/ingame';

const app = express(); // app = express instance

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

// routes
app.use('/api/canvas', apiCanvas);
app.use('/api/member', apiMember);
app.use('/api/ingame', ingameRouter);

// 잘못된 주소로 접근했을 경우 에러처리 (에러발생 및 핸들러)
app.use((err, req, res, next) => {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    next(createError(404));
    res.status(err.status || 500);
    res.render('error');
});

// create server하려면 request Listner 경로가 있어야 함. 당연.
const httpServer = http.createServer(app); 
WebSocket(httpServer);
httpServer.listen(3000, () => console.log(`Listening on http://localhost:3000`));