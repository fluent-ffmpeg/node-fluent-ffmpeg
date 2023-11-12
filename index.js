const isCov =
  process.env.FLUENTFFMPEG_COV === "1" ||
  process.env.FLUENTFFMPEG_COV === "true";
module.exports = require(`./lib${isCov ? "-cov" : ""}/fluent-ffmpeg`);
