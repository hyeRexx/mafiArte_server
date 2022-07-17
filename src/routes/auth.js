var express = require('express');
const dbpool = require('../lib/db');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('respond with a resource');
});


/* hyeRexx */
router.post('/user/join', async (req, res) => {
    const joinInfo = req.body;
    // const sql = 'SELECT userid FROM STD248.USER where userid'
    const userInfoCheck = await dbpool.query("\
        SELECT userid FROM STD248.USER where userid = ?;\
        SELECT userid FROM STD248.USER where nickname = ?;\
        SELECT userid FROM STD248.USER where email = ?;"
        ,[joinInfo.id, joinInfo.nickname, joinInfo.email]);
    const [[idCheck], [nickCheck], [emailCheck]] = userInfoCheck[0]
    
    let [id, nick, email] = [true, true, true]
    if (idCheck) {id = false}
    if (nickCheck) {nick = false}
    if (emailCheck) {email = false}

    if (id && nick && email) {
        console.log("join process in")
        const sqlRes = await dbpool.query("insert into STD248.USER (userid, pass, nickname, email)\
        values (?, ?, ?, ?);", [joinInfo.id, joinInfo.pass, joinInfo.nickname, joinInfo.email])
        res.send({
            result : 1
        })
    } else {
        console.log("join process fail")
        res.send({
            result : 0,
            idCheck: id,
            nickCheck: nick,
            emailCheck: email
        });
    }

})

/* hyeRexx : END */

// router.get('/login', function(req, res, next) {
//   res.send('respond with a resource');
// });

// router.get('/logout', function(req, res, next) {
//   res.send('respond with a resource');
// });



module.exports = router;