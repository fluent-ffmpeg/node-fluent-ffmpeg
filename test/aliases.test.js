/*jshint node:true*/
/*global describe,it*/
'use strict';

var Ffmpeg = require('../index');

var aliases = {
  audio: {
    withNoAudio: ['noAudio'],
    withAudioCodec: ['audioCodec'],
    withAudioBitrate: ['audioBitrate'],
    withAudioChannels: ['audioChannels'],
    withAudioFrequency: ['audioFrequency'],
    withAudioQuality: ['audioQuality'],
    withAudioFilter: ['withAudioFilters','audioFilter','audioFilters']
  },

  custom: {
    addInputOption: ['addInputOptions','withInputOption','withInputOptions','inputOption','inputOptions'],
    addOutputOption: ['addOutputOptions','addOption','addOptions','withOutputOption','withOutputOptions','withOption','withOptions','outputOption','outputOptions'],
    complexFilter: ['filterGraph']
  },

  inputs: {
    addInput: ['input','mergeAdd'],
    fromFormat: ['withInputFormat','inputFormat'],
    withInputFps: ['withInputFPS','withFpsInput','withFPSInput','inputFPS','inputFps','fpsInput','FPSInput'],
    native: ['withNativeFramerate','nativeFramerate'],
    setStartTime: ['seekInput']
  },

  misc: {
    usingPreset: ['preset'],
    withStrictExperimental: ['strict'],
    updateFlvMetadata: ['flvmeta']
  },

  output: {
    addOutput: ['output'],
    withDuration: ['duration','setDuration'],
    toFormat: ['withOutputFormat','outputFormat','format'],
    seek: ['seekOutput']
  },

  video: {
    withNoVideo: ['noVideo'],
    withVideoCodec: ['videoCodec'],
    withVideoBitrate: ['videoBitrate'],
    withVideoFilter: ['withVideoFilters','videoFilter','videoFilters'],
    withOutputFps: ['withOutputFPS','withFpsOutput','withFPSOutput','withFps','withFPS','outputFPS','outputFps','fpsOutput','FPSOutput','fps','FPS'],
    takeFrames: ['withFrames','frames']
  },

  videosize: {
    keepPixelAspect: ['keepDisplayAspect','keepDisplayAspectRatio','keepDAR'],
    withSize: ['setSize', 'size'],
    withAspect: ['withAspectRatio','setAspect','setAspectRatio','aspect','aspectRatio'],
    applyAutopadding: ['applyAutoPadding','applyAutopad','applyAutoPad','withAutopadding','withAutoPadding','withAutopad','withAutoPad','autoPad','autopad']
  },

  processing: {
    saveToFile: ['save'],
    writeToStream: ['stream', 'pipe'],
    run: ['exec', 'execute'],
    concat: ['concatenate', 'mergeToFile'],
    screenshots: ['screenshot', 'thumbnails', 'thumbnail', 'takeScreenshots']
  }
};

describe('Method aliases', function() {
  Object.keys(aliases).forEach(function(category) {
    describe(category + ' methods', function() {
      Object.keys(aliases[category]).forEach(function(method) {
        describe('FfmpegCommand#' + method, function() {
          aliases[category][method].forEach(function(alias) {
            it('should have a \'' + alias + '\' alias', function() {
              var ff = new Ffmpeg();

              (typeof ff[method]).should.equal('function');
              ff[method].should.equal(ff[alias]);
            });
          });
        });
      });
    });
  });
});