import express from "express";
const router = express.Router();
const dbpool = require('../lib/db');
import {userInfo} from '../server.js';

router.get("/userimg", async(req, res) => {
    try {
        const [[data]] = await dbpool.query('SELECT profile_img FROM `USER` WHERE  `userid` = "haein"');
        return res.json([[data]]);
      } catch(err){
        res.send('에러!');
      }
});

router.post('/friendinfo', async (req, res) => {
  try {
    const [data] = await dbpool.query('SELECT userid FROM USER a join CITIZEN b on a.id = b.friendid where b.myid=4;');
    // console.log("asdfasdfff", data);
    // console.log(userInfo);
    res.send([data, userInfo]);
  } catch(err){
    res.send('errrrrrrrrrr!');
  }
});

module.exports = router;