import fs from 'fs';
import {default as JackTokenizer, TokenTypes, TokenKeywords} from './JackTokenizer';
import {default as SymbolTable, SymbolTableKinds} from './SymbolTable';
import {default as VMWriter, Segments, Commands} from './VMWriter';

const { KEYWORD, SYMBOL, IDENTIFIER, INT_CONST, STRING_CONST } = TokenTypes;
const {
  CLASS, METHOD, FUNCTION, CONSTRUCTOR, INT, BOOLEAN, CHAR, VOID, VAR, STATIC, FIELD, LET,
  DO, IF, ELSE, WHILE, RETURN, TRUE, FALSE, NULL, THIS,
} = TokenKeywords;

const tokenMethod = new Map([
  [KEYWORD, JackTokenizer.prototype.keyword],
  [SYMBOL, JackTokenizer.prototype.symbol],
  [IDENTIFIER, JackTokenizer.prototype.identifier],
  [INT_CONST, JackTokenizer.prototype.intVal],
  [STRING_CONST, JackTokenizer.prototype.stringVal]
]);
const TYPE_RULE = [INT, CHAR, BOOLEAN, IDENTIFIER];
const KEYWORD_CONSTANT = [TRUE, FALSE, NULL, THIS];
const toEntity = (str) => str.replace(/(")|(<)|(>)|(&)/g, (m, quote, lt, gt, amp) => {
  if (quote) {
    return '&quot;';
  } else if (lt) {
    return '&lt;';
  } else if (gt) {
    return '&gt;';
  } else if (amp) {
    return '&amp;';
  }
});
const symbolKind = (tokenKeyword) => {
  switch(tokenKeyword) {
    case STATIC: return SymbolTableKinds.STATIC;
    case FIELD: return SymbolTableKinds.FIELD;
    case VAR: return SymbolTableKinds.VAR;
  }
};
const symbolKindToSegment = kind => {
  if (kind === SymbolTableKinds.STATIC) { return Segments.STATIC; }
  else if (kind === SymbolTableKinds.FIELD) { return Segments.THIS; }
  else if (kind === SymbolTableKinds.VAR) { return Segments.LOCAL; }
  else if (kind === SymbolTableKinds.ARG) { return Segments.ARG; }
}

export default class CompilationEngine {
  constructor(inputFile, outputFile, enableLog=false) {
    this.inputFile = inputFile;
    this.tk = new JackTokenizer(inputFile);
    this.st = new SymbolTable();
    this.vw = new VMWriter(outputFile);
    this.indentLevel = 0;
    this.enableLog = enableLog;
    this.labelGen = this.labelGenerator();
    this.genLabel = controlFlow => {
      this.labelGen.next();;
      return this.labelGen.next(controlFlow).value;
    }

    if (enableLog) {
      this.outputFile = fs.openSync(outputFile + '_symbol.xml', 'w+');
    }

    if (this.tk.hasMoreTokens()) {
      this.tk.advance(); // set the first token
    }

    this.logWrapper(this.compileClass, 'class');
  }

  getToken(tokenType) {
    return tokenMethod.get(tokenType).call(this.tk);
  }

  *labelGenerator() {
    const id = {};
    while (true) {
      const controlFlow = yield;

      if (!this.className || !this.subroutineName) {
        throw Error('Cannot generate label from emtpy class/function name');
      }

      if (!['while', 'if'].includes(controlFlow)) {
        throw Error("Arg must be one of 'if', 'while', 'else'");
      }

      const key = this.className + this.subroutineName + controlFlow;
      if (typeof id[key] === 'undefined') {
        id[key] = 0;
      } else {
        id[key]++;
      }

      if (controlFlow === 'while') {
        yield [`WHILE_EXP${id[key]}`, `WHILE_END${id[key]}`];
      } else if (controlFlow === 'if') {
        yield [`IF_FALSE${id[key]}`, `IF_END${id[key]}`];
      }
    }
  }

  log({type, data}={}) {
    if (!this.enableLog) return;
    let str;

    if (type === 'identifierToken') {
      let config = [];
      const { category, defined, kind, index, identifier } = data;
      if (category) {
        config.push(`category="${category}"`);
      }

      if (kind) {
        config.push(`kind="${kind.display}"`);
      }

      if (typeof index === 'number') {
        config.push(`index="${index}"`);
      }

      if (defined) {
        config.push('defined');
      } else {
        config.push('used');
      }

      str = `<identifier${' ' + config.join(' ')}> ${identifier} </identifier>`;
    } else if (type === 'currentToken') {
      const thisTokenType = this.tk.tokenType();
      let thisToken = this.getToken(thisTokenType);

      if (this.tokenOneOf([STRING_CONST, SYMBOL])) {
        thisToken = toEntity(thisToken);
      }

      str = `<${thisTokenType.display}> ${thisToken.display || thisToken} </${thisTokenType.display}>`
    } else if (type === 'raw') {
      str = data;
    }

    fs.appendFileSync(this.outputFile, '  '.repeat(this.indentLevel) + str + '\n');
  }

  logWrapper(compileCb, tag, ...cbArgs) {
    this.log({type: 'raw', data: `<${tag}>`});
    this.indentLevel++;
    const retVal = compileCb.apply(this, cbArgs);
    this.indentLevel--;
    this.log({type: 'raw', data: `</${tag}>`});
    return retVal;
  }

  tokenOneOf(accepted) {
    const thisTokenType = this.tk.tokenType();
    const thisToken = this.getToken(thisTokenType);

    if (Array.isArray(accepted) && accepted.includes(thisToken)) {
      return thisToken;
    } else if (Array.isArray(accepted) && accepted.includes(thisTokenType)) {
      return thisTokenType;
    } else if (accepted === thisToken) {
      return thisToken;
    } else if (accepted === thisTokenType) {
      return thisTokenType;
    }
  }

  eat(accepted) {
    let ate = {token: this.getToken(this.tk.tokenType()), tokenType: this.tk.tokenType()};

    if (this.tokenOneOf(accepted)) {
      this.tk.tokenType() !== IDENTIFIER && this.log({type: 'currentToken'});
      if (this.tk.hasMoreTokens()) {
        this.tk.advance();
      }
    } else {
      throw new Error(`Failed to see "${accepted.display || accepted}" token`);
    }

    return ate;
  }

  compileClass() {
    this.eat(CLASS);
    const {token: identifier} = this.eat(IDENTIFIER);
    this.log({type: 'identifierToken', data: {
      category: 'className',
      defined: true,
      kind: SymbolTableKinds.NONE,
      identifier}});
    this.className = identifier;

    this.eat('{');

    while (this.tokenOneOf([STATIC, FIELD])) {
      this.logWrapper(this.compileClassVarDec, 'classVarDec');
    }

    while (this.tokenOneOf([CONSTRUCTOR, FUNCTION, METHOD])) {
      this.logWrapper(this.compileSubroutineDec, 'subroutineDec');
    }

    this.eat('}');
  }

  compileClassVarDec() {
    const {token: type} = this.eat([STATIC, FIELD]);
    const kind = symbolKind(type);

    const {token: typeIdentifier, tokenType} = this.eat(TYPE_RULE);
    tokenType === IDENTIFIER && this.log({type: 'identifierToken', data: {
      category: 'className',
      defined: false,
      kind: SymbolTableKinds.NONE,
      identifier: typeIdentifier}})

    const {token: identifier} = this.eat(IDENTIFIER);
    this.st.define(identifier, typeIdentifier.display || typeIdentifier, kind);
    this.log({type: 'identifierToken', data: {
      category: "varName",
      kind,
      defined: true,
      index: this.st.indexOf(identifier),
      identifier}});

    while (this.tokenOneOf(',')) {
      this.eat(',');

      const {token: identifier} = this.eat(IDENTIFIER);
      this.st.define(identifier, typeIdentifier.display || typeIdentifier, kind);
      this.log({type: 'identifierToken', data: {
        category: "varName",
        kind,
        defined: true,
        index: this.st.indexOf(identifier),
        identifier}});
    }

    this.eat(';');
  }

  compileSubroutineDec() {
    this.st.startSubroutine();
    const {token: subroutineType} = this.eat([CONSTRUCTOR, FUNCTION, METHOD]);

    if (subroutineType === METHOD) {
      this.st.define('this', this.className, SymbolTableKinds.ARG);
    }

    const {token: typeIdentifier, tokenType} = this.eat([VOID, ...TYPE_RULE]);
    tokenType === IDENTIFIER && this.log({type: 'identifierToken', data: {
      category: 'className',
      defined: false,
      kind: SymbolTableKinds.NONE,
      identifier: typeIdentifier}});

    const {token: identifier} = this.eat(IDENTIFIER);
    this.log({type: 'identifierToken', data: {
      category: 'subroutineName',
      defined: true,
      kind: SymbolTableKinds.NONE,
      identifier}});
    this.subroutineName = identifier;

    this.eat('(');
    this.logWrapper(this.compileParameterList, 'parameterList');
    this.eat(')');
    this.logWrapper(this.compileSubroutineBody, 'subroutineBody', subroutineType);
  }

  compileParameterList() {
    if (this.tokenOneOf(TYPE_RULE)) {
      const {token: typeIdentifier, tokenType} = this.eat(TYPE_RULE);
      tokenType === IDENTIFIER && this.log({type: 'identifierToken', data: {
        category: 'className',
        defined: false,
        kind: SymbolTableKinds.NONE,
        identifier: typeIdentifier}});

      const {token: identifier} = this.eat(IDENTIFIER);
      this.st.define(identifier, typeIdentifier.display || typeIdentifier, SymbolTableKinds.ARG);
      this.log({type: 'identifierToken', data: {
        category: 'varName',
        defined: true,
        kind: SymbolTableKinds.ARG,
        index: this.st.indexOf(identifier),
        identifier}});

      while (this.tokenOneOf(',')) {
        this.eat(',');

        const {token: typeIdentifier, tokenType} = this.eat(TYPE_RULE);
        tokenType === IDENTIFIER && this.log({ type: 'identifierToken', data: {
          category: 'className',
          defined: false,
          kind: SymbolTableKinds.NONE,
          identifier: typeIdentifier}});

        const {token: identifier} = this.eat(IDENTIFIER);
        this.st.define(identifier, typeIdentifier.display || typeIdentifier, SymbolTableKinds.ARG);
        this.log({type: 'identifierToken', data: {
          category: 'varName',
          defined: true,
          kind: SymbolTableKinds.ARG,
          index: this.st.indexOf(identifier),
          identifier}});
      }
    }
  }

  compileSubroutineBody(subroutineType) {
    this.eat('{');

    while (this.tokenOneOf(VAR)) {
      this.logWrapper(this.compileVarDec, 'varDec');
    }

    this.vw.writeFunction(
      `${this.className}.${this.subroutineName}`,
      this.st.varCount(SymbolTableKinds.VAR));

    if (subroutineType === CONSTRUCTOR) {
      this.vw.writePush(Segments.CONST, this.st.varCount(SymbolTableKinds.FIELD));
      this.vw.writeCall('Memory.alloc', 1);
      this.vw.writePop(Segments.POINTER, 0);
    } else if (subroutineType === METHOD) { // link the object (argument 0) with THIS segment
      this.vw.writePush(Segments.ARG, 0);
      this.vw.writePop(Segments.POINTER, 0);
    }

    this.logWrapper(this.compileStatements, 'statements');
    this.eat('}');
  }

  compileVarDec() {
    this.eat(VAR);

    var {token: typeIdentifier, tokenType} = this.eat(TYPE_RULE);
    tokenType === IDENTIFIER && this.log({ type: 'identifierToken', data: {
      category: 'className',
      defined: false,
      kind: SymbolTableKinds.NONE,
      identifier: typeIdentifier}});

    var {token: identifier} = this.eat(IDENTIFIER);
    this.st.define(identifier, typeIdentifier.display || typeIdentifier, SymbolTableKinds.VAR);
    this.log({type: 'identifierToken', data: {
      category: 'varName',
      defined: true,
      kind: SymbolTableKinds.VAR,
      index: this.st.indexOf(identifier),
      identifier}});

    while (this.tokenOneOf(',')) {
      this.eat(',');

      const {token: identifier} = this.eat(IDENTIFIER);
      this.st.define(identifier, typeIdentifier.display || typeIdentifier, SymbolTableKinds.VAR);
      this.log({type: 'identifierToken', data: {
        category: 'varName',
        defined: true,
        kind: SymbolTableKinds.VAR,
        index: this.st.indexOf(identifier),
        identifier}});
    }

    this.eat(';');
  }

  compileStatements() {
    while (this.tokenOneOf([LET, IF, WHILE, DO, RETURN])) {
      const capitalized = this.tk.keyword().display[0].toUpperCase() + this.tk.keyword().display.slice(1);
      this.logWrapper(this[`compile${capitalized}Statement`], `${this.tk.keyword().display}Statement`);
    }
  }

  compileLetStatement() {
    this.eat(LET);
    const {token: identifier} = this.eat(IDENTIFIER);
    this.log({type: 'identifierToken', data: {
      category: 'varName',
      kind: this.st.kindOf(identifier),
      index: this.st.indexOf(identifier),
      defined: false,
      identifier}});

    if (this.tokenOneOf('[')) {
      this.eat('[');
      this.logWrapper(this.compileExpression, 'expression');
      this.eat(']');
    }

    this.eat('=');
    this.logWrapper(this.compileExpression, 'expression');
    this.vw.writePop(symbolKindToSegment(this.st.kindOf(identifier)), this.st.indexOf(identifier));

    this.eat(';');
  }

  compileIfStatement() {
    this.eat(IF);
    this.eat('(');
    this.logWrapper(this.compileExpression, 'expression');

    this.vw.writeArithmetic(Commands.NOT);
    const [IF_FALSE, IF_END] = this.genLabel('if');
    this.vw.writeIf(IF_FALSE);

    this.eat(')');
    this.eat('{');
    this.logWrapper(this.compileStatements, 'statements');
    this.eat('}');

    if (this.tokenOneOf(ELSE)) {
      this.eat(ELSE);
      this.eat('{');

      this.vw.writeGoto(IF_END);
      this.vw.writeLabel(IF_FALSE);
      this.logWrapper(this.compileStatements, 'statements');
      this.vw.writeLabel(IF_END);

      this.eat('}');
    } else {
      this.vw.writeLabel(IF_FALSE);
    }
  }

  compileWhileStatement() {
    this.eat(WHILE);
    this.eat('(');

    const [WHILE_EXP, WHILE_END] = this.genLabel('while');
    this.vw.writeLabel(WHILE_EXP);
    this.logWrapper(this.compileExpression, 'expression');
    this.vw.writeArithmetic(Commands.NOT);
    this.vw.writeIf(WHILE_END);

    this.eat(')');
    this.eat('{');

    this.logWrapper(this.compileStatements, 'statements');

    this.vw.writeGoto(WHILE_EXP);
    this.eat('}');
    this.vw.writeLabel(WHILE_END);
  }

  compileDoStatement() {
    this.eat(DO);
    // subroutineCall rule
    const {token: identifier} = this.eat(IDENTIFIER);
    const logData = {kind: this.st.kindOf(identifier), index: this.st.indexOf(identifier), defined: false, identifier};

    if (this.tk.symbol() === '.') {
      this.log({type: 'identifierToken', data: {
        ...logData,
        category: this.st.exists(logData.identifier) ? 'varName' : 'className'}});
      this.eat('.');

      const {token: subroutineName} = this.eat(IDENTIFIER);
      this.log({type: 'identifierToken', data: {
        category: 'subroutineName',
        kind: SymbolTableKinds.NONE,
        defined: false,
        identifier: subroutineName}});

      this.eat('(');

      if (this.st.exists(identifier)) { // calling a method on an object identifier
        // pop the object base address
        this.vw.writePush(symbolKindToSegment(this.st.kindOf(identifier)), this.st.indexOf(identifier));
        const nArgs = this.logWrapper(this.compileExpressionList, 'expressionList') + 1;
        const className = this.st.typeOf(identifier);
        this.vw.writeCall(`${className}.${subroutineName}`, nArgs);
      } else { // calling a function
        const nArgs = this.logWrapper(this.compileExpressionList, 'expressionList');
        this.vw.writeCall(`${identifier}.${subroutineName}`, nArgs);
      }
      this.vw.writePop(Segments.TEMP, 0);

      this.eat(')');
    } else if (this.tk.symbol() === '(') { // calling method from the class that declares it
      this.log({type: 'identifierToken', data: {...logData, category: 'subroutineName'}});
      this.eat('(');

      if (this.st.exists('this')) { // inside another method
        this.vw.writePush(Segments.ARG, 0);
      } else { // inside constructor
        this.vw.writePush(Segments.POINTER, 0);
      }
      const nArgs = this.logWrapper(this.compileExpressionList, 'expressionList') + 1;
      this.vw.writeCall(`${this.className}.${identifier}`, nArgs);
      this.vw.writePop(Segments.TEMP, 0);

      this.eat(')');
    } else {
      throw new Error('Failed to see "(" or "." token');
    }

    this.eat(';');
  }

  compileReturnStatement() {
    this.eat(RETURN);
    if (this.tokenOneOf([INT_CONST, STRING_CONST, ...KEYWORD_CONSTANT, IDENTIFIER, '(', '-', '~'])) {
      this.logWrapper(this.compileExpression, 'expression');
    } else {
      this.vw.writePush(Segments.CONST, 0);
    }

    this.vw.writeReturn();
    this.eat(';');
  }

  compileExpression() {
    this.logWrapper(this.compileTerm, 'term');

    while (this.tokenOneOf(['+', '-', '*', '/', '&', '|', '<', '>', '='])) {
      const {token, tokenType} = this.eat(this.tk.symbol());
      this.logWrapper(this.compileTerm, 'term');

      if (token === '+') { this.vw.writeArithmetic(Commands.ADD); }
      else if (token === '-') { this.vw.writeArithmetic(Commands.SUB); }
      else if (token === '*') { this.vw.writeCall('Math.multiply', 2); }
      else if (token === '/') { this.vw.writeCall('Math.divide', 2); }
      else if (token === '&') { this.vw.writeArithmetic(Commands.AND); }
      else if (token === '|') { this.vw.writeArithmetic(Commands.OR); }
      else if (token === '<') { this.vw.writeArithmetic(Commands.LT); }
      else if (token === '>') { this.vw.writeArithmetic(Commands.GT); }
      else if (token === '=') { this.vw.writeArithmetic(Commands.EQ); }
    }
  }

  compileTerm() {
    if (this.tokenOneOf(IDENTIFIER)) {
      const {token: identifier} = this.eat(IDENTIFIER);
      const logData = {kind: this.st.kindOf(identifier), defined: false, index: this.st.indexOf(identifier), identifier};

      /* cases '.' and '(' comprise the subroutineCall rule.
        The '[' case is array access. The default case is plain varName */
      if (this.tk.symbol() === '.') {
        this.log({type: 'identifierToken', data: {
          ...logData,
          category: this.st.exists(logData.identifier) ? 'varName' : 'className'}});
        this.eat('.');

        const {token: subroutineName} = this.eat(IDENTIFIER);
        this.log({type: 'identifierToken', data: {
          category: 'subroutineName',
          defined: false,
          kind: SymbolTableKinds.NONE,
          identifier: subroutineName}});

        this.eat('(');
        const nArgs = this.logWrapper(this.compileExpressionList, 'expressionList');
        this.eat(')');

        this.vw.writeCall(`${identifier}.${subroutineName}`, nArgs);
      } else if (this.tk.symbol() === '(') {
        this.log({type: 'identifierToken', data: {...logData, category: 'subroutineName'}});
        this.eat('(');
        const nArgs = this.logWrapper(this.compileExpressionList, 'expressionList');
        this.eat(')');
      } else if (this.tk.symbol() === '[') {
        this.log({type: 'identifierToken', data: {...logData, category: 'varName'}});
        this.eat('[');
        this.logWrapper(this.compileExpression, 'expression');
        this.eat(']');
      } else {
        this.log({type: 'identifierToken', data: {...logData, category: 'varName'}});

        this.vw.writePush(symbolKindToSegment(this.st.kindOf(identifier)), this.st.indexOf(identifier));
      }
    } else if (this.tokenOneOf('(')) {
      this.eat('(');
      this.logWrapper(this.compileExpression, 'expression');
      this.eat(')');
    } else if (this.tokenOneOf(['-', '~'])) { // unaryOp term
      const {token} = this.eat(this.tk.symbol());
      this.logWrapper(this.compileTerm, 'term');

      if (token === '-') {
        this.vw.writeArithmetic(Commands.NEG);
      } else if (token === '~') {
        this.vw.writeArithmetic(Commands.NOT);
      }
    } else {
      const {token, tokenType} = this.eat([INT_CONST, STRING_CONST, ...KEYWORD_CONSTANT]);

      if (tokenType === INT_CONST) {
        this.vw.writePush(Segments.CONST, token);
      } else if (token === NULL || token === FALSE) {
        this.vw.writePush(Segments.CONST, 0);
      } else if (token === TRUE) {
        this.vw.writePush(Segments.CONST, 1);
        this.vw.writeArithmetic(Commands.NEG);
      } else if (token === THIS) {
        if (this.st.exists('this')) { // we are in method
          this.vw.writePush(Segments.ARG, 0);
        } else { // we are in constructor
          this.vw.writePush(Segments.POINTER, 0);
        }
      }
    }
  }

  compileExpressionList() {
    let count = 0;
    if (this.tokenOneOf([INT_CONST, STRING_CONST, ...KEYWORD_CONSTANT, IDENTIFIER, '(', '-', '~'])) {
      this.logWrapper(this.compileExpression, 'expression');
      count++;

      while (this.tokenOneOf(',')) {
        this.eat(',');
        this.logWrapper(this.compileExpression, 'expression');
        count++;
      }
    }

    return count;
  }

  dispose() {
    if (!this.enableLog) return;
    fs.closeSync(this.outputFile);
    this.outputFile = null;
  }
}
