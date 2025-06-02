const cors = require('cors');
require('dotenv').config;
const port = process.env.PORT;
const corsOptions = {
    origin: "*",
    methods: ['GET','POST','PUT','DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'], 
  credentials: true, 
};
module.exports = () => cors(corsOptions);