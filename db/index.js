const mongoose = require('mongoose');

module.exports = function () {
    mongoose.Promise = Promise;
    return mongoose.connect(process.env.MONGO_URL, {
        useCreateIndex: true,
        useNewUrlParser: true
    });
};
