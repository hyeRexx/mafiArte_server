/*
local (not social) 로 로그인 하려는 경우의 strategy 적용
*/

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcrypt'); // 해쉬화된 비밀번호의 비교를 위해

const dbpool = require('../lib/db');

const localStrategy = () => {
    // auth 라우터에서 login 요청이 오면 'local' 설정에 의해 이 함수가 실행됨
    passport.use(
        // local strategy 객체 생성
        new LocalStrategy(
            // client에서 입력된 id/password와 키값 맞도록 세팅
            {
                usernameField: 'userid',
                passwordField: 'password',
            },
            // 회원 확인 전략
            async (userid, password, done) => {
                try {
                    // 입력된 id가 유효한지 db에서 찾아보고
                    const [[signed]] = await dbpool.query('SELECT * FROM USER WHERE userid=?', userid);
                    if (signed) { // 유효하면
                        const result = password === signed.pass; // debugging - test용 임시. 회원가입 암호화 완료시 아래꺼로 대체.
                        // const result = await bcrypt.compare(password, signed.pass);// 비밀번호 일치하는지 확인하고
                        if (result) { // 일치하면 해당 회원정보를 route쪽으로 넘겨주고
                            done(null, signed);
                        } else { // 비밀번호가 틀리면 해당 정보를 넘겨주고
                            done(null, false, { message: 'INVALID_PW' });
                        }
                    } else { // id도 없다면 가입되지 않은 회원으로 정보 넘겨주고
                        done(null, false, { message: 'INVALID_ID' });
                    }
                } catch (e) { // 과정에서 에러 발생하면 예외처리 해줌
                    console.error(e);
                    done(e);
                }
            }
        )
    );
}

module.exports = localStrategy;