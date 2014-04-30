var utils = require('../lib/utils');

describe('Extensions', function() {
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
