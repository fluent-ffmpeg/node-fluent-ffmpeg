Registry = {};

Registry.instance = (function() {
  var reg = {
    values : new Array(),
    getIndex: function(name) {
	    for (var i = 0; i < this.registry.length; i++) {
	      if (reg.values[i].name == _name) {
	        return i;
	      }
	    }
	    return null;
	  },
    set : function(name, value) {
      if (reg.get(name) == null) {
      	reg.values.push({ name: name, value: value });
      } else {
      	reg.values[reg.getIndex(name)].value = value;
      }
    },
    get: function(name) {
    	for (var i = 0; i < reg.values.length; i++) {
		    if (reg.values[i].name == name) {
		      return reg.values[i].value;
		    }
		  }
		  return null;
    },
    reset: function() {
    	reg.values = new Array();
    }
  };
  
  return reg;
})();