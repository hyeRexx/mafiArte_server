let arr = [{id : 1, vote : 1}, {id : 2, vote : 2}]
let rst = []
// let voteData = arr.map(user => { rst[id] = { id : user.id, vote : user.vote }});
// console.log(voteData)
arr.map(user => {rst.push({id : user.id + 1, vote : user.vote + 10})})
console.log(rst)

// let player = [{id : 1, vote : 1, ready : true}, {id : 2, vote : 2, ready : true}]
let player = [{id : 1, vote : 1}, {id : 2, vote : 2}]
player.map(user => {
    user.ready = false;
});
console.log(player)
console.log(arr[0] == player[0])
console.log(typeof(arr[0]))