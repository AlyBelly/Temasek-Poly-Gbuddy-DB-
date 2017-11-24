var mongoose     = require('mongoose');
var Schema       = mongoose.Schema;

var temp_user_Schema   = new Schema({
    username: { type:String, lowercase:true, index:true},
    nric: String,
    fullname: String,
    password: String,
    cpassword: String,
    email: String,
    role_id: String,
    sp_id: String,
    status: String,
    updated_dt:  { type: Date, default: Date.now },
    active: { type: Boolean, required: true, default: false },
	temporarytoken: { type: String, required: true }
});

temp_user_Schema.methods.validPassword = function(password) {
  return bcrypt.compareSync(password, this.pw);
};

module.exports = mongoose.model('temp_user', temp_user_Schema);
