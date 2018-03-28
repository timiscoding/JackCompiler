/**
 * Implements enums using symbols.
 * Modified to use plain ES6. This code is found at
 * https://gist.github.com/xmlking/e86e4f15ec32b12c4689#file-enum-es6-js-L37
 * */

class EnumSymbol {
  constructor(name, { value, description }) {
    if (!Object.is(value, undefined)) this.value = value;
    if (description) this.description = description;
    this.sym = Symbol.for(name);
    Object.freeze(this);
  }

  get display() {
    return this.description || Symbol.keyFor(this.sym);
  }

  toString() {
    return this.sym;
  }

  valueOf() {
    return this.value;
  }
}

class Enum {
  constructor(enumLiterals) {
    for (let key in enumLiterals) {
      if (!enumLiterals[key]) throw new TypeError('each enum should have been initialized with atleast empty {} value');
      this[key] = new EnumSymbol(key, enumLiterals[key]);
    }
    Object.freeze(this);
  }

  symbols() {
    const result = [];
    for (let key of Object.keys(this)) result.push(this[key]);

    return result;
  }

  keys() {
    return Object.keys(this);
  }

  contains(sym) {
    if (!(sym instanceof EnumSymbol)) return false;
    return this[Symbol.keyFor(sym.sym)] === sym;
  }
}

module.exports = {
  Enum,
  EnumSymbol,
};
