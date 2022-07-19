import express from "express";
var router = express.Router();
const dbpool = require('../lib/db');

// 화상 통화 대기 시 프로필 이미지 조회
// 현재 사용자 1명 조회하는 것으로 되어 있음 -> 추후 게임에 접속한 사용자 리스트로 조회해야
// axios 요청에 파라미터 필요
router.get('/video', async function(req, res, next) {
    try {
      const [[data]] = await dbpool.query('SELECT profile_img FROM `USER` WHERE  `userid` = "haein"');
      return res.json([[data]]);
    } catch(err){
      res.send('에러!');
    }
});
  
module.exports = router;