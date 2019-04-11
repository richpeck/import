///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
//            _____                           _              //
//           |_   _|                         | |             //
//             | | _ __ ___  _ __   ___  _ __| |_            //
//             | || '_ ` _ \| '_ \ / _ \| '__| __|           //
//            _| || | | | | | |_) | (_) | |  | |_            //
//            \___/_| |_| |_| .__/ \___/|_|   \__|           //
//                          | |                              //
//                          |_|                              //
///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
// This takes requests to https://import-customers.herokuapp.com and sends the data to TookanApp's API
// We don't need to send any response as the Shopify data is imported via a webhook
///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////

// Express
// Added a bunch of stuff from https://stackoverflow.com/a/5994334/1143732
// BaseURL https://github.com/expressjs/express/issues/1611#issuecomment-38358502
const express = require('express')
const app     = express()
const router  = express.Router()

// Processing
// Allows us to process inboud requests from the likes of Shopify etc
// https://medium.com/@scottdixon/verifying-shopify-webhooks-with-nodejs-express-ac7845c9e40a
const getRawBody  = require('raw-body')
const crypto      = require('crypto')
const secretKey   = process.env.SHOPIFY_KEY

// Tookan API
const request = require('request')
const tookan  = process.env.TOOKAN_KEY

///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
//             _____                                         //
//            /  ___|                                        //
//            \ `--.  ___ _ ____   _____ _ __                //
//             `--. \/ _ \ '__\ \ / / _ \ '__|               //
//            /\__/ /  __/ |   \ V /  __/ |                  //
//            \____/ \___|_|    \_/ \___|_|                  //
//                                                           //
///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////

// The server runs on the NGinx reverse proxy
// As long as it's on port 3000, should be okay
app.set('port', (process.env.PORT || 3000))
app.use(express.static(__dirname + '/public')) // Assets

// Base URL
// This is meant to provide users with the ability to access the app on /order
// It allows us to use relative URL's without having to make a big deal about accepting inbound requests etc
app.use('', router);

// BodyParser
// Allows us to view/manage data passed through the body tag of the request
// https://stackoverflow.com/a/24330353/1143732
// No need for bodyparser package anymore - https://expressjs.com/en/4x/api.html#express.json
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Error
// https://webapplog.com/error-handling-and-running-an-express-js-app/
app.use(function(err, req, res, next) {
    if(!err) return next(); // required otherwise the middleware will fire every time

    // Erroneous response
    // https://gist.github.com/zcaceres/2854ef613751563a3b506fabce4501fd#handling-errors
    if (!err.statusCode) err.statusCode = 500; // If err has no specified error code, set error code to 'Internal Server Error (500)'
    res.status(err.statusCode).send(err.message); // All HTTP requests must have a response, so let's send back an error with its status code and message
});

// Server
// Allows us to accept inbound requests
app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'))
})

///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
//                 _____           _                         //
//                /  __ \         | |                        //
//                | /  \/ ___   __| | ___                    //
//                | |    / _ \ / _` |/ _ \                   //
//                | \__/\ (_) | (_| |  __/                   //
//                 \____/\___/ \__,_|\___|                   //
//                                                           //
///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////


// INBOUND
// https://import-customers.herokuapp.com (POST)
// This has to be JSON/XHR only && accept the data from Shopify
// This will take the data, send it to Shopify and then build a "checkout" response
router
  .route('/')
  .post(express.urlencoded({extended: false}), async function(req,res,next) {

    // Declarations
    const rawBody = await getRawBody(req)
    const hmac    = req.get('X-Shopify-Hmac-Sha256')
    const hash    = crypto.createHmac('sha256', secretKey).update(rawBody, 'utf8', 'hex').digest('base64')

    // Compare our hash to Shopify's hash
    if (hash === hmac) {
      console.log('🎉 New Order!')
    } else {
      console.log('Not from Shopify!')
      res.sendStatus(403)
    }

    // Build dataset
    const order = JSON.parse(rawBody.toString())

    // Tookan API Data
    // If "agent" tag present in customer signup, create an agent
    if (order.tags.includes('agent')) {
      var url = 'https://api.tookanapp.com/v2/add_agent'
      var tookan_body = {
        "api_key":        tookan,
        "username":       order.email,
        "phone":          order.phone                   || "000",
        "first_name":     order.first_name              || "First",
        "last_name":      order.last_name               || "Last",
        "team_id":        process.env.TOOKAN_TEAM       || "Default Team",
        "timezone":       process.env.TOOKAN_TIMESTAMP  || "-330",
        "color":          process.env.TOOKAN_COLOR      || "blue"
      }
    } else {
      var url = 'https://api.tookanapp.com/v2/customer/add'
      var tookan_body = {
        "api_key":        tookan,
        "user_type":      0,
        "email":          order.email,
        "name":           order.name || "Test",
        "phone":          order.phone || "000",
        "address":        order.default_address,
      }
    }

    request({
      method: 'POST',
      url: url,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tookan_body)
    }, function (error, response, body) {
      console.log('Status:', response.statusCode);
      console.log('Headers:', JSON.stringify(response.headers));
      console.log('Response:', body);
    });

    // All completed successfully
    res.sendStatus(200)

});

///////////////////////////////////////////////////////////////
///////////////////////////////////////////////////////////////
