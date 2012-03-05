exports = module.exports = {
	determineFfmpegPath: function() {
		if (process.env.FFMPEG_PATH) {
			return process.env.FFMPEG_PATH;
		}
		return 'ffmpeg';
	}
}