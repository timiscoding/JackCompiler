import fs from 'fs';
import assert from 'assert';
import Enum from './Enum';

export const Segments = new Enum({
  CONST: {value: 0, description: 'constant'},
  ARG: {value: 1, description: 'arg'},
  LOCAL: {value: 2, description: 'local'},
  STATIC: {value: 3, description: 'static'},
  THIS: {value: 4, description: 'this'},
  THAT: {value: 5, description: 'that'},
  POINTER: {value: 6, description: 'pointer'},
  TEMP: {value: 7, description: 'temp'},
});

export const Commands = new Enum({
  ADD: {value:0, description: 'add'},
  SUB: {value:1, description: 'sub'},
  NEG: {value:2, description: 'neg'},
  EQ: {value:3, description: 'eq'},
  GT: {value:4, description: 'gt'},
  LT: {value:5, description: 'lt'},
  AND: {value:6, description: 'and'},
  OR: {value:7, description: 'or'},
  NOT: {value:8, description: 'not'},
});

export default class VMWriter {
  constructor(outputFilename) {
    this.outputFile = fs.openSync(outputFilename + '.vm', 'w+');
  }

  write(str) {
    fs.appendFileSync(this.outputFile, str + '\n');
  }

  writePush(segment, index) {
    assert(Segments.contains(segment), 'Segment must be a Segments.CONST, Segments.ARG, etc');
    assert(Number.isInteger(index) && index >= 0, 'index must be an integer >= 0');

    this.write(`push ${segment.display} ${index}`);
  }

  writePop(segment, index) {
    assert(Segments.contains(segment), 'Segment must be a Segments.CONST, Segments.ARG, etc');
    assert(Number.isInteger(index) && index >= 0, 'index must be an integer >= 0');
    assert.notEqual(segment, Segments.CONST, 'Cannot pop constant');

    this.write(`pop ${segment.display} ${index}`);
  }

  writeArithmetic(command) {
    assert(Commands.contains(command), 'Command must be a Commands.ADD, Commands.SUB, etc');

    this.write(command.display);
  }

  writeLabel(label) {
    this.write(`label ${label}`);
  }

  writeGoto(label) {
    this.write(`goto ${label}`);
  }

  writeIf(label) {
    this.write(`if-goto ${label}`);
  }

  writeCall(name, nArgs) {
    assert(Number.isInteger(nArgs) && nArgs >= 0, 'nArgs must be an integer >= 0');

    this.write(`call ${name} ${nArgs}`);
  }

  writeFunction(name, nLocals) {
    assert(Number.isInteger(nLocals) && nLocals >= 0, 'nLocals must be an integer >= 0');

    this.write(`function ${name} ${nLocals}`);
  }

  writeReturn() {
    this.write('return');
  }

  close() {
    fs.closeSync(this.outputFile);
    this.outputFile = null;
  }
}
