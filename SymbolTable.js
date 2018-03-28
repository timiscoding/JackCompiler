const {Enum} = require('./Enum');

const SymbolTableKinds = new Enum({
  NONE: {value: 0, description: 'none'},
  STATIC: {value: 1, description: 'static'},
  FIELD: {value: 2, description: 'field'},
  ARG: {value: 3, description: 'arg'},
  VAR: {value: 4, description: 'var'},
});

const {NONE, STATIC, FIELD, ARG, VAR} = SymbolTableKinds;

class SymbolTable {
  constructor() {
    this.classTable = {};
    this.subroutineTable = {};
    this.varCounts = {
      [STATIC]: 0,
      [FIELD]: 0,
      [ARG]: 0,
      [VAR]: 0,
    };
  }

  // reset subroutine symbol table
  startSubroutine() {
    this.subroutineTable = {};
    this.varCounts[ARG] = 0;
    this.varCounts[VAR] = 0;
  }

  define(name, type, kind) {
    if ([STATIC, FIELD].includes(kind)) {
      this.classTable[name] = {type, kind, index: this.varCounts[kind.toString()]++};
    } else if ([ARG, VAR].includes(kind)) {
      this.subroutineTable[name] = { type, kind, index: this.varCounts[kind.toString()]++};
    }
  }

  varCount(kind) {
    return this.varCounts[kind];
  }

  kindOf(name) {
    if (this.subroutineTable[name]) {
      return this.subroutineTable[name].kind;
    } else if (this.classTable[name]) {
      return this.classTable[name].kind;
    } else {
      return NONE;
    }
  }

  typeOf(name) {
    if (this.subroutineTable[name]) {
      return this.subroutineTable[name].type;
    } else if (this.classTable[name]) {
      return this.classTable[name].type;
    }
  }

  indexOf(name) {
    if (this.subroutineTable[name] && typeof this.subroutineTable[name].index === 'number') {
      return this.subroutineTable[name].index;
    } else if (this.classTable[name] && typeof this.classTable[name].index === 'number') {
      return this.classTable[name].index;
    }
  }

  exists(name) {
    return name in this.subroutineTable || name in this.classTable;
  }
}

module.exports = {
  SymbolTableKinds,
  SymbolTable,
};
