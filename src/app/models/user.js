var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;
var bcrypt = require('bcryptjs');

var user_Schema   = new Schema({

    username: { type:String, lowercase:true, index:true }, // used for email registed user
    password: { type: String },
    
    nric: String,
    fullname: String,
   
    cpassword: String,
    
    role_id: String,
    sp_id: String,
    status: String,
    updated_dt:  { type: Date, default: Date.now },
    active: { type: Boolean, required: true, default: false },
   
    auth_type: String,
    displayName: String,
    picture: String,
    email: { type: String, lowercase: true, index:true },
    dob: String,


    facebook: { type:String, index:true}, 
    google: { type:String, index:true}, 
    github: String,

  // bitbucket: String,
  // foursquare: String,
  // instagram: String,
  // linkedin: String,
  // live: String,
  // yahoo: String,
  // twitter: String,
  // twitch: String,
  // spotify: String
});

// user_Schema.methods.validPassword = function(password) {
//   return bcrypt.compareSync(password, this.pw);
// };

// user_Schema.pre('save', function(next) {
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

user_Schema.methods.comparePassword = function(password, done) {
console.log("pass",password)
console.log("thispass",this.password)
  bcrypt.compare(password, this.password, function(err, isMatch) {
    
    done(err, isMatch);
  });
};



module.exports = mongoose.model('user', user_Schema);
