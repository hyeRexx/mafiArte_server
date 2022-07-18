import express from "express";
const router = express.Router();
const dbpool = require('../lib/db');

router.get("/userinfo", (req, res) => {
    res.send("hihihihihi");
});

router.get("/userimg", async(req, res) => {
    try {
        const [[data]] = await dbpool.query('SELECT profile_img FROM `USER` WHERE  `userid` = "haein"');
        return res.json([[data]]);
      } catch(err){
        res.send('에러!');
      }
});

module.exports = router;