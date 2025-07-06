const Redis = require("ioredis");

const redis = new Redis({
  host: "YOUR_PI_IP", // e.g. "192.168.2.105"
  port: 6379,
  // password: "if-you-set-one", // only if protected mode/password is enabled
});

module.exports = redis;
