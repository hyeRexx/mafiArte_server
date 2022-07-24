import express from "express";
import { isLoggedIn } from './authMiddle';
import {userInfo} from '../server.js';
const router = express.Router();
const dbpool = require('../lib/db');

// 로그인 성공시 바로 세팅되게 해놓아서 불필요해짐
// router.post("/profile_img", isLoggedIn, async(req, res) => {
//     try {
//         return res.json(req.user.profile_img);
//       } catch(err){
//         res.send('에러!');
//       }
// });

router.post('/friendinfo', isLoggedIn, async (req, res) => {
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