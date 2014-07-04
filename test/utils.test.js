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
    it('should correclty convert a simple float timestamp', function() {
      utils.timemarkToSeconds('132.44').should.be.equal(132.44);
    });
  });
});
