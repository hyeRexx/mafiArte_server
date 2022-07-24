import express from "express";
const router = express.Router();
const { isLoggedIn, isNotLoggedIn } = require('./authMiddle');

router.get("/home", isLoggedIn, (req, res) => {
    res.send("member");
});

module.exports = router;