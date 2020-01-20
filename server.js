const config = require('config');
const mongoose = require('mongoose');   // Module to connect to MongoDB

// module.exports = function () {

//     const dbConnUrl = config.get('db_conn_url');

//     // Connect to the database. In case of any error, log the error and exit as this is a Fatal error.
//     mongoose.connect(dbConnUrl)
//         .then(() => logger.info('Successfully connected to the Database.'))
//         .catch(error => {
//             logger.info('FATAL ERROR: Connection to Database Failed.');
//             throw new Error(error);
//         });
// };
var express = require('express');
const app = express();
var i = config.get('appPort');
app.listen(i, () => console.log("Starting Server. Listening on Port", i));

app.get('/', async function(req, res){
    res.send('<h1>Hello World</h1>');
});