exports = module.exports = {
  instance: {
    values: [],
    getIndex: function(name) {
      for (var i = 0; i < this.values.length; i++) {
        if (this.values[i].name === name) {
          return i;
        }
      }
    },
    set : function(name, value) {
      if (this.get(name) === false) {
        this.values.push({ name: name, value: value });
      } else {
        this.values[this.getIndex(name)].value = value;
      }
    },
    get: function(name) {
      for (var i = 0; i < this.values.length; i++) {
        if (this.values[i].name === name) {
          return this.values[i].value;
        }
      }
      return false;
    },
    reset: function() {
      this.values = [];
    }
  }
};