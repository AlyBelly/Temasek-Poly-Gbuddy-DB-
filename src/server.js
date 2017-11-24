// server.js

// BASE SETUP
// =============================================================================
var dotenv = require('dotenv').config()
var moment = require('moment');

var fs = require('fs');
// call the packages we need
var express = require('express'); // call express
var app = express(); // define our app using express
var bodyParser = require('body-parser');
var async = require('async');
var morgan = require('morgan');
var config = require('./config/config');

// ======= cfenv ===============================================================
// Now lets get cfenv and ask it to parse the environment variable
var cfenv = require('cfenv');
var appenv = cfenv.getAppEnv();
var production_flag = false;

if (process.env.NODE_ENV == 'production') { //bluemix cloud foundry or container
    production_flag = true;
    console.log('Executed in Production Mode.')
}

// ======= Mongodb setup =======================================================
var mongoose = require('mongoose');
// Use native promises
mongoose.Promise = global.Promise;

var qi_py_hostname = config.qi_py_hostname;

//mongoose.connect(config.mongodb_local_uri); // connect to our database

if (appenv.isLocal && !production_flag) {
    mongoose.connect(config.mongodb_local_uri,{useMongoClient: true}); // connect to our database

    qi_py_hostname = "localhost:5000";

} else {
    // The services object is a map named by service so we extract the one for MongoDB
    //var mongodb_services = services["compose-for-mongodb"];

    // This check ensures there is a services for MongoDB databases
    //assert(!util.isUndefined(mongodb_services), "Must be bound to compose-for-mongodb services");

    // We now take the first bound MongoDB service and extract it's credentials object
    //var credentials = mongodb_services[0].credentials;

    // Within the credentials, an entry ca_certificate_base64 contains the SSL pinning key
    // We convert that from a string into a Buffer entry in an array which we use when
    // connecting.
    //var ca = [new Buffer(credentials.ca_certificate_base64, 'base64')];

    var mongodb_options = {
        mongos: {
            ssl: true,
            //sslValidate: true,
            //sslCA: ca,
            poolSize: 1,
            reconnectTries: 1
        }
    }
    mongoose.connect(config.mongodb_uri, mongodb_options);


    // Authenticator
    // var basicAuth = require('basic-auth-connect');
    // app.use(basicAuth(function(user, pass, callback) {
    //     var result = (user === app_cfg.basic_auth_credential.username &&
    //         pass === app_cfg.basic_auth_credential.password);
    //     callback(null /* error */ , result);
    // }));

    //
    if (appenv.isLocal) { // bluemix container
        qi_py_hostname = process.env.QI_PY_PORT_5000_TCP_ADDR + ":" + process.env.QI_PY_PORT_5000_TCP_PORT;
    } else {
        qi_py_hostname = config.qi_py_hostname
    }
}



var db = mongoose.connection;
db.on('connecting', function () {
    logger.info('Mongodb connecting ...');
});
db.on('error', function (error) {
    logger.error('Error in MongoDb connection: ' + error);
    //mongoose.disconnect();
});
db.on('connected', function () {
    logger.info('Mongdb connected !');
});
db.on('reconnected', function () {
    logger.error('Mongodb reconnected !');
});


// =============================================================================
app.use(morgan('combined'));

// configure app to use bodyParser()
// this will let us get the data from a POST
app.use(bodyParser.urlencoded({
    extended: true,
    limit: '5mb'
}));
app.use(bodyParser.json({
    limit: '5mb'
}));


// Force HTTPS on Heroku
if (app.get('env') === 'production') {
    app.use(function (req, res, next) {
        var protocol = req.get('x-forwarded-proto');
        protocol == 'https' ? next() : res.redirect('https://' + req.hostname + req.url);
    });
}
//app.use(express.static(path.join(__dirname, '../../client')));



// START THE SERVER
// =============================================================================
//var port;
var https = require('https');

// // Setup HTTPS
// var options = {
//     key: fs.readFileSync(__dirname + '/ssl/cloudflare/eigecat_co_cert_key.pem'),
//     cert: fs.readFileSync(__dirname + '/ssl/cloudflare/eigecat_co_cert.pem')
// };

var port = process.env.NODE_PORT || 3443

//var secureServer = https.createServer(options, app).listen(port);
app.listen(port);
console.log('listening on port ' + port);


var request = require('requestretry');
var PYRequest = require('requestretry').defaults({
    maxAttempts: 3,
    retryDelay: 5000,
    json: true,
    timeout: 10000000, // 2 mins
    pool: {
        maxSockets: 200
    }
});


// === logger setup ============================================================
var winston = require('winston');


var logger = new(winston.Logger)({
    transports: [
        new(winston.transports.Console)({
            name: 'info-console',
            level: 'error',
            handleExceptions: true
        }),
        new(require('winston-daily-rotate-file'))({
            name: 'log-file',
            filename: config.LOG_PATH,
            level: 'debug',
            handleExceptions: true
        })
    ]
});


// ROUTES FOR OUR API
// =============================================================================

/* cors - Cross-origin resource sharing, only for development env.
   must disable during production for security */

if (!production_flag) {
    var cors = require('cors')
    app.use(cors())
    app.options('*', cors())
}




var authRouter = require('./app/auth/authRouter');

var busboy = require('connect-busboy');
app.use(busboy());



app.use('/', authRouter);
//app.use('/api/authRouter', authRouter);




/* app web router  */
var appRoute = require('./app/routes/appRoute');
app.use('/api/appRoute', appRoute);

/* Serving the public dir */
app.use(express.static(__dirname + '/public'));