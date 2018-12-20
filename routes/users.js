const express = require('express');
const router = express.Router();
const passport = require('passport');
const jwt = require('jsonwebtoken');
const config = require('../config/database');
const User = require('../models/user');
const mailer = require('../config/mailer');
const passgen = require('generate-password');
const bcrypt = require('bcryptjs');

//Register
router.post('/register', (req, res, next) => {
  let newUser = new User({
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    email: req.body.email,
    phone: req.body.phone,
    city: req.body.city,
    username: req.body.username,
    password: req.body.password,
    admin: false,
    location: req.body.location
  });

  if (!newUser.username) {
    var parts = newUser.email.split('@');
    newUser.username = parts[0];
  }

  if (!newUser.password) {
    newUser.password = passgen.generate({
      length: 8,
      numbers: true
    });
  }

  var mailOptions = {
    from: 'aquacool@ukr.net', // sender address
    to: newUser.email, // list of receivers
    subject: 'SkyService', // Subject line
    text: '', // plain text body
    html: `<b>Спасибо за регистрацию </br></br>
                          ваш логин "${newUser.username}"</br>
                          ваш пароль "${newUser.password}"</b></br></br>
                          Измените свой профиль пароля, как только вы войдете в систему.
                          ` // html body
  }

  User.addUser(newUser, (err, user) => {
    if (err) {
      res.json({
        success: false,
        msg: 'Не удалось зарегистрироваться'
      });
    } else {
      res.json({
        success: true,
        msg: 'Регистрация успешна!'
      })
      mailer.transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          return console.log(error);
        }
        console.log('Message %s sent: %s', info.messageId, info.response);
      });

    }
  });
});

//Checks if username exists
router.post('/checkname', (req, res) => {
  User.checkUsername(req.body.username, (err, user) => {
    if (user == 0) {
      res.json({
        exists: false
      });

    } else {
      res.json({
        exists: true
      });
    }
  });
});

//Authenticate
router.post('/authenticate', (req, res, next) => {
    const login = req.body.login;
    const password = req.body.password;
    const location = req.body.location;
    
    User.getUserByLogin(login, (err, user) => {
        if (err) throw err;

        if (!user) {
            return res.json({
                success: false,
                msg: 'Неверное имя пользователя или пароль!'
            });
        }

        if(user.location != location){
          return res.json({
                success: false,
                msg: 'Этот пользователь не зарегестрирован в этой мастерской'
            });
        }
        
        User.comparePassword(password, user.password, (err, isMatch) => {
            if (err) throw err;
            if (isMatch) {
                const token = jwt.sign(user, config.secret, {
                    expiresIn: 604800 //1 week
                });

                res.json({
                    success: true,
                    token: 'JWT ' + token,
                    user: {
                        id: user._id,
                        firstname: user.firstname,
                        lastname: user.lastname,
                        username: user.username,
                        email: user.email,
                        admin: user.admin,
                        location: req.body.location
                    }
                });
            } else {
                return res.json({
                    success: false,
                    msg: 'Неверное имя пользователя или пароль!'
                });
            }
        });
  });
});

//Profile
router.get('/profile', passport.authenticate('jwt', {
  session: false
}), (req, res, next) => {
  res.json({
    user: req.user
  });
});

//Returns user object bt passed id
router.post('/getuserbyid', (req, res) => {
  User.getUserById(req.body.user, (err, response) => {
    res.json(response);
  });
});


//Change password
router.post('/password', passport.authenticate('jwt', {
  session: false
}), (req, res, err) => {
  User.changePassword(req.body.id, req.body.password, (err, res) => {
    if (err) throw err;
  });
  res.json('Пароль изменен');
});

//(returns all users)
router.post('/admin', (req, res, next) => {
    User.find({ location: req.body.location }, (err, user) => {
        if (err) throw err;
        return res.json(user);
    });
});

//search router
router.get('/search/:term?', passport.authenticate('jwt', {
  session: false
}), (req, res, next) => {
  var param = new RegExp(req.params.term, "i");
  User.find({
    $or: [{
        'lastname': param
      },
      {
        'firstname': param
      }
    ]
  }, function(err, user) {
    if (err) throw err;
    return res.json(user)
  });
});

//user update (admin)
router.put('/update', (req, res) => {
  User.findByIdAndUpdate(req.body._id, req.body, callback => {
    res.json('Пользователь обновлен');
  });
});


//Change password
router.post('/password', passport.authenticate('jwt', {
  session: false
}), (req, res, err) => {
  User.changePassword(req.body.id, req.body.password, (err, res) => {
    if (err) throw err;
  });
  res.json('Пароль изменен');
});

//Generate random new password
router.post('/resetPassword/', (req, res) => {

  var email = req.body.email;
  var query = {
    email: email
  };
  var password = passgen.generate({
    length: 8,
    numbers: true
  });

  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(password, salt, (err, hash) => {
      if (err) throw err;

      console.log(email + ' ' + password + ' ' + hash);

      User.findOneAndUpdate(query, {
        $set: {
          password: hash
        }
      }, (err, user) => {

        if (err) {
          return res.json({
            success: false,
            msg: "Смена пароля не удалась"
          });
        }

        var mailOptions = {
          from: 'aquacool@ukr.net', // sender address
          to: email, // list of receivers
          subject: 'SkyService', // Subject line
          text: '', // plain text body
          html: `<b>Ваш пароль был сброшен.</br></br>
                              Ваш новый пароль ${password}.</br>
                              Измените свой профиль пароля, как только вы войдете в систему.
                              ` // html body
        }

        mailer.transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            return console.log(error);
          }
        });

        return res.json({
          success: true,
          msg: "Пароль изменен"
        });
      });
    });
  });
});

module.exports = router;
