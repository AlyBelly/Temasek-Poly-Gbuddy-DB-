var mongoose = require('mongoose');
var nev = require('email-verification')(mongoose);
var bcrypt = require('bcryptjs');


// our persistent user model
var UserModel = require('../models/user');

// sync version of hashing function
// var myHasher = function(password, tempUserData, insertTempUser, callback) {
//     var hash = bcrypt.hashSync(password, bcrypt.genSaltSync(10), null);
//     return insertTempUser(hash, tempUserData, callback);
// };

// async version of hashing function
var myHasher = function (password, tempUserData, insertTempUser, callback) {

    bcrypt.genSalt(10, function (err, salt) {
        bcrypt.hash(password, salt, function (err, hash) {
            console.log("hash", hash)
            return insertTempUser(hash, tempUserData, callback);
        });
    });
};

//  var _tempUserModel=require('./models/tempUserModel');


var fs = require('fs');
var email_template_html = fs.readFileSync('src/app/signup/activate_email_template.html').toString();
var email_template_text = fs.readFileSync('src/app/signup/activate_email_template.txt').toString();

// NEV configuration =====================
nev.configure({
    persistentUserModel: UserModel,
    tempUserModel: null,
    tempUserCollection: 'temporary_users',
    emailFieldName: 'username',
    passwordFieldName: 'password',
    expirationTime: 600, // 10 minutes

    verificationURL: 'http://localhost:3443/api/appRoute/email_signup/verify/${URL}',
    transportOptions: {
        service: 'Gmail',
        auth: {
            user: 'gbuddy.info@gmail.com',
            pass: 'gbuddyadmin123'
        }
    },



    verifyMailOptions: {
        from: 'Gbuddy Client Service <support@gbuddy.com>',
        subject: 'Confirm your Gbuddy account',
        html: email_template_html,
        text: email_template_text
    },

    shouldSendConfirmation: false,
    confirmMailOptions: {
        from: 'Gbuddy Client Service <noreply@gbuddy.com>',
        subject: 'Welcome to Gbuddy',
        html: '<p>Your Gbuddy account has been successfully verified.</p>',
        text: 'Your Gbuddy account has been successfully verified.'
    },

    hashingFunction: myHasher,
    passwordFieldName: 'password',
}, function (err, options) {
    if (err) {
        console.log(err);
        return;
    }

    console.log('configured: ' + (typeof options === 'object'));
});

nev.generateTempUserModel(UserModel, function (err, _tempUserModel) {
    if (err) {
        console.log(err);
        return;
    }

    console.log('generated temp user model: ' + (typeof _tempUserModel === 'function'));
});

module.exports = nev