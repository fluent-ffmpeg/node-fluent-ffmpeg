/*jshint node:true*/
/*global describe,it,before*/
'use strict';

var Ffmpeg = require('../index'),
  path = require('path'),
  fs = require('fs'),
  Readable = require('stream').Readable,
  assert = require('assert'),
  exec = require('child_process').exec,
  testhelper = require('./helpers');


describe('Metadata', function() {
  before(function(done) {
    // check for ffmpeg installation
    this.testfile = path.join(__dirname, 'assets', 'testvideo-43.avi');

    var self = this;
    exec(testhelper.getFfmpegCheck(), function(err) {
      if (!err) {
        // check if file exists
        fs.exists(self.testfile, function(exists) {
          if (exists) {
            done();
          } else {
            done(new Error('test video file does not exist, check path (' + self.testfile + ')'));
          }
        });
      } else {
        done(new Error('cannot run test without ffmpeg installed, aborting test...'));
      }
    });
  });

  it('should provide an ffprobe entry point', function(done) {
    (typeof Ffmpeg.ffprobe).should.equal('function');
    done();
  });

  it('should return ffprobe data as an object', function(done) {
    Ffmpeg.ffprobe(this.testfile, function(err, data) {
      testhelper.logError(err);
      assert.ok(!err);

      (typeof data).should.equal('object');
      done();
    });
  });

  it('should provide ffprobe format information', function(done) {
    Ffmpeg.ffprobe(this.testfile, function(err, data) {
      testhelper.logError(err);
      assert.ok(!err);

      ('format' in data).should.equal(true);
      (typeof data.format).should.equal('object');
      Number(data.format.duration).should.equal(2);
      data.format.format_name.should.equal('avi');

      done();
    });
  });

  it('should provide ffprobe stream information', function(done) {
    Ffmpeg.ffprobe(this.testfile, function(err, data) {
      testhelper.logError(err);
      assert.ok(!err);

      ('streams' in data).should.equal(true);
      Array.isArray(data.streams).should.equal(true);
      data.streams.length.should.equal(1);
      data.streams[0].codec_type.should.equal('video');
      data.streams[0].codec_name.should.equal('mpeg4');
      Number(data.streams[0].width).should.equal(1024);

      done();
    });
  });

  it('should provide ffprobe stream information with units', function(done) {
    Ffmpeg.ffprobe(this.testfile, ['-unit'], function(err, data) {
      testhelper.logError(err);
      assert.ok(!err);

      ('streams' in data).should.equal(true);
      Array.isArray(data.streams).should.equal(true);
      data.streams.length.should.equal(1);
      data.streams[0].bit_rate.should.equal('322427 bit/s');
      done();
    });
  });

  it('should return ffprobe errors', function(done) {
    Ffmpeg.ffprobe('/path/to/missing/file', function(err) {
      assert.ok(!!err);
      done();
    });
  });

  it('should enable calling ffprobe on a command with an input file', function(done) {
    new Ffmpeg({ source: this.testfile })
      .ffprobe(function(err, data) {
        testhelper.logError(err);
        assert.ok(!err);

        (typeof data).should.equal('object');
        ('format' in data).should.equal(true);
        (typeof data.format).should.equal('object');
        ('streams' in data).should.equal(true);
        Array.isArray(data.streams).should.equal(true);

        done();
      });
  });

  it('should fail calling ffprobe on a command without input', function(done) {
    new Ffmpeg().ffprobe(function(err) {
      assert.ok(!!err);
      err.message.should.match(/No input specified/);
      done();
    });
  });

  it('should allow calling ffprobe on stream input', function(done) {
    var stream = fs.createReadStream(this.testfile);

    new Ffmpeg()
      .addInput(stream)
      .ffprobe(function(err, data) {
        assert.ok(!err);
        data.streams.length.should.equal(1);
        data.format.filename.should.equal('pipe:0');
        done();
      });
  });

  it('should handle errors on stream input to ffprobe', function(done) {
    var faultyStream = new Readable({objectMode: true});
    faultyStream._read = function() {};
    setTimeout(function() {
      faultyStream.emit('error', new Error('Dummy stream read error'));
    }, 50);

    new Ffmpeg()
      .addInput(faultyStream)
      .ffprobe(function(err, data) {
        assert.ok(!!err);
        err.message.should.equal('Dummy stream read error');
        done();
      });
  });
});
