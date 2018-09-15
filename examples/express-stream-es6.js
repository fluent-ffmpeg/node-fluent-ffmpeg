const express = require('express');
const ffmpeg = require('../index');

express()
  .use(express.static(`${__dirname}/flowplayer`))
  .get('/', (req, res) => res.send('index.html'))
  .get('/video/:filename', (req, res) => {
    const { filename } = req;
    res.contentType('flv');
    // FFMPEG grabbing from where file is stored locally
    ffmpeg(`/path/to/storage/${filename}`)
      // flv preset is reliable for web video, as a starter
      .preset('flashvideo')
      // Listeners (errors, end, progress, etc)
      .on('end', () => console.log('Converted file successfully!'))
      .on('error', err => console.error('Error!', err))
      // Piping to a stream to be consumed on the client side
      .pipe(res);
  })
  .listen(4321);
