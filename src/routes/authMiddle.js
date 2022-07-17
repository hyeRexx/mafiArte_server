/* 인가 관련 middleware*/

// 로그인이 되어야 하는 경우
exports.isLoggedIn = (req, res, next) => {
    if (req.isAuthenticated()) {
        next();
    } else {
        res.status(403).send('expired');
    }
};

// 로그인이 되어있지 않아야 하는 경우
exports.isNotLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        next();
    } else {
        const message = 'successed';
        res.send(message);
    }
}