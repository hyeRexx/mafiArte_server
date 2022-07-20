import express from "express";
import { isLoggedIn } from './authMiddle';
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

module.exports = router;