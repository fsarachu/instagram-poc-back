const auth = require('./auth');
const users = require('./users');

module.exports = function (app) {
    app
        .use(auth)
        .use(users)
    ;
};