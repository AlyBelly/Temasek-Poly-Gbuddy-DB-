module.exports = { 
  'mongodb_uri': 'mongodb://hcuser:HAMSJIWKXTIJGJLY@sl-us-dal-9-portal.0.dblayer.com:18596/hc?ssl=true', 
  'mongodb_local_uri': 'mongodb://localhost:27017/myapp', // local testing mongodb setting
  'qi_py_hostname': 'qi-py.mybluemix.net',

  'jwt_token_expiry_period_in_day': 1,

  TOKEN_SECRET: process.env.TOKEN_SECRET || 'myapp',

  // OAuth 2.0
  FACEBOOK_SECRET: process.env.FACEBOOK_SECRET || '6141999993b31cb64d8b715c18d60ffe',
  //FOURSQUARE_SECRET: process.env.FOURSQUARE_SECRET || 'YOUR_FOURSQUARE_CLIENT_SECRET',
  GOOGLE_SECRET: process.env.GOOGLE_SECRET || 'T3_lLF_n0o4vItCFsPmB2C8s',
  GITHUB_SECRET: process.env.GITHUB_SECRET || '60a7bd2950e333c6d2144b583cb1e5d34cdd5754',
  //INSTAGRAM_SECRET: process.env.INSTAGRAM_SECRET || 'YOUR_INSTAGRAM_CLIENT_SECRET',
  //LINKEDIN_SECRET: process.env.LINKEDIN_SECRET || 'YOUR_LINKEDIN_CLIENT_SECRET',
  //TWITCH_SECRET: process.env.TWITCH_SECRET || 'YOUR_TWITCH_CLIENT_SECRET',
  //WINDOWS_LIVE_SECRET: process.env.WINDOWS_LIVE_SECRET || 'YOUR_MICROSOFT_CLIENT_SECRET',
  //YAHOO_SECRET: process.env.YAHOO_SECRET || 'YOUR_YAHOO_CLIENT_SECRET',
  //BITBUCKET_SECRET: process.env.BITBUCKET_SECRET || 'YOUR_BITBUCKET_CLIENT_SECRET',
  //SPOTIFY_SECRET: process.env.SPOTIFY_SECRET || 'YOUR_SPOTIFY_CLIENT_SECRET',

  // OAuth 1.0
  //TWITTER_KEY: process.env.TWITTER_KEY || 'vdrg4sqxyTPSRdJHKu4UVVdeD',
  //TWITTER_SECRET: process.env.TWITTER_SECRET || 'cUIobhRgRlXsFyObUMg3tBq56EgGSwabmcavQP4fncABvotRMA',

  //upload path
  DOC_UPLOAD_PATH: process.env.DOC_UPLOAD_PATH || '/tmp/',
  
  //Emal verification
  REDIRECT_PATH_SUCCESS_EMAIL_VERIFICATION : 'http://localhost:3000/?#/login/account_success?username=',

  //Log file path
  LOG_PATH: process.env.LOG_PATH || '/tmp/qi_node.log'

};
