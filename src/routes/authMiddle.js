/* 인가 관련 middleware*/
import session from 'express-session';

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
    if (req.isAuthenticated()) {
        // 로그인 되어있지 않아야 하기 때문에 그냥 로그아웃 처리 해버림
        req.logout((err) => {
            if (err) {return next(err)}
          });
    }
    next();
}