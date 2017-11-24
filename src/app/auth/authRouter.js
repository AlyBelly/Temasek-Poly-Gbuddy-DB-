/**
 * Satellizer Node.js Example
 * (c) 2015 Sahat Yalkabov
 * License: MIT
 */

var path = require('path');
var qs = require('querystring');

var async = require('async');
var bcrypt = require('bcryptjs');
var bodyParser = require('body-parser');
var express = require('express');
var jwt = require('jwt-simple');
var moment = require('moment');
var mongoose = require('mongoose');
var request = require('request');

var config = require('../../config/config');

// var userSchema = new mongoose.Schema({
//   email: { type: String, unique: true, lowercase: true },
//   password: { type: String, select: false },
//   displayName: String,
//   picture: String,
//   bitbucket: String,
//   facebook: String,
//   foursquare: String,
//   google: String,
//   github: String,
//   instagram: String,
//   linkedin: String,
//   live: String,
//   yahoo: String,
//   twitter: String,
//   twitch: String,
//   spotify: String
// });

// userSchema.pre('save', function(next) {
//   var user = this;
//   if (!user.isModified('password')) {
//     return next();
//   }
//   bcrypt.genSalt(10, function(err, salt) {
//     bcrypt.hash(user.password, salt, function(err, hash) {
//       user.password = hash;
//       next();
//     });
//   });
// });

// userSchema.methods.comparePassword = function(password, done) {
// console.log("pass",password)
// console.log("thispass",this.password)
//   bcrypt.compare(password, this.password, function(err, isMatch) {

//     done(err, isMatch);
//   });
// };

// TODO: need to make use of the err.js for error defination.
// TODO: this mongo collection need to be decided in production
var User = require('../models/user');



var authRouter = express.Router();

/*
 |--------------------------------------------------------------------------
 | Login Required Middleware
 |--------------------------------------------------------------------------
 */
function ensureAuthenticated(req, res, next) {
  if (!req.header('Authorization')) {
    return res.status(401).send({
      message: 'Please make sure your request has an Authorization header'
    });
  }
  var token = req.header('Authorization').split(' ')[1];

  var payload = null;
  try {
    payload = jwt.decode(token, config.TOKEN_SECRET);
  } catch (err) {
    return res.status(401).send({
      message: err.message
    });
  }

  if (payload.exp <= moment().unix()) {
    return res.status(401).send({
      message: 'Token has expired'
    });
  }
  req.user = payload.sub;
  next();
}

/*
 |--------------------------------------------------------------------------
 | Generate JSON Web Token
 |--------------------------------------------------------------------------
 */
function createJWT(user) {
  var payload = {
    sub: user._id,
    iat: moment().unix(),
    exp: moment().add(config.jwt_token_expiry_period_in_day, 'days').unix()
  };
  return jwt.encode(payload, config.TOKEN_SECRET);
}

/*
 |--------------------------------------------------------------------------
 | GET /api/me
 |--------------------------------------------------------------------------
 */
authRouter.get('/api/me', ensureAuthenticated, function (req, res) {
  User.findById(req.user, function (err, user) {
    res.send(user);
  });
});

/*
 |--------------------------------------------------------------------------
 | PUT /api/me
 |--------------------------------------------------------------------------
 */
authRouter.put('/api/me', ensureAuthenticated, function (req, res) {
  User.findById(req.user, function (err, user) {
    if (!user) {
      return res.status(400).send({
        message: 'User not found'
      });
    }
    user.displayName = req.body.displayName || user.displayName;
    user.email = req.body.email || user.email;
    user.save(function (err) {
      res.status(200).end();
    });
  });
});


/*
 |--------------------------------------------------------------------------
 | Log in with Email
 |--------------------------------------------------------------------------
 */
authRouter.post('/auth/login', function (req, res) {
    console.log("insinde login qi", req.body)
    User.findOne({
      username: req.body.username
    }, function (err, user) {
      console.log("user", user)
      if (!user) {
        console.log("not user")
        return res.status(401).send({
          message: 'Invalid username and/or password'
        });
      }
      user.comparePassword(req.body.password, function (err, isMatch) {
        console.log("password going in:", isMatch)
        if (!isMatch) {
          console.log("comparing password")
          return res.status(401).send({
            message: 'Invalid username and/or password'
          });
        }
        console.log("success")
        res.send({
          token: createJWT(user)
        });
      });
    });
  });

// /*
//  |--------------------------------------------------------------------------
//  | Create Email and Password Account
//  |--------------------------------------------------------------------------
//  */
// authRouter.post('/auth/signup', function (req, res) {
//   User.findOne({
//     email: req.body.email
//   }, function (err, existingUser) {
//     if (existingUser) {
//       return res.status(409).send({
//         message: 'Email is already taken'
//       });
//     }
//     var user = new User({
//       displayName: req.body.displayName,
//       email: req.body.email,
//       password: req.body.password
//     });
//     user.save(function (err, result) {
//       if (err) {
//         res.status(500).send({
//           message: err.message
//         });
//       }
//       res.send({
//         token: createJWT(result)
//       });
//     });
//   });
// });

/*
 |--------------------------------------------------------------------------
 | Login with Google
 |--------------------------------------------------------------------------
 */
authRouter.post('/auth/google', function (req, res) {
  var accessTokenUrl = 'https://accounts.google.com/o/oauth2/token';
  var peopleApiUrl = 'https://www.googleapis.com/plus/v1/people/me/openIdConnect';
  var params = {
    code: req.body.code,
    client_id: req.body.clientId,
    client_secret: config.GOOGLE_SECRET,
    redirect_uri: req.body.redirectUri,
    grant_type: 'authorization_code'
  };

  // Step 1. Exchange authorization code for access token.
  request.post(accessTokenUrl, {
    json: true,
    form: params
  }, function (err, response, token) {
    var accessToken = token.access_token;
    var headers = {
      Authorization: 'Bearer ' + accessToken
    };

    // Step 2. Retrieve profile information about the current user.
    request.get({
      url: peopleApiUrl,
      headers: headers,
      json: true
    }, function (err, response, profile) {
      if (profile.error) {
        return res.status(500).send({
          message: profile.error.message
        });
      }
      // Step 3a. Link user accounts.
      if (req.header('Authorization')) {
        User.findOne({
          google: profile.sub
        }, function (err, existingUser) {
          if (existingUser) {
            return res.status(409).send({
              message: 'There is already a Google account that belongs to you'
            });
          }
          var token = req.header('Authorization').split(' ')[1];
          var payload = jwt.decode(token, config.TOKEN_SECRET);
          User.findById(payload.sub, function (err, user) {
            if (!user) {
              return res.status(400).send({
                message: 'User not found'
              });
            }
            
            user.google = profile.sub;
            user.email = user.email || profile.email; // email
            user.picture = user.picture || profile.picture.replace('sz=50', 'sz=200');
            user.displayName = user.displayName || profile.name;
            user.auth_type = 'oauth_google';
            user.dob = user.birthday || profile.birthday;
            user.save(function () {
              console.log("User:",user);
              var token = createJWT(user);
              res.send({
                token: token
              });
            });
          });
        });
      } else {
        // Step 3b. Create a new user account or return an existing one.
        User.findOne({
          google: profile.sub
        }, function (err, existingUser) {
          if (existingUser) {
            return res.send({
              token: createJWT(existingUser)
            });
          }
          var user = new User();
          console.log("User:",user); 
          console.log("User:",profile); 
          user.google = profile.sub;
          user.picture = profile.picture.replace('sz=50', 'sz=200');
          user.email = profile.email; // email
          user.displayName = profile.name;
          user.dob = profile.birthday;
          user.auth_type = 'oauth_google';
          user.save(function (err) {
            var token = createJWT(user);
            res.send({
              token: token
            });
          });
        });



        
      }
    });
  });
});

/*
 |--------------------------------------------------------------------------
 | Login with Facebook
 |--------------------------------------------------------------------------
 */
authRouter.post('/auth/facebook', function (req, res) {
  var fields = ['id', 'first_name', 'last_name', 'link', 'name', 'email'];
  var accessTokenUrl = 'https://graph.facebook.com/v2.5/oauth/access_token';
  var graphApiUrl = 'https://graph.facebook.com/v2.5/me?fields=' + fields.join(',');
  var params = {
    code: req.body.code,
    client_id: req.body.clientId,
    client_secret: config.FACEBOOK_SECRET,
    redirect_uri: req.body.redirectUri
  };

  // Step 1. Exchange authorization code for access token.
  request.get({
    url: accessTokenUrl,
    qs: params,
    json: true
  }, function (err, response, accessToken) {
    if (response.statusCode !== 200) {
      return res.status(500).send({
        message: accessToken.error.message
      });
    }

    // Step 2. Retrieve profile information about the current user.
    request.get({
      url: graphApiUrl,
      qs: accessToken,
      json: true
    }, function (err, response, profile) {
      if (response.statusCode !== 200) {
        return res.status(500).send({
          message: profile.error.message
        });
      }
      if (req.header('Authorization')) {
        User.findOne({
          facebook: profile.id
        }, function (err, existingUser) {
          if (existingUser) {
            return res.status(409).send({
              message: 'There is already a Facebook account that belongs to you'
            });
          }
          var token = req.header('Authorization').split(' ')[1];
          var payload = jwt.decode(token, config.TOKEN_SECRET);
          User.findById(payload.sub, function (err, user) {
            if (!user) {
              return res.status(400).send({
                message: 'User not found'
              });
            }
            user.facebook = profile.id;
            user.picture = user.picture || 'https://graph.facebook.com/v2.5/' + profile.id + '/picture?type=large';
            user.displayName = user.displayName || profile.name;
            user.email = user.email || profile.email; // email
            user.auth_type = 'oauth_facebook';
            user.save(function () {
              var token = createJWT(user);
              res.send({
                token: token
              });
            });
          });
        });
      } else {
        // Step 3. Create a new user account or return an existing one.
        User.findOne({
          facebook: profile.id
        }, function (err, existingUser) {
          if (existingUser) {
            var token = createJWT(existingUser);
            return res.send({
              token: token
            });
          }
          var user = new User();
          user.facebook = profile.id;
          user.picture = 'https://graph.facebook.com/' + profile.id + '/picture?type=large';
          user.email = profile.email; // email
          user.displayName = profile.name;
          user.auth_type = 'oauth_facebook';
          user.save(function () {
            var token = createJWT(user);
            res.send({
              token: token
            });
          });
        });
      }
    });
  });
});


/*
 |--------------------------------------------------------------------------
 | Login with GitHub
 |--------------------------------------------------------------------------
 */
authRouter.post('/auth/github', function (req, res) {
  var accessTokenUrl = 'https://github.com/login/oauth/access_token';
  var userApiUrl = 'https://api.github.com/user';
  var params = {
    code: req.body.code,
    client_id: req.body.clientId,
    client_secret: config.GITHUB_SECRET,
    redirect_uri: req.body.redirectUri
  };

  // Step 1. Exchange authorization code for access token.
  request.get({
    url: accessTokenUrl,
    qs: params
  }, function (err, response, accessToken) {
    accessToken = qs.parse(accessToken);
    var headers = {
      'User-Agent': 'Satellizer'
    };

    // Step 2. Retrieve profile information about the current user.
    request.get({
      url: userApiUrl,
      qs: accessToken,
      headers: headers,
      json: true
    }, function (err, response, profile) {

      // Step 3a. Link user accounts.
      if (req.header('Authorization')) {
        User.findOne({
          github: profile.id
        }, function (err, existingUser) {
          if (existingUser) {
            return res.status(409).send({
              message: 'There is already a GitHub account that belongs to you'
            });
          }
          var token = req.header('Authorization').split(' ')[1];
          var payload = jwt.decode(token, config.TOKEN_SECRET);
          User.findById(payload.sub, function (err, user) {
            if (!user) {
              return res.status(400).send({
                message: 'User not found'
              });
            }
            user.github = profile.id;
            user.picture = user.picture || profile.avatar_url;
            user.displayName = user.displayName || profile.name;
            user.save(function () {
              var token = createJWT(user);
              res.send({
                token: token
              });
            });
          });
        });
      } else {
        // Step 3b. Create a new user account or return an existing one.
        User.findOne({
          github: profile.id
        }, function (err, existingUser) {
          if (existingUser) {
            var token = createJWT(existingUser);
            return res.send({
              token: token
            });
          }
          var user = new User();
          user.github = profile.id;
          user.picture = profile.avatar_url;
          user.displayName = profile.name;
          user.email = profile.email;

          user.save(function () {
            var token = createJWT(user);
            res.send({
              token: token
            });
          });
        });
      }
    });
  });
});

// /*
// |--------------------------------------------------------------------------
// | Login with Instagram
// |--------------------------------------------------------------------------
// */
// authRouter.post('/auth/instagram', function (req, res) {
//   var accessTokenUrl = 'https://api.instagram.com/oauth/access_token';

//   var params = {
//     client_id: req.body.clientId,
//     redirect_uri: req.body.redirectUri,
//     client_secret: config.INSTAGRAM_SECRET,
//     code: req.body.code,
//     grant_type: 'authorization_code'
//   };

//   // Step 1. Exchange authorization code for access token.
//   request.post({
//     url: accessTokenUrl,
//     form: params,
//     json: true
//   }, function (error, response, body) {

//     // Step 2a. Link user accounts.
//     if (req.header('Authorization')) {
//       User.findOne({
//         instagram: body.user.id
//       }, function (err, existingUser) {
//         if (existingUser) {
//           return res.status(409).send({
//             message: 'There is already an Instagram account that belongs to you'
//           });
//         }

//         var token = req.header('Authorization').split(' ')[1];
//         var payload = jwt.decode(token, config.TOKEN_SECRET);

//         User.findById(payload.sub, function (err, user) {
//           if (!user) {
//             return res.status(400).send({
//               message: 'User not found'
//             });
//           }
//           user.instagram = body.user.id;
//           user.picture = user.picture || body.user.profile_picture;
//           user.displayName = user.displayName || body.user.username;
//           user.save(function () {
//             var token = createJWT(user);
//             res.send({
//               token: token
//             });
//           });
//         });
//       });
//     } else {
//       // Step 2b. Create a new user account or return an existing one.
//       User.findOne({
//         instagram: body.user.id
//       }, function (err, existingUser) {
//         if (existingUser) {
//           return res.send({
//             token: createJWT(existingUser)
//           });
//         }

//         var user = new User({
//           instagram: body.user.id,
//           picture: body.user.profile_picture,
//           displayName: body.user.username
//         });

//         user.save(function () {
//           var token = createJWT(user);
//           res.send({
//             token: token,
//             user: user
//           });
//         });
//       });
//     }
//   });
// });

// /*
//  |--------------------------------------------------------------------------
//  | Login with LinkedIn
//  |--------------------------------------------------------------------------
//  */
// authRouter.post('/auth/linkedin', function (req, res) {
//   var accessTokenUrl = 'https://www.linkedin.com/uas/oauth2/accessToken';
//   var peopleApiUrl = 'https://api.linkedin.com/v1/people/~:(id,first-name,last-name,email-address,picture-url)';
//   var params = {
//     code: req.body.code,
//     client_id: req.body.clientId,
//     client_secret: config.LINKEDIN_SECRET,
//     redirect_uri: req.body.redirectUri,
//     grant_type: 'authorization_code'
//   };

//   // Step 1. Exchange authorization code for access token.
//   request.post(accessTokenUrl, {
//     form: params,
//     json: true
//   }, function (err, response, body) {
//     if (response.statusCode !== 200) {
//       return res.status(response.statusCode).send({
//         message: body.error_description
//       });
//     }
//     var params = {
//       oauth2_access_token: body.access_token,
//       format: 'json'
//     };

//     // Step 2. Retrieve profile information about the current user.
//     request.get({
//       url: peopleApiUrl,
//       qs: params,
//       json: true
//     }, function (err, response, profile) {

//       // Step 3a. Link user accounts.
//       if (req.header('Authorization')) {
//         User.findOne({
//           linkedin: profile.id
//         }, function (err, existingUser) {
//           if (existingUser) {
//             return res.status(409).send({
//               message: 'There is already a LinkedIn account that belongs to you'
//             });
//           }
//           var token = req.header('Authorization').split(' ')[1];
//           var payload = jwt.decode(token, config.TOKEN_SECRET);
//           User.findById(payload.sub, function (err, user) {
//             if (!user) {
//               return res.status(400).send({
//                 message: 'User not found'
//               });
//             }
//             user.linkedin = profile.id;
//             user.picture = user.picture || profile.pictureUrl;
//             user.displayName = user.displayName || profile.firstName + ' ' + profile.lastName;
//             user.save(function () {
//               var token = createJWT(user);
//               res.send({
//                 token: token
//               });
//             });
//           });
//         });
//       } else {
//         // Step 3b. Create a new user account or return an existing one.
//         User.findOne({
//           linkedin: profile.id
//         }, function (err, existingUser) {
//           if (existingUser) {
//             return res.send({
//               token: createJWT(existingUser)
//             });
//           }
//           var user = new User();
//           user.linkedin = profile.id;
//           user.picture = profile.pictureUrl;
//           user.displayName = profile.firstName + ' ' + profile.lastName;
//           user.save(function () {
//             var token = createJWT(user);
//             res.send({
//               token: token
//             });
//           });
//         });
//       }
//     });
//   });
// });

// /*
//  |--------------------------------------------------------------------------
//  | Login with Windows Live
//  |--------------------------------------------------------------------------
//  */
// authRouter.post('/auth/live', function (req, res) {
//   async.waterfall([
//     // Step 1. Exchange authorization code for access token.
//     function (done) {
//       var accessTokenUrl = 'https://login.live.com/oauth20_token.srf';
//       var params = {
//         code: req.body.code,
//         client_id: req.body.clientId,
//         client_secret: config.WINDOWS_LIVE_SECRET,
//         redirect_uri: req.body.redirectUri,
//         grant_type: 'authorization_code'
//       };
//       request.post(accessTokenUrl, {
//         form: params,
//         json: true
//       }, function (err, response, accessToken) {
//         done(null, accessToken);
//       });
//     },
//     // Step 2. Retrieve profile information about the current user.
//     function (accessToken, done) {
//       var profileUrl = 'https://apis.live.net/v5.0/me?access_token=' + accessToken.access_token;
//       request.get({
//         url: profileUrl,
//         json: true
//       }, function (err, response, profile) {
//         done(err, profile);
//       });
//     },
//     function (profile) {
//       // Step 3a. Link user accounts.
//       if (req.header('Authorization')) {
//         User.findOne({
//           live: profile.id
//         }, function (err, user) {
//           if (user) {
//             return res.status(409).send({
//               message: 'There is already a Windows Live account that belongs to you'
//             });
//           }
//           var token = req.header('Authorization').split(' ')[1];
//           var payload = jwt.decode(token, config.TOKEN_SECRET);
//           User.findById(payload.sub, function (err, existingUser) {
//             if (!existingUser) {
//               return res.status(400).send({
//                 message: 'User not found'
//               });
//             }
//             existingUser.live = profile.id;
//             existingUser.displayName = existingUser.displayName || profile.name;
//             existingUser.save(function () {
//               var token = createJWT(existingUser);
//               res.send({
//                 token: token
//               });
//             });
//           });
//         });
//       } else {
//         // Step 3b. Create a new user or return an existing account.
//         User.findOne({
//           live: profile.id
//         }, function (err, user) {
//           if (user) {
//             return res.send({
//               token: createJWT(user)
//             });
//           }
//           var newUser = new User();
//           newUser.live = profile.id;
//           newUser.displayName = profile.name;
//           newUser.save(function () {
//             var token = createJWT(newUser);
//             res.send({
//               token: token
//             });
//           });
//         });
//       }
//     }
//   ]);
// });


// /*
//  |--------------------------------------------------------------------------
//  | Login with Yahoo
//  |--------------------------------------------------------------------------
//  */
// authRouter.post('/auth/yahoo', function (req, res) {
//   var accessTokenUrl = 'https://api.login.yahoo.com/oauth2/get_token';
//   var clientId = req.body.clientId;
//   var clientSecret = config.YAHOO_SECRET;
//   var formData = {
//     code: req.body.code,
//     redirect_uri: req.body.redirectUri,
//     grant_type: 'authorization_code'
//   };
//   var headers = {
//     Authorization: 'Basic ' + new Buffer(clientId + ':' + clientSecret).toString('base64')
//   };

//   // Step 1. Exchange authorization code for access token.
//   request.post({
//     url: accessTokenUrl,
//     form: formData,
//     headers: headers,
//     json: true
//   }, function (err, response, body) {
//     var socialApiUrl = 'https://social.yahooapis.com/v1/user/' + body.xoauth_yahoo_guid + '/profile?format=json';
//     var headers = {
//       Authorization: 'Bearer ' + body.access_token
//     };

//     // Step 2. Retrieve profile information about the current user.
//     request.get({
//       url: socialApiUrl,
//       headers: headers,
//       json: true
//     }, function (err, response, body) {

//       // Step 3a. Link user accounts.
//       if (req.header('Authorization')) {
//         User.findOne({
//           yahoo: body.profile.guid
//         }, function (err, existingUser) {
//           if (existingUser) {
//             return res.status(409).send({
//               message: 'There is already a Yahoo account that belongs to you'
//             });
//           }
//           var token = req.header('Authorization').split(' ')[1];
//           var payload = jwt.decode(token, config.TOKEN_SECRET);
//           User.findById(payload.sub, function (err, user) {
//             if (!user) {
//               return res.status(400).send({
//                 message: 'User not found'
//               });
//             }
//             user.yahoo = body.profile.guid;
//             user.displayName = user.displayName || body.profile.nickname;
//             user.save(function () {
//               var token = createJWT(user);
//               res.send({
//                 token: token
//               });
//             });
//           });
//         });
//       } else {
//         // Step 3b. Create a new user account or return an existing one.
//         User.findOne({
//           yahoo: body.profile.guid
//         }, function (err, existingUser) {
//           if (existingUser) {
//             return res.send({
//               token: createJWT(existingUser)
//             });
//           }
//           var user = new User();
//           user.yahoo = body.profile.guid;
//           user.displayName = body.profile.nickname;
//           user.save(function () {
//             var token = createJWT(user);
//             res.send({
//               token: token
//             });
//           });
//         });
//       }
//     });
//   });
// });

// /*
//  |--------------------------------------------------------------------------
//  | Login with Twitter
//  | Note: Make sure "Request email addresses from users" is enabled
//  | under Permissions tab in your Twitter authRouter. (https://authRouters.twitter.com)
//  |--------------------------------------------------------------------------
//  */
// authRouter.post('/auth/twitter', function (req, res) {
//   var requestTokenUrl = 'https://api.twitter.com/oauth/request_token';
//   var accessTokenUrl = 'https://api.twitter.com/oauth/access_token';
//   var profileUrl = 'https://api.twitter.com/1.1/account/verify_credentials.json';

//   // Part 1 of 2: Initial request from Satellizer.
//   if (!req.body.oauth_token || !req.body.oauth_verifier) {
//     var requestTokenOauth = {
//       consumer_key: config.TWITTER_KEY,
//       consumer_secret: config.TWITTER_SECRET,
//       callback: req.body.redirectUri
//     };

//     // Step 1. Obtain request token for the authorization popup.
//     request.post({
//       url: requestTokenUrl,
//       oauth: requestTokenOauth
//     }, function (err, response, body) {
//       var oauthToken = qs.parse(body);

//       // Step 2. Send OAuth token back to open the authorization screen.
//       res.send(oauthToken);
//     });
//   } else {
//     // Part 2 of 2: Second request after Authorize authRouter is clicked.
//     var accessTokenOauth = {
//       consumer_key: config.TWITTER_KEY,
//       consumer_secret: config.TWITTER_SECRET,
//       token: req.body.oauth_token,
//       verifier: req.body.oauth_verifier
//     };

//     // Step 3. Exchange oauth token and oauth verifier for access token.
//     request.post({
//       url: accessTokenUrl,
//       oauth: accessTokenOauth
//     }, function (err, response, accessToken) {

//       accessToken = qs.parse(accessToken);

//       var profileOauth = {
//         consumer_key: config.TWITTER_KEY,
//         consumer_secret: config.TWITTER_SECRET,
//         token: accessToken.oauth_token,
//         token_secret: accessToken.oauth_token_secret,
//       };

//       // Step 4. Retrieve user's profile information and email address.
//       request.get({
//         url: profileUrl,
//         qs: {
//           include_email: true
//         },
//         oauth: profileOauth,
//         json: true
//       }, function (err, response, profile) {

//         // Step 5a. Link user accounts.
//         if (req.header('Authorization')) {
//           User.findOne({
//             twitter: profile.id
//           }, function (err, existingUser) {
//             if (existingUser) {
//               return res.status(409).send({
//                 message: 'There is already a Twitter account that belongs to you'
//               });
//             }

//             var token = req.header('Authorization').split(' ')[1];
//             var payload = jwt.decode(token, config.TOKEN_SECRET);

//             User.findById(payload.sub, function (err, user) {
//               if (!user) {
//                 return res.status(400).send({
//                   message: 'User not found'
//                 });
//               }

//               user.twitter = profile.id;
//               user.email = profile.email;
//               user.displayName = user.displayName || profile.name;
//               user.picture = user.picture || profile.profile_image_url_https.replace('_normal', '');
//               user.save(function (err) {
//                 res.send({
//                   token: createJWT(user)
//                 });
//               });
//             });
//           });
//         } else {
//           // Step 5b. Create a new user account or return an existing one.
//           User.findOne({
//             twitter: profile.id
//           }, function (err, existingUser) {
//             if (existingUser) {
//               return res.send({
//                 token: createJWT(existingUser)
//               });
//             }

//             var user = new User();
//             user.twitter = profile.id;
//             user.email = profile.email;
//             user.displayName = profile.name;
//             user.picture = profile.profile_image_url_https.replace('_normal', '');
//             user.save(function () {
//               res.send({
//                 token: createJWT(user)
//               });
//             });
//           });
//         }
//       });
//     });
//   }
// });

// /*
//  |--------------------------------------------------------------------------
//  | Login with Foursquare
//  |--------------------------------------------------------------------------
//  */
// authRouter.post('/auth/foursquare', function (req, res) {
//   var accessTokenUrl = 'https://foursquare.com/oauth2/access_token';
//   var profileUrl = 'https://api.foursquare.com/v2/users/self';
//   var formData = {
//     code: req.body.code,
//     client_id: req.body.clientId,
//     client_secret: config.FOURSQUARE_SECRET,
//     redirect_uri: req.body.redirectUri,
//     grant_type: 'authorization_code'
//   };

//   // Step 1. Exchange authorization code for access token.
//   request.post({
//     url: accessTokenUrl,
//     form: formData,
//     json: true
//   }, function (err, response, body) {
//     var params = {
//       v: '20140806',
//       oauth_token: body.access_token
//     };

//     // Step 2. Retrieve information about the current user.
//     request.get({
//       url: profileUrl,
//       qs: params,
//       json: true
//     }, function (err, response, profile) {
//       profile = profile.response.user;

//       // Step 3a. Link user accounts.
//       if (req.header('Authorization')) {
//         User.findOne({
//           foursquare: profile.id
//         }, function (err, existingUser) {
//           if (existingUser) {
//             return res.status(409).send({
//               message: 'There is already a Foursquare account that belongs to you'
//             });
//           }
//           var token = req.header('Authorization').split(' ')[1];
//           var payload = jwt.decode(token, config.TOKEN_SECRET);
//           User.findById(payload.sub, function (err, user) {
//             if (!user) {
//               return res.status(400).send({
//                 message: 'User not found'
//               });
//             }
//             user.foursquare = profile.id;
//             user.picture = user.picture || profile.photo.prefix + '300x300' + profile.photo.suffix;
//             user.displayName = user.displayName || profile.firstName + ' ' + profile.lastName;
//             user.save(function () {
//               var token = createJWT(user);
//               res.send({
//                 token: token
//               });
//             });
//           });
//         });
//       } else {
//         // Step 3b. Create a new user account or return an existing one.
//         User.findOne({
//           foursquare: profile.id
//         }, function (err, existingUser) {
//           if (existingUser) {
//             var token = createJWT(existingUser);
//             return res.send({
//               token: token
//             });
//           }
//           var user = new User();
//           user.foursquare = profile.id;
//           user.picture = profile.photo.prefix + '300x300' + profile.photo.suffix;
//           user.displayName = profile.firstName + ' ' + profile.lastName;
//           user.save(function () {
//             var token = createJWT(user);
//             res.send({
//               token: token
//             });
//           });
//         });
//       }
//     });
//   });
// });

// /*
//  |--------------------------------------------------------------------------
//  | Login with Twitch
//  |--------------------------------------------------------------------------
//  */
// authRouter.post('/auth/twitch', function (req, res) {
//   var accessTokenUrl = 'https://api.twitch.tv/kraken/oauth2/token';
//   var profileUrl = 'https://api.twitch.tv/kraken/user';
//   var formData = {
//     code: req.body.code,
//     client_id: req.body.clientId,
//     client_secret: config.TWITCH_SECRET,
//     redirect_uri: req.body.redirectUri,
//     grant_type: 'authorization_code'
//   };

//   // Step 1. Exchange authorization code for access token.
//   request.post({
//     url: accessTokenUrl,
//     form: formData,
//     json: true
//   }, function (err, response, accessToken) {
//     var params = {
//       oauth_token: accessToken.access_token
//     };

//     // Step 2. Retrieve information about the current user.
//     request.get({
//       url: profileUrl,
//       qs: params,
//       json: true
//     }, function (err, response, profile) {
//       // Step 3a. Link user accounts.
//       if (req.header('Authorization')) {
//         User.findOne({
//           twitch: profile._id
//         }, function (err, existingUser) {
//           if (existingUser) {
//             return res.status(409).send({
//               message: 'There is already a Twitch account that belongs to you'
//             });
//           }
//           var token = req.header('Authorization').split(' ')[1];
//           var payload = jwt.decode(token, config.TOKEN_SECRET);
//           User.findById(payload.sub, function (err, user) {
//             if (!user) {
//               return res.status(400).send({
//                 message: 'User not found'
//               });
//             }
//             user.twitch = profile._id;
//             user.picture = user.picture || profile.logo;
//             user.displayName = user.name || profile.name;
//             user.email = user.email || profile.email;
//             user.save(function () {
//               var token = createJWT(user);
//               res.send({
//                 token: token
//               });
//             });
//           });
//         });
//       } else {
//         // Step 3b. Create a new user account or return an existing one.
//         User.findOne({
//           twitch: profile._id
//         }, function (err, existingUser) {
//           if (existingUser) {
//             var token = createJWT(existingUser);
//             return res.send({
//               token: token
//             });
//           }
//           var user = new User();
//           user.twitch = profile._id;
//           user.picture = profile.logo;
//           user.displayName = profile.name;
//           user.email = profile.email;
//           user.save(function () {
//             var token = createJWT(user);
//             res.send({
//               token: token
//             });
//           });
//         });
//       }
//     });
//   });
// });

// /*
//  |--------------------------------------------------------------------------
//  | Login with Bitbucket
//  |--------------------------------------------------------------------------
//  */
// authRouter.post('/auth/bitbucket', function (req, res) {
//   var accessTokenUrl = 'https://bitbucket.org/site/oauth2/access_token';
//   var userApiUrl = 'https://bitbucket.org/api/2.0/user';
//   var emailApiUrl = 'https://bitbucket.org/api/2.0/user/emails';

//   var headers = {
//     Authorization: 'Basic ' + new Buffer(req.body.clientId + ':' + config.BITBUCKET_SECRET).toString('base64')
//   };

//   var formData = {
//     code: req.body.code,
//     redirect_uri: req.body.redirectUri,
//     grant_type: 'authorization_code'
//   };

//   // Step 1. Exchange authorization code for access token.
//   request.post({
//     url: accessTokenUrl,
//     form: formData,
//     headers: headers,
//     json: true
//   }, function (err, response, body) {
//     if (body.error) {
//       return res.status(400).send({
//         message: body.error_description
//       });
//     }

//     var params = {
//       access_token: body.access_token
//     };

//     // Step 2. Retrieve information about the current user.
//     request.get({
//       url: userApiUrl,
//       qs: params,
//       json: true
//     }, function (err, response, profile) {

//       // Step 2.5. Retrieve current user's email.
//       request.get({
//         url: emailApiUrl,
//         qs: params,
//         json: true
//       }, function (err, response, emails) {
//         var email = emails.values[0].email;

//         // Step 3a. Link user accounts.
//         if (req.header('Authorization')) {
//           User.findOne({
//             bitbucket: profile.uuid
//           }, function (err, existingUser) {
//             if (existingUser) {
//               return res.status(409).send({
//                 message: 'There is already a Bitbucket account that belongs to you'
//               });
//             }
//             var token = req.header('Authorization').split(' ')[1];
//             var payload = jwt.decode(token, config.TOKEN_SECRET);
//             User.findById(payload.sub, function (err, user) {
//               if (!user) {
//                 return res.status(400).send({
//                   message: 'User not found'
//                 });
//               }
//               user.bitbucket = profile.uuid;
//               user.email = user.email || email;
//               user.picture = user.picture || profile.links.avatar.href;
//               user.displayName = user.displayName || profile.display_name;
//               user.save(function () {
//                 var token = createJWT(user);
//                 res.send({
//                   token: token
//                 });
//               });
//             });
//           });
//         } else {
//           // Step 3b. Create a new user account or return an existing one.
//           User.findOne({
//             bitbucket: profile.id
//           }, function (err, existingUser) {
//             if (existingUser) {
//               var token = createJWT(existingUser);
//               return res.send({
//                 token: token
//               });
//             }
//             var user = new User();
//             user.bitbucket = profile.uuid;
//             user.email = email;
//             user.picture = profile.links.avatar.href;
//             user.displayName = profile.display_name;
//             user.save(function () {
//               var token = createJWT(user);
//               res.send({
//                 token: token
//               });
//             });
//           });
//         }
//       });
//     });
//   });
// });

// /*
//  |--------------------------------------------------------------------------
//  | Login with Spotify
//  |--------------------------------------------------------------------------
//  */

// authRouter.post('/auth/spotify', function (req, res) {
//   var tokenUrl = 'https://accounts.spotify.com/api/token';
//   var userUrl = 'https://api.spotify.com/v1/me';

//   var params = {
//     grant_type: 'authorization_code',
//     code: req.body.code,
//     redirect_uri: req.body.redirectUri
//   };

//   var headers = {
//     Authorization: 'Basic ' + new Buffer(req.body.clientId + ':' + config.SPOTIFY_SECRET).toString('base64')
//   };

//   request.post(tokenUrl, {
//     json: true,
//     form: params,
//     headers: headers
//   }, function (err, response, body) {
//     if (body.error) {
//       return res.status(400).send({
//         message: body.error_description
//       });
//     }

//     request.get(userUrl, {
//       json: true,
//       headers: {
//         Authorization: 'Bearer ' + body.access_token
//       }
//     }, function (err, response, profile) {
//       // Step 3a. Link user accounts.
//       if (req.header('Authorization')) {
//         User.findOne({
//           spotify: profile.id
//         }, function (err, existingUser) {
//           if (existingUser) {
//             return res.status(409).send({
//               message: 'There is already a Spotify account that belongs to you'
//             });
//           }
//           var token = req.header('Authorization').split(' ')[1];
//           var payload = jwt.decode(token, config.TOKEN_SECRET);
//           User.findById(payload.sub, function (err, user) {
//             if (!user) {
//               return res.status(400).send({
//                 message: 'User not found'
//               });
//             }
//             user.spotify = profile.id;
//             user.email = user.email || profile.email;
//             user.picture = profile.images.length > 0 ? profile.images[0].url : '';
//             user.displayName = user.displayName || profile.displayName || profile.id;

//             user.save(function () {
//               var token = createJWT(user);
//               res.send({
//                 token: token
//               });
//             });
//           });
//         });
//       } else {
//         // Step 3b. Create a new user account or return an existing one.
//         User.findOne({
//           spotify: profile.id
//         }, function (err, existingUser) {
//           if (existingUser) {
//             return res.send({
//               token: createJWT(existingUser)
//             });
//           }
//           var user = new User();
//           user.spotify = profile.id;
//           user.email = profile.email;
//           user.picture = profile.images.length > 0 ? profile.images[0].url : '';
//           user.displayName = profile.displayName || profile.id;

//           user.save(function (err) {
//             var token = createJWT(user);
//             res.send({
//               token: token
//             });
//           });
//         });
//       }
//     });
//   });
// });

/*
 |--------------------------------------------------------------------------
 | Unlink Provider
 |--------------------------------------------------------------------------
 */
authRouter.post('/auth/unlink', ensureAuthenticated, function (req, res) {
  var provider = req.body.provider;
  var providers = ['facebook', 'foursquare', 'google', 'github', 'instagram',
    'linkedin', 'live', 'twitter', 'twitch', 'yahoo', 'bitbucket', 'spotify'
  ];

  if (providers.indexOf(provider) === -1) {
    return res.status(400).send({
      message: 'Unknown OAuth Provider'
    });
  }

  User.findById(req.user, function (err, user) {
    if (!user) {
      return res.status(400).send({
        message: 'User Not Found'
      });
    }
    user[provider] = undefined;
    user.save(function () {
      res.status(200).end();
    });
  });
});



module.exports = authRouter;