const socket = io();

class Game {
    // 게임 생성
    constructor(gameId, socket) {
        // gameId는 timestamp로, host는 maker로 정함
        // max player, maxPlayer 변경 방지
        // defineProperty로 game id 설정
        // let descriptor = Object.getOwnPropertyDescriptor(obj, propertyName);
        Object.defineProperties(this, {
            gameId : {value : gameId, writable : false}, // 게임 식별 정보
            maxPlayer : {value : 8, writable : false},   // 게임에 참가 가능한 최대 인원
        });

        this.socket = socket;
        this.socketAll = [];

        this.host = null;       // 게임을 생성한 사람 또는 첫 번째 유저
        this.mafia = null;      // 게임의 마피아 (매 게임 갱신)
        this.word = null;       // 게임 제시어 : db완료후 로직 구현 : 난수로 wordid 추출
        this.rip = [];          // 사망으로 등록된 사람
        this.joinable = true;   // 게임에 접근 가능 여부
        this.playerCnt = 0;     // 게임에 접속한 유저 수 (max 파악용)

        this.player = [];       // 게임에 접속한 유저 객체 원본
        this.turnQue = [];      // 게임 진행 순서 (queue)
        this.colorSet = []      // 유저 색깔 어딘가에 심어줘라%%

        this.turnCnt = 0;       // 사이클 내의 턴 진행 상황
        this.cycleCnt = 0;      // 게임 반복 횟수
        this.nightDone = 0;     // night work를 마친 유저의 수 (데이터 리턴 조건 체크용)

        this.voteRst = null;    // 시민 투표에서 선출된 사람
        this.guessRst = false;   // 마피아 정답 결과 (boolean)

        this.socket.on("notifySelf", (user) => this.joinGame(user)); // socket.join(room)
        this.socket.on("startupRequest", () => this.startGame()); // 게임 시작 요청
        this.socket.on("openTurn", () => this.changePlayer()); // 턴 교체 요청
        this.socket.on("citizenNight", (user) => this.voteForCitizen(user)); // 마피아 투표 띄움
        this.socket.on("mafiaNight", (word) => this.guessForMafia(word));
        this.socket.on("newCycleRequest", () => this.openNewCycle()); // 새로운 사이클 요청
    }

    // 방 전체에 이벤트 전송
    emitAll(msg, data) {
        this.socketAll.forEach(sock => {
            this.socket.to(sock).emit(msg, data);
        })
    }

    // 게임 host 세팅
    setHost() {
        if (this.player.length === 1) {
            this.host = this.player[0].userId;
        }
    }

    // 게임 입장 : 외부에서 매개변수로 전달한 user object를 게임에 추가
    // on.joinGame
    joinGame(user) { 
        user.state = false;     // 게임 in, user state 변경

        user.ready = false;     // 인게임용 추가 속성 : 레디 정보
        user.mafia = false;     // 인게임용 추가 속성 : 마피아 정보
        user.servived = true;   // 인게임용 추가 속성 : 살았니 죽었니
        user.votes = 0;         // 인게임용 추가 속성 : 득표 수

        this.player.push(user);
        this.player.push(user.socket);

        this.playerCnt++;
        this.setHost();

        this.socket.to(this.gameId).emit("notifyNew", user.userId);
    }


    // 게임 레디 : 호스트가 아닌 일반 유저만 작동 가능
    // ready - cancle ready 한 번에 작동 (조건 분기 있음)
    // ready 버튼에 onclick으로 game.readyGame, event 유저의 userId 전달
    readyGame(userId) {
        let userIdx = this.player.findIndex(x => x.userId === userId)
        let user = this.player[userIdx];

        if (!user.ready) {
            this.turnQue.push(userId);
            user.ready = true;
        } else {
            this.turnQue.splice(this.turnQue.findIndex(x => x.userId === userId), 1);
            user.ready = false;
        }

        // 다른 유저들에게 ready 알림
        this.socket.to(this.gamdId).emit("notifyReady", user.userId, user.ready);

        // 인원 조건 충족 + 마지막 ready 처리 되었을 때 readyToStart로 전달
        if (this.playerCnt > 3 && this.turnQue.length === this.playerCnt) {
            // 받아서 start button 활성화 가능
            let hostUser = this.player[this.player.findIndex(x => x.userId === this.host)]
            this.socket.to(hostUser.socket).emit("reayToStart", true); 
        }
    }

    // 게임 턴 세팅 : 턴 큐로 셔플
    setGameTurn() {
        this.turnQue = this.turnQue.sort(() => Math.random() - 0.728);
        this.turnQue = this.turnQue.sort(() => Math.random() - 0.316);
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

        this.emitAll("gameStarted", firstTurn)
        this.openTurn(); // 첫 턴 뽑기
    }

    // 인게임 턴 교체 : 끝난 플레이어, 다음 플레이어 리턴 (socket.on("singleTurnChange"))
    openTurn() {
        let nowPlayer = this.turnQue.shift(); // 리턴해 줄 유저! 지금 그릴 사람!
        this.turnQue.push(nowPlayer); // 뽑고 바로 뒤로 밀어넣기
        let isMafia = (nowPlayer === this.mafia) ? true : false; // 마피아인지 확인
        
        // 사이클 끝났는지 확인하고 notification
        if (this.turnCnt === this.playerCnt) {
            this.emitAll("cycleClosed", null)
        }
        
        this.turnCnt++;

        const data = { userId : nowPlayer, isMafia : isMafia };
        this.emitAll("singleTurnInfo", data)
    }

    // 인게임 밤이되었습니다 : 시민 - 투표 / 마피아 - 제시어 맞추기
    nightWork(userId, submit) {
        let userIdx = this.player.findIndex(x => x.userId === user);
        let user = player[userIdx];
        this.nightDone++;

        if (userId === this.mafia) {
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
            } else {
                nightData.elected = this.voteRst;
                this.rip.push(this.voteRst);
                player.forEach(user => {
                    nightData.voteData.push({
                        userId : user.id,
                        vote : user.vote,
                    });
                });
            }

            // 초기화 
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
        let user = player[userIdx];
        user.votes++; // 득표 수++
        
        // 투표 수 충족시
        // 사망 또는 체포 분기 : 아무 이벤트도 없는 경우는 client에서 캐치해 주어야 함
        if (user.votes == this.playerCnt - 1) {
            this.voteRst = user.userId;
        }
    }

    // 제시어 추측 : 마피아만
    // success or not으로 조건분기해서 front로 emit
    guessForMafia(word) {
        if (word === this.word) {
            this.guessRst = true;
        }
    }

    // 새로운 턴 시작
    openNewCycle() {
        this.turnCnt = 0;
        this.cycleCnt++;
        this.openTurn();
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
        delete this.player[userIdx].ready;
        delete this.player[userIdx].mafia;

        this.playerCnt--;

        this.socket.to(this.gameId).emit("otherExit", userId);
    }


}

const user1 = { userId : '재관', socket : '1111user' };
const user2 = { userId : '해인', socket : '2222user' };
const user3 = { userId : '혜린', socket : '3333user' };
const user4 = { userId : '진호', socket : '4444user' };
const user5 = { userId : 'user5', socket : '5555user' };
const user6 = { userId : 'user6', socket : '6666user' };
const user7 = { userId : 'user7', socket : '7777user' };
const user8 = { userId : 'user8', socket : '8888user' };

let game = new Game(Date.now());

console.log("\n\n----------------- new game! ------------------\n");

game.joinGame(user1);
game.joinGame(user2);
game.joinGame(user3);
game.joinGame(user4);

game.player.map(user => {game.readyGame(user.userId)})

// let now = game.startGame().playerNow.userId;
// let next= game.startGame().playerNext.userId;
console.log(game.startGame())
console.log("host :", game.host, "\nmafia :", game.mafia)
console.log("turn :", game.turnQue)

console.log(game.changePlayer());
console.log(game.changePlayer());
console.log(game.changePlayer());
console.log(game.changePlayer());




