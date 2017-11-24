var path = require('path');
var qs = require('querystring');

var async = require('async');
var bodyParser = require('body-parser');
var express = require('express');
var mongoose = require('mongoose');
var request = require('request');
var moment = require('moment');

var err_msg = require('../../error/err')
var fs = require('fs');

var config = require('../../config/config');

var winston = require('winston');

var SearchModel = require('../models/trkd_search');


// TODO: i remember winston only need to instantize 1 time, 
// will how to make the subsequent call 
var logger = new (winston.Logger)({
    transports: [
        new (winston.transports.Console)({
            name: 'info-console',
            level: 'error',
            handleExceptions: true
        }),
        new (require('winston-daily-rotate-file'))({
            name: 'log-file',
            filename: config.LOG_PATH,
            level: 'debug',
            handleExceptions: true
        })
    ]
});

var trkdRouter = express.Router();
trkdRouter.use(bodyParser.urlencoded({extended: false}));
trkdRouter.use(bodyParser.json());


//=== forever loop for TRKD get token ==========================================
var request = require('requestretry');
var TRRequest = request.defaults({
    maxAttempts: 3,
    retryDelay: 5000,
    json: true,
    timeout: 10000000, // 2 mins
    pool: {
        maxSockets: 200
    }
});

var trkd_auth = {
    "username": config.trkd_credential.username,
    "application_id": config.trkd_credential.app_id,
    "password": config.trkd_credential.password,
    "token": null,
    "expiry": null
};

if (config.trkd_get_token_loop) {
    logger.info('begin get token');
    async.forever(

        function(next) {

            logger.info('begin async forever get token');

            if (new Date() >= trkd_auth.expiry) { //expired
                async.retry({
                        times: 3,
                        interval: 30000
                    },
                    function(cb) {
                        trkd_get_token(trkd_auth, cb); //logger.debug('Async_forever - trkd_get_token');
                    });
            }
            //logger.debug('Async_forever - next');
            setTimeout(function() {
                next();
            }, 600000); // check token expiry every 10 minutes

        },
        function(err) {
            logger.error('Async_forever - trkd_get_token', err);
        }
    );
}


/* Thomson Reuters - Portfolio management */
trkdRouter.route('/search/').post(function (req, res) {
    logger.info('inside /api/trkd/search');
    if (req.body.search_terms && req.body.search_terms.length > 0) {
        db_get_search(req.body.search_terms, function (err, multiple_search_results) {
            if (err)
                res.send(err);
            else
                res.json(multiple_search_results);
        });
    } else res.send("missing search terms");
});

/* Thomson Reuters - funtions  */
function trkd_get_token(trkd_auth, callback) {

    logger.info('begin trkd_get_token');

    var req_opts = {
        url: "https://api.rkd.reuters.com/api/TokenManagement/TokenManagement.svc/REST/Anonymous/TokenManagement_1/CreateServiceToken_1",
        headers: {
            "Host": "api.rkd.reuters.com",
            "User-Agent": "MyUserAgent",
            "Content-type": 'application/json; charset="UTF-8"'
        },
        body: {
            "CreateServiceToken_Request_1": {
                "ApplicationID": trkd_auth.application_id,
                "Username": trkd_auth.username,
                "Password": trkd_auth.password
            }
        }
    };

    TRRequest.post(req_opts, function (error, response, data_json) {
        if (!error && response.statusCode == 200) {

            if (data_json.Fault != null) {
                logger.error('trkd_get_token - Fault -', data_json);
                return callback(new Error('trkd_get_token - Fault'));
            }

            if (data_json['CreateServiceToken_Response_1'] == null) {
                logger.error('trkd_get_token - Token NULL', response, data_json);
                return callback(new Error('trkd_get_token - Token NULL'));
            }

            trkd_auth.token = data_json.CreateServiceToken_Response_1.Token;

            //Set the expiry time to 30 mins later
            var token_expiry = new Date();

            token_expiry.setMinutes(token_expiry.getMinutes() + 30);
            trkd_auth.expiry = token_expiry;


            var log_json = {
                token: trkd_auth.token,
                expiry: trkd_auth.expiry,
                expiry_local: moment(trkd_auth.expiry).format("YYYY-MM-DD HH:mm:SS")
            }


            logger.info('trkd_auth', log_json);
            //logger.info('trkd_auth:' + JSON.stringify(trkd_auth, null, 2));
            //logger.info('expiry:' + trkd_auth.expiry);

            callback(null);
        } else { //eror
            logger.error('trkd_get_token', data_json);

            var error_msg = '';
            if (data_json.Fault.Reason.Text.Value != null)
                error_msg = data_json.Fault.Reason.Text.Value;

            if (error)
                error_msg = error + ', ' + error_msg;

            callback('trkd_get_token error: ' + error_msg, null);

        }

    });
}

function db_get_search(v_search_terms, cb) {
    //TODO: improve performance with async.queue
    async.concatSeries(v_search_terms, function (v_search_str, concat_cb) {

        logger.info('v_search_str', v_search_str)
        //var retry_cnt = 0
        v_search_str = v_search_str.toLowerCase().trim();

        async.retry({
            times: 2,
            interval: 100 // 100ms,  is delay required before read from db ?
        },
            function (retry_cb) {

                SearchModel.findOne({
                    "search_term": v_search_str
                }).lean().
                    exec(function (err, search_result) {
                        if (err) {
                            logger.error('db_get_search - v_search_str', v_search_str, err);
                            return retry_cb(err);
                        }

                        logger.info('search_result', search_result)
                        var results = [];
                        var to_date = new Date()
                        var age = 10000;

                        if (search_result) {
                            age = Math.ceil((to_date.getTime() - search_result.updated_dt.getTime()) / (1000 * 3600 * 24))

                            if (search_result.result.GetSearchall_Response_1.ResultHeader.Hits == 0) {
                                return retry_cb(null, {
                                    search_term: v_search_str,
                                    results: []
                                })
                            }

                            if (age <= config.search_age_limit && search_result.result.GetSearchall_Response_1.ResultHeader.Hits > 0) {
                                var hits = search_result.result.GetSearchall_Response_1.Result.Hit;
                                logger.info('hits:' + JSON.stringify(hits, null, 2));


                                for (var idx in hits) {
                                    if (hits[idx].RIC != null) {
                                        obj = hits[idx].DocumentTitle[0]
                                        results.push({
                                            'Value': obj.Value,
                                            'SubjectName': obj.SubjectName,
                                            'SimpleType': obj.SimpleType,
                                            'Source': obj.Source,
                                            'Characteristics': obj.Characteristics,
                                            'RIC': hits[idx].RIC,
                                            'SearchAllCategory': hits[idx].SearchAllCategory,
                                            'TickerSymbol': hits[idx].TickerSymbol,
                                            'CUSIP': hits[idx].CUSIP,
                                            'ISIN': hits[idx].ISIN
                                        });
                                    }
                                }
                                return retry_cb(null, {
                                    search_term: v_search_str,
                                    results: results
                                })
                            }

                        }

                        if (!search_result || search_result.length == 0 || age > config.search_age_limit) {
                            logger.info('trkd_search:', v_search_str)
                            trkd_search(v_search_str, function (err, results) {
                                if (err) {
                                    logger.info('trkd_search ERROR!');
                                    return retry_cb("db_get_search - trkd_search - err")
                                } else {
                                    logger.info('trkd_search SUCCESS. ', results, v_search_str);
                                    return retry_cb(null, {
                                       search_term: v_search_str,
                                        results: results
                                    })
                                }
                            });
                        }
                    })
            },
            function (err, search_results) {
                concat_cb(null, search_results);
            }
        );
    },
        function (err, multiple_search_results) { //asunc.concat

            if (err) {
                logger.error('db_get_search - trkd_search', v_search_terms, err);
                return cb(err);
            }

            logger.debug('db_get_search', multiple_search_results);
            logger.info('db_get_search', multiple_search_results)
            cb(null, multiple_search_results);
        })
}

function trkd_search(search_str, callback) {

    logger.info('begin trkd_search');

    var req_opts = {
        url: "http://api.trkd.thomsonreuters.com/api/Search/Search.svc/REST/Searchall_1/GetSearchall_1",
        headers: {
            "Host": "api.trkd.thomsonreuters.com",
            "User-Agent": "MyUserAgent",
            "X-Trkd-Auth-Token": trkd_auth.token,
            "X-Trkd-Auth-ApplicationID": trkd_auth.application_id,
            "Content-type": 'application/json; charset="UTF-8"'
        },
        body: {
            "GetSearchall_Request_1": {
                "QueryHeader": {
                    "MaxCount": 10,
                    "Pivot": 0,
                    "Timeout": 0,
                    "Spellcheck": "On"
                },
                "Filter": [{

                    "TickerSymbol": {
                        "Include": true
                    },
                    "CUSIP": {
                        "Include": true
                    },
                    "RIC": {
                        "Include": true
                    },
                    "ISIN": {
                        "Include": true
                    },
                    "SearchAllCategory": {
                        "Include": true,
                        "StringValue": [{
                            "Value": "Equities"
                        }, {
                            "Value": "Funds"
                        }, {
                            "Value": "Bonds"
                        }]
                    }
                }],
                "Query": [{
                    "Search": {
                        "Include": true,
                        "StringValue": [{
                            "Value": search_str
                        }]
                    }
                }]
            }
        }
    };

    TRRequest.post(req_opts, function (error, response, data_json) {

        logger.info('begin trkd_search.post');

        if (!error && response.statusCode == 200) {

            if (data_json.Fault != null) {
                logger.error('trkd_search - Fault -', data_json);
                return callback(new Error('trkd_search - Fault'));
            }

            if (data_json['GetSearchall_Response_1'] == null) {
                logger.error('trkd_search - GetSearchall_Response_1 NULL', response, data_json);
                return callback(new Error('trkd_search - GetSearchall_Response_1 NULL'));
            }

            var results = [];

            if (data_json.GetSearchall_Response_1.ResultHeader.Hits > 0) {
                var hits = data_json.GetSearchall_Response_1.Result.Hit;
                logger.info('hits:' + JSON.stringify(hits, null, 2));

                var results = [];
                for (var idx in hits) {
                    if (hits[idx].RIC != null) {
                        obj = hits[idx].DocumentTitle[0]
                        results.push({
                            'Value': obj.Value,
                            'SubjectName': obj.SubjectName,
                            'SimpleType': obj.SimpleType,
                            'Source': obj.Source,
                            'Characteristics': obj.Characteristics,
                            'RIC': hits[idx].RIC,
                            'SearchAllCategory': hits[idx].SearchAllCategory,
                            'TickerSymbol': hits[idx].TickerSymbol,
                            'CUSIP': hits[idx].CUSIP,
                            'ISIN': hits[idx].ISIN
                        });
                    }
                }
            }

            var curr_time = new Date();

            SearchModel.update({
                search_term: search_str
            }, {
                    updated_dt: curr_time,
                    result: data_json
                }, {
                    upsert: true
                },
                function (err) {
                    if (err) {
                        logger.error('trkd_search - update db error', err);
                        return callback(err);
                    }
                });

            //logger.info('trkd_retrieve_headline - hl_news_id:' + JSON.stringify(hl_news_id));
            logger.info('trkd_search - complete');
            logger.debug('trkd_search result - ', results);

            callback(null, results);
        } else { //eror
            var err = error || " response.statusCode=" + response.statusCode;
            logger.error('trkd_search.post ERROR', err);
            logger.error('trkd_search.post ERROR response', response);
            callback(err);
        }

    });
}

module.exports = trkdRouter;