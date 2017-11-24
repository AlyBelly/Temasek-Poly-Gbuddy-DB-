var err_msg = require('../../error/err')
var fs = require('fs');
var express = require('express'),
    bodyParser = require('body-parser');


var mongoose = require('mongoose');
var nev = require('../signup/email');


var config = require('../../config/config');

var appRoute = express.Router();
appRoute.use(bodyParser.json());


appRoute.use(bodyParser.urlencoded());


var UserModel = require('../models/user');

appRoute.route('/user/:_id')
.get(function (req, res, next) {
    UserModel.find({
        _id: req.params._id
    }, function (err, UserModel) {
        if (err) return next(err);
        res.json(UserModel);
    });
})
.put(function (req, res, next) {
    UserModel.findByIdAndUpdate({
        _id: req.params._id
    }, {
        $set: req.body
    }, {
        new: true
    }, function (err, UserModel) {
        if (err) return next(err);
        res.json(UserModel);
    });
})


appRoute.route('/email_signup/send_verification')
.post(function (req, res) {

    var newUser = new UserModel({
        username: req.body.username,
        password: req.body.password,
        email: req.body.username,
        auth_type: 'email'
    });

    nev.createTempUser(newUser, function (err, existingPersistentUser, newTempUser) {
        if (err) {
            console.log("error", err)
            return res.status(450).json({

                error: err_msg.ERR_SIGNUP_CREATE_TEMP_USER_FAILED
            });
        } else if (existingPersistentUser) { // user already exists in persistent collection
            console.log("newUser", newUser)
            console.log("existing", existingPersistentUser)
            return res.status(450).json({
                error: err_msg.ERR_SIGNUP_USER_ACCOUNT_EXIST
            });
        } else if (newTempUser) { // new user created
            console.log("new", newTempUser)
            var URL = newTempUser[nev.options.URLFieldName];

            nev.sendVerificationEmail(req.body.username, URL, function (err, info) {
                console.log("sending", req.body.username)
                if (err) {
                    //console.log("new user , but email failed",err)
                    return res.status(450).json({
                        error: err_msg.ERR_SIGNUP_SEND_EMAIL_FAILED
                    });
                } else {

                    res.status(200).json({
                        user_title: 'Sign Up Account',
                        user_msg: 'An email has been sent to you. Please check it to verify your account.',
                        info: info
                    });
                }
            });

            // user already exists in temporary collection!
        } else {
            console.log("already signed up")

            res.status(450).json({
                error: err_msg.ERR_SIGNUP_USER_ALREADY_SIGNUP
            });
        }
    });        
});

appRoute.route('/email_signup/resend_verification')
.post(function (req, res) {

    var email = req.body.username;
    nev.resendVerificationEmail(email, function (err, userFound) {
        if (err) {
            return res.status(450).json({
                error: err_msg.ERR_SIGNUP_RESEND_EMAIL_FAILED
            });
        }
        if (userFound) {
            res.status(200).json({
                user_title: 'Resend Verification Code',
                user_msg: 'An email has been sent to you. Please check it to verify your account.'
            });
        } else {
            res.status(450).json({
                error: err_msg.ERR_SIGNUP_RESEND_USER_NOT_FOUND
            });
        }
    });
});

appRoute.route('/email_signup/verify/:url_token')
.get(function (req, res) {
    var url = req.params.url_token;

    nev.confirmTempUser(url, function (err, user) {
        if (user) {
            nev.sendConfirmationEmail(user.username, function (err, info) {
                if (err) {
                    return res.status(450).json({
                        error: err_msg.ERR_SIGNUP_VERIFY_SEND_EMAIL_FAILED
                    });
                }
                //             console.log("success, sending confirm email")
                //              $auth.signup(user)

                //   $auth.setToken(response)

                res.redirect(301, config.REDIRECT_PATH_SUCCESS_EMAIL_VERIFICATION + user.username)
                //  res.send({ token: createJWT(user) });

            });
        } else {
            return res.status(450).json({
                error: err_msg.ERR_SIGNUP_VERIFY_FAILED
            });
        }


    });
});


module.exports = appRoute;