import express from "express";
import { isLoggedIn } from './authMiddle';
import {userInfo} from '../server.js';
const router = express.Router();
const dbpool = require('../lib/db');

router.post('/friendinfo', isLoggedIn, async (req, res) => {
  try {
    const [[pk]] = await dbpool.query('SELECT id FROM USER WHERE userid=?;', req.body.userid);
    const [data] = await dbpool.query('SELECT userid FROM USER a join CITIZEN b on a.id = b.friendid WHERE b.myid=?;', pk.id);
    const onlineList = {};
    Object.keys(userInfo).forEach(userid => {
      onlineList[userid] = 1;
    });
    res.send([data, onlineList]);
  } catch(err){
    res.send('errrrrrrrrrr!');
  }
});

router.post('/addfriend', isLoggedIn, async (req, res) => {
  const friendId = req.body.userid;
  const myId = req.user.userid;
  try {
    const [[friendPk]] = await dbpool.query('SELECT id FROM USER WHERE userid=?;', friendId);
    if (friendPk) {
      const [[myPk]] = await dbpool.query('SELECT id FROM USER WHERE userid=?;', myId);
      const [[isExist]] = await dbpool.query('SELECT * FROM CITIZEN where myid=? AND friendid=?', [myPk.id, friendPk.id]);
      if (!isExist) {
        dbpool.query("insert into CITIZEN(myid, friendid) values (?,?)", [myPk.id, friendPk.id]);
        dbpool.query("insert into CITIZEN(myid, friendid) values (?,?)", [friendPk.id, myPk.id]);
        res.send("SUCCESS");
      } else {
        res.send("ALREADY_EXIST");
      }
    } else {
      res.send("INVALID_USER");
    }
  } catch (err) {
    console.log(err);
    res.send('error!');
  }
});

module.exports = router;