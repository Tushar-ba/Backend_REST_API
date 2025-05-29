const rateLimit = require ('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Too many request from this IP'
});

module.exports = () => limiter;
