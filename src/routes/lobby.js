import express from "express";
import { isLoggedIn } from './authMiddle';
import {userInfo} from '../server.js';
const router = express.Router();
const dbpool = require('../lib/db');

router.get("/profile_img", async(req, res) => {
    try {
        const [[data]] = await dbpool.query('SELECT profile_img FROM `USER` WHERE  `userid` = "haein"');
        console.log(req.isAuthenticated());
        console.log(req.user);
        console.log(req.session.user);
        console.log(req.session);
        return res.json(data);
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