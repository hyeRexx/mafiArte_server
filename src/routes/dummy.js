// export default class Game {
//     constructor(gameId, socket) {
//         this.gameId = gameId;
//         this.socket = socket;
        
//         this.socket.on("onTest", () => this.test(123));
//     }

//     test(data) {
//         console.log(data);
//         console.log("getcha!");
//     }
// }

let user = {}
let dummy = {id : 1, pass : 1}

user[1] = dummy
console.log(user)

dummy.id = 2
console.log(user)

user[1]['id'] = 3
user[1]['extra'] = 33
console.log(user)

user[1]['extra'] = 44
console.log(user)

user[5]
user[5]['extra'] = 77
console.log(user)