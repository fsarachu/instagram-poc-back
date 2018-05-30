const auth = require('./auth');
const me = require('./me');

module.exports = function (app) {
    app
        .use(auth)
        .use(me)
    ;
};