// redis-test.js
const Redis = require("ioredis");

const redis = new Redis({
  host: "192.168.2.138", // e.g. ""
  port: 6379,
});

redis
  .set("test-key", "hello redis")
  .then(() => redis.get("test-key"))
  .then((value) => {
    console.log("Value:", value); // should print "hello redis"
    redis.quit();
  })
  .catch(console.error);
