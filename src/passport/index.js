const passport = require('passport');
const local = require('./localStrategy');
const dbpool = require('../lib/db');
import {userInfo} from '../server.js'

module.exports = () => {
    /*
     * Serialization : 객체를 직렬화하여 전송 가능한 형태로 만듦
     * Deserialization : 직렬화된 파일 등을 역으로 직렬화하여 객체의 형태로 만듦
    */
    console.log('Setting Auth : serializer');
    // 최초 로그인 성공시에 session에 userid 저장
    passport.serializeUser((req, user, done) => {
        process.nextTick(()=>{
            // req.session에 userid만 저장함
            done(null, user.userid);
            console.log('login successed : ', req.session.id)
        });
    });

// 로그인 이후 접근시 session()을 통해 매번 실행되며 로그인한 회원의 req.user에 유저정보를 복구함
    passport.deserializeUser(async (id, done) => {
        dbpool.query('SELECT * FROM USER WHERE userid=?', id).then(user => done(null, user)).catch(err => done(err));
    });

    local();
};