import express from "express";
const router = express.Router();

router.get("/home", (req, res) => {
    res.send("member");
});

module.exports = router;