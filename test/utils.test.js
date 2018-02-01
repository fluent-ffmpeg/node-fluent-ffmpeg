/*jshint node:true*/
/*global describe,it*/
'use strict';

var utils = require('../lib/utils');

describe('Utilities', function() {

  describe('Argument list helper', function() {
    it('Should add arguments to the list', function() {
      var args = utils.args();

      args('-one');
      args('-two', 'two-param');
      args('-three', 'three-param1', 'three-param2');
      args(['-four', 'four-param', '-five', '-five-param']);

      args.get().length.should.equal(10);
    });

    it('Should return the argument list', function() {
      var args = utils.args();

      args('-one');
      args('-two', 'two-param');
      args('-three', 'three-param1', 'three-param2');
      args(['-four', 'four-param', '-five', '-five-param']);

      var arr = args.get();
      Array.isArray(arr).should.equal(true);
      arr.length.should.equal(10);
      arr.indexOf('-three').should.equal(3);
      arr.indexOf('four-param').should.equal(7);
    });

    it('Should clear the argument list', function() {
      var args = utils.args();

      args('-one');
      args('-two', 'two-param');
      args('-three', 'three-param1', 'three-param2');
      args(['-four', 'four-param', '-five', '-five-param']);
      args.clear();

      args.get().length.should.equal(0);
    });

    it('Should retrieve arguments from the list', function() {
      var args = utils.args();

      args('-one');
      args('-two', 'two-param');
      args('-three', 'three-param1', 'three-param2');
      args(['-four', 'four-param', '-five', '-five-param']);

      var one = args.find('-one');
      Array.isArray(one).should.equal(true);
      one.length.should.equal(0);

      var two = args.find('-two', 1);
      Array.isArray(two).should.equal(true);
      two.length.should.equal(1);
      two[0].should.equal('two-param');

      var three = args.find('-three', 2);
      Array.isArray(three).should.equal(true);
      three.length.should.equal(2);
      three[0].should.equal('three-param1');
      three[1].should.equal('three-param2');

      var nope = args.find('-nope', 2);
      (typeof nope).should.equal('undefined');
    });

    it('Should remove arguments from the list', function() {
      var args = utils.args();

      args('-one');
      args('-two', 'two-param');
      args('-three', 'three-param1', 'three-param2');
      args(['-four', 'four-param', '-five', '-five-param']);

      args.remove('-four', 1);
      var arr = args.get();
      arr.length.should.equal(8);
      arr[5].should.equal('three-param2');
      arr[6].should.equal('-five');

      args.remove('-one');
      arr = args.get();
      arr.length.should.equal(7);
      arr[0].should.equal('-two');

      args.remove('-three', 2);
      arr = args.get();
      arr.length.should.equal(4);
      arr[1].should.equal('two-param');
      arr[2].should.equal('-five');
    });
  });

  describe('timemarkToSeconds', function() {
    it('should correctly convert a simple timestamp', function() {
      utils.timemarkToSeconds('00:02:00.00').should.be.equal(120);
    });
    it('should correctly convert a complex timestamp', function() {
      utils.timemarkToSeconds('00:08:09.10').should.be.equal(489.1);
    });
    it('should correclty convert a simple float string timestamp', function() {
      utils.timemarkToSeconds('132.44').should.be.equal(132.44);
    });
    it('should correclty convert a simple float timestamp', function() {
      utils.timemarkToSeconds(132.44).should.be.equal(132.44);
    });
  });

  describe('Codec data handling', function() {
    it('should itemize codec details on outer commas', function() {
      const video_details = ['h264 (Constrained Baseline) (avc1 / 0x31637661)', 'yuv420p(tv, bt709)', '1280x720', '1000 kb/s', '30 fps', '30 tbr', '90k tbn', '60 tbc (default)'];
      const videoString = 'Video: ' + video_details.join(', ');
      const stderrLine = 'Stream #0:0(und): ' + videoString;
      const codecsObject = {inputStack: [{}], inputIndex: 0, inInput: true};
      utils.extractCodecData(undefined, stderrLine, codecsObject);
      codecsObject.inputStack[0].video.should.equal(video_details[0]);
      codecsObject.inputStack[0].video_details.should.eql(video_details);
    });
  });

  describe('Lines ring buffer', function() {
    it('should append lines', function() {
      var ring = utils.linesRing(100);
      ring.append('foo\nbar\nbaz\n');
      ring.append('foo\nbar\nbaz\n');
      ring.get().should.equal('foo\nbar\nbaz\nfoo\nbar\nbaz\n');
    });

    it('should append partial lines', function() {
      var ring = utils.linesRing(100);
      ring.append('foo');
      ring.append('bar\nbaz');
      ring.append('moo');
      ring.get().should.equal('foobar\nbazmoo');
    });

    it('should call line callbacks', function() {
      var lines = [];
      function cb(l) {
        lines.push(l);
      }

      var lines2 = [];
      function cb2(l) {
        lines2.push(l);
      }

      var ring = utils.linesRing(100);
      ring.callback(cb);
      ring.callback(cb2);

      ring.append('foo\nbar\nbaz');
      lines.length.should.equal(2);
      lines[0].should.equal('foo');
      lines[1].should.equal('bar');

      lines2.length.should.equal(2);
      lines2[0].should.equal('foo');
      lines2[1].should.equal('bar');

      ring.append('moo\nmeow\n');
      lines.length.should.equal(4);
      lines[2].should.equal('bazmoo');
      lines[3].should.equal('meow');

      lines2.length.should.equal(4);
      lines2[2].should.equal('bazmoo');
      lines2[3].should.equal('meow');
    });

    it('should close correctly', function() {
      var lines = [];
      function cb(l) {
        lines.push(l);
      }

      var ring = utils.linesRing(100);
      ring.callback(cb);

      ring.append('foo\nbar\nbaz');
      lines.length.should.equal(2);
      lines[0].should.equal('foo');
      lines[1].should.equal('bar');

      ring.close();
      lines.length.should.equal(3);
      lines[2].should.equal('baz');

      ring.append('moo\nmeow\n');
      lines.length.should.equal(3);
      ring.get().should.equal('foo\nbar\nbaz');
    });

    it('should limit lines', function() {
      var ring = utils.linesRing(2);
      ring.append('foo\nbar\nbaz');
      ring.get().should.equal('bar\nbaz');
      ring.append('foo\nbar');
      ring.get().should.equal('bazfoo\nbar');
    });

    it('should allow unlimited lines', function() {
      var ring = utils.linesRing(0);
      ring.append('foo\nbar\nbaz');
      ring.get().should.equal('foo\nbar\nbaz');
      ring.append('foo\nbar');
      ring.get().should.equal('foo\nbar\nbazfoo\nbar');
    });
  });
});
