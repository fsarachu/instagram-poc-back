const Router = require('express').Router;
const router = new Router();
const User = require('../db/models/User');

router
    .get('/users', (req, res) => {
        return User.find()
            .then(users => {
                return res.json({data: users});
            })
            .catch(e => {
                return res.json({error: e});
            });
    })
    .post('/users', (req, res) => {
        const user = new User(req.body);

        return user.save()
            .then(user => {
                return res.json({data: user});
            })
            .catch(e => {
                return res.json({error: e});
            });
    });

module.exports = router;