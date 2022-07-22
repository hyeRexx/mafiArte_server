import {userInfo} from '../server.js'

export default class Game {
    // 게임 생성
    constructor(gameId) {
        // gameId는 timestamp로, host는 maker로 정함
        // max player, maxPlayer 변경 방지
        // defineProperty로 game id 설정
        // let descriptor = Object.getOwnPropertyDescriptor(obj, propertyName);
        this.maxCnt = 8;
        this.gameId = gameId;
        this.socketAll = [];    // 게임 플레이어들의 소켓 정보 배열
        this.joinable = true;   // 게임 접근 가능 여부
        this.playerCnt = 0;     // 게임 플레이어 수 (max 파악용)

        this.host = null;       // 게임을 생성한 사람 또는 첫 번째 유저
        this.mafia = null;      // 게임의 마피아 (매 게임 갱신)
        this.word = null;       // 게임 제시어 : db완료후 로직 구현 : 난수로 wordid 추출
        this.rip = [];          // 사망으로 등록된 사람

        this.player = [];       // 게임에 접속한 유저 객체 원본
        this.turnQue = [];      // 게임 진행 순서 (queue)
        this.colorSet = []      // 유저 색깔 어딘가에 심어줘라%%

        this.turnCnt = 0;       // 사이클 내의 턴 진행 상황
        this.cycleCnt = 0;      // 게임 반복 횟수
        this.nightDone = 0;     // night work를 마친 유저의 수 (데이터 리턴 조건 체크용)

        this.voteRst = null;    // 시민 투표에서 선출된 사람
        this.guessRst = false;   // 마피아 정답 결과 (boolean)
    }

    // 방 전체에 이벤트 전송
    emitAll(msg, data) {
        this.socketAll.forEach(socket => {
            // console.log(socket);
            socket.emit(msg, data);
        })

        // for test
        // console.log("**GAME** emit event\nmsg :", msg, "\ndata :", data)
    }

    // 게임 host 세팅 : player Arr의 첫 번째 유저 (입장 rs순서 정렬)
    setHost() {
        this.host = this.player[0].userId;
    }


    // 게임 입장 : user object에 추가 속성 부여 및 각 array에 push
    joinGame(user, socket) {    
        user['gameId'] = this.gameId;
        user['state'] = false;     // 게임 in, user state 변경
        user['ready'] = false;     // 인게임용 추가 속성 : 레디 정보
        user['mafia'] = false;     // 인게임용 추가 속성 : 마피아 정보
        user['servived'] = true;   // 인게임용 추가 속성 : 살았니 죽었니
        user['votes'] = 0;         // 인게임용 추가 속성 : 득표 수 : 밤이되었습니다   

        this.player.push(user);
        this.socketAll.push(socket);

        this.playerCnt++;
        this.joinable = (this.playerCnt === this.maxPlayer) ? false : true; // 게임 접근 차단
        this.playerCnt == 1 ? this.setHost() : null; // 호스트 뽑기

        // 새로운 유저 입장 알림
        this.emitAll("notifyNew", user.userId);
    }


    // 게임 레디 : 호스트가 아닌 일반 유저만 작동 가능
    // ready - cancle ready 한 번에 작동 (조건 분기 있음)
    // ready 버튼에 onclick으로 game.readyGame, event 유저의 userId 전달
    readyGame(user) {
        if (!user.ready) {
            this.turnQue.push(user.userId);
            user.ready = true;
        } else {
            this.turnQue.splice(this.turnQue.findIndex(x => x === user.userId), 1);
            user.ready = false;
        }

        // 인원 조건 충족 + 마지막 ready 처리 되었을 때 readyToStart로 전달
        // add it : this.playerCnt > 3 && 
        if (this.turnQue.length === this.playerCnt) {
            // 받아서 start button 활성화 가능
            // 모두에게 전송, Client에서 구분
            this.emitAll("readyToStart", {readyToStart : true}); 
        }

        // 다른 유저들에게 ready 알림
        this.emitAll("notifyReady", {userId : user.userId, isReady: user.ready})
    }

    // 게임 턴 세팅 : 턴 큐로 셔플
    // 4인인 경우 셔플이 잘 안되어서 부득이하게 두 번 돌림. 지우지 말아주세염..
    setGameTurn() {
        this.turnQue = this.turnQue.sort(() => Math.random() - 0.729);
        this.turnQue = this.turnQue.sort(() => Math.random() - 0.481);
    }

    // 마피아 뽑기
    drawMafia() {
        this.mafia = this.turnQue[Math.floor(Math.random() * this.turnQue.length)]
        this.player[this.player.findIndex(x => x.userId === this.mafia)].mafia = true;
    }

    // 게임 시작 : 조건 : readyCnt = n - 1, player > 3
    startGame() {
        this.joinable = false;
        this.cycle = 0; // 초기화

        this.setGameTurn(); 
        this.drawMafia();

        this.emitAll("gameStarted", {turnInfo : this.turnQue});
        this.openTurn(); // 첫 턴 뽑기
    }

    // 인게임 턴 교체 : 끝난 플레이어, 다음 플레이어 리턴 (socket.on("singleTurnChange"))
    openTurn() {
        // 사이클 끝났는지 확인하고 notification + 사이클 끝나면 턴 제공하지 않음
        if (this.turnCnt === this.playerCnt - this.rip.length) {
            this.emitAll("cycleClosed", null);
            return;
        }

        let nowPlayer = this.turnQue.shift(); // 리턴해 줄 유저! 지금 그릴 사람!
        this.turnQue.push(nowPlayer); // 뽑고 바로 뒤로 밀어넣기
        let isMafia = (nowPlayer === this.mafia) ? true : false; // 마피아인지 확인
        
        this.turnCnt++;

        const data = { userId : nowPlayer, isMafia : isMafia };
        this.emitAll("singleTurnInfo", data)
    }

    // 인게임 : 밤이되었습니다 : 시민 - 투표 / 마피아 - 제시어 맞추기
    nightWork(user, submit) {
        // user: 해당 user의 userInfo -> user.userId: userId
        // submit: 제출한 정보

        this.nightDone++;  // night work를 마친 유저의 수 (데이터 리턴 조건 체크용)

        console.log(`마피아의 정답 제출 ${user} ${submit}`);

        if (user.userId === this.mafia) {
            this.guessForMafia(submit); // 마피아 추측
        } else {
            this.voteForCitizen(submit); // 시민 투표 
        }

        // 플레이어 전원이 투표 완료한 경우
        if (this.nightDone === this.playerCnt) {

            let nightData = {
                win : null,
                elected : null,
                voteData : []
            }

            // 분기 : 마피아 정답 맞춤 - 시민들이 마피아에 투표 + 마피아는 틀림 - else
            if (this.guessRst) { 
                nightData.win = 'mafia'
            } else if (this.voteRst === this.mafia && !this.guessRst) {
                nightData.win = 'citizen'
            } else if (this.voteRst){ // 시민이 만장일치로 잘못된 시민 선출 시
                nightData.elected = this.voteRst;
                this.rip.push(this.voteRst);
            }

            this.player.forEach(user => {
                nightData.voteData.push({
                    userId : user.userId,
                    vote : user.vote,
                });
            });

            // night result 초기화 
            this.guessRst = false;
            this.voteRst = null;

            this.emitAll("nightResult", nightData);
        }
    }

    // 투표 : 시민만 : 만장일치 나올 경우만 voteRst 등록
    // 투표 조건에 맞을 경우 우선 rip[0]으로 추가
    // mafia or not으로 조건 분기해서 front로 emit userid
    voteForCitizen(user) {
        let userIdx = this.player.findIndex(x => x.userId === user);
        let gameuser = this.player[userIdx];
        gameuser.votes++; // 득표 수++
    
        // 투표 수 충족시 : 사망 또는 체포 분기
        if (gameuser.votes == this.playerCnt - this.rip.length - 1) {
            this.voteRst = gameuser.userId;
            let dieId = this.turnQue.findIndex(x => x === user);
            this.turnQue.splice(dieId, 1); // 죽은 시민 turnQueue에서 삭제
        }
    }

    // 제시어 추측 : 마피아만 : success or not으로 조건분기해서 front로 emit
    guessForMafia(word) {
        if (word === this.word) {
            this.guessRst = true;
        }
    }

    // 새로운 턴 시작
    openNewCycle() {
        this.turnCnt = 0;   // 초기화
        this.cycleCnt++;    // cycle 정보 업데이트 : 추후 마피아 힌트 등 준비
        this.openTurn();    // 새로운 턴 정보 제공
    }

    // 게임 종료 : 정상 종료
    closeGame() {
        this.player.forEach(user => {
            user.ready = false;
        });
    }

    // 게임 나가기 : 이벤트 유저의 userId 전달
    exitGame(userId) {
        // 나가는 유저 idx 확인
        let userIdx = this.player.findIndex(x => x.userId === userId);
        let turnIdx = this.turnQue.findIndex(x => x.userId === userId);
        let exitUser = this.player[userIdx];

        // 플레이어 정보, 턴 정보에서 해당 유저 제거
        this.player.splice(userIdx, 1);
        this.turnQue.splice(turnIdx, 1);
        this.socketAll.aplice(userIdx, 1);
        
        // 나가는 사람이 호스트일 경우 호스트 뽑기
        if (exitUser.userId === this.host) {
            this.setHost();
        }

        // 인게임용 속성 제거 : ready
        delete exitUser.ready;
        delete exitUser.mafia;
        delete exitUser.servived;
        delete exitUser.votes;

        this.playerCnt--;

        // this.socket.to(this.gameId).emit("otherExit", userId);
        this.emitAll("someoneExit", {userId : userId});
    }


}

// const user1 = { userId : '재관', socket : '1111user' };
// const user2 = { userId : '해인', socket : '2222user' };
// const user3 = { userId : '혜린', socket : '3333user' };
// const user4 = { userId : '진호', socket : '4444user' };
// const user5 = { userId : 'user5', socket : '5555user' };
// const user6 = { userId : 'user6', socket : '6666user' };
// const user7 = { userId : 'user7', socket : '7777user' };
// const user8 = { userId : 'user8', socket : '8888user' };

// let game = new Game(Date.now());

// console.log("\n\n----------------- new game! ------------------\n");

// game.joinGame(user1);
// game.joinGame(user2);
// game.joinGame(user3);
// game.joinGame(user4);

// game.player.map(user => {game.readyGame(user.userId)})

// // let now = game.startGame().playerNow.userId;
// // let next= game.startGame().playerNext.userId;
// console.log(game.startGame())
// console.log("host :", game.host, "\nmafia :", game.mafia)
// console.log("turn :", game.turnQue)

// console.log(game.changePlayer());
// console.log(game.changePlayer());
// console.log(game.changePlayer());
// console.log(game.changePlayer());




