const users = require('./users');
const auth = require('./auth');

module.exports = function (app) {
    app
        .use(auth)
        .use(users)
    ;
};