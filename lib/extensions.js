Number.prototype.gcd = function(b) {
  return (b == 0) ? this : this.gcd(this % b);
}

String.prototype.toAspectRatio = function() {
  var p = this.split(':');
  if (p.length != 2) {
    return undefined;
  } else {
    return {
      x: parseInt(p[0]),
      y: parseInt(p[1])
    };
  }
}