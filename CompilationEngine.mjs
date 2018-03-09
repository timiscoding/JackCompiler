import fs from 'fs';
import {default as JackTokenizer, TokenTypes, TokenKeywords} from './JackTokenizer';
import {default as SymbolTable, SymbolTableKinds} from './SymbolTable';

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

export default class CompilationEngine {
  constructor(inputFile, outputFile) {
    this.inputFile = inputFile;
    this.outputFile = fs.openSync(outputFile, 'w+');
    this.tk = new JackTokenizer(inputFile);
    this.st = new SymbolTable();
    this.indentLevel = 0;

    if (this.tk.hasMoreTokens()) {
      this.tk.advance(); // set the first token
    }

    this.logWrapper(this.compileClass, 'class');
  }

  getToken(tokenType) {
    return tokenMethod.get(tokenType).call(this.tk);
  }

  log({type, data}={}) {
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

  logWrapper(compileCb, tag) {
    this.log({type: 'raw', data: `<${tag}>`});
    this.indentLevel++;
    compileCb.call(this);
    this.indentLevel--;
    this.log({type: 'raw', data: `</${tag}>`});
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
    this.eat([CONSTRUCTOR, FUNCTION, METHOD]);

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
    this.eat('(');
    this.logWrapper(this.compileParameterList, 'parameterList');
    this.eat(')');
    this.logWrapper(this.compileSubroutineBody, 'subroutineBody');
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

  compileSubroutineBody() {
    this.eat('{');

    while (this.tokenOneOf(VAR)) {
      this.logWrapper(this.compileVarDec, 'varDec');
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
    this.eat(';');
  }

  compileIfStatement() {
    this.eat(IF);
    this.eat('(');
    this.logWrapper(this.compileExpression, 'expression');
    this.eat(')');
    this.eat('{');
    this.logWrapper(this.compileStatements, 'statements');
    this.eat('}');

    if (this.tokenOneOf(ELSE)) {
      this.eat(ELSE);
      this.eat('{');
      this.logWrapper(this.compileStatements, 'statements');
      this.eat('}');
    }
  }

  compileWhileStatement() {
    this.eat(WHILE);
    this.eat('(');
    this.logWrapper(this.compileExpression, 'expression');
    this.eat(')');
    this.eat('{');
    this.logWrapper(this.compileStatements, 'statements');
    this.eat('}');
  }

  compileDoStatement() {
    this.eat(DO);
    // subroutineCall rule
    const {token: identifier} = this.eat(IDENTIFIER);
    const logData = {kind: this.st.kindOf(identifier), index: this.st.indexOf(identifier), defined: false, identifier};

    switch (this.tk.symbol()) {
      case '.':
        this.log({type: 'identifierToken', data: {
          ...logData,
          category: this.st.exists(logData.identifier) ? 'varName' : 'className'}});
        this.eat('.');
        const {token: identifier} = this.eat(IDENTIFIER);
        this.log({type: 'identifierToken', data: {
          category: 'subroutineName',
          kind: SymbolTableKinds.NONE,
          defined: false,
          identifier}});
        this.eat('(');
        this.logWrapper(this.compileExpressionList, 'expressionList');
        this.eat(')');
        break;
      case '(':
        this.log({type: 'identifierToken', data: {...logData, category: 'subroutineName'}});
        this.eat('(');
        this.logWrapper(this.compileExpressionList, 'expressionList');
        this.eat(')');
        break;
      default:
        throw new Error('Failed to see "(" or "." token');
    }

    this.eat(';');
  }

  compileReturnStatement() {
    this.eat(RETURN);
    if (this.tokenOneOf([INT_CONST, STRING_CONST, ...KEYWORD_CONSTANT, IDENTIFIER, '(', '-', '~'])) {
      this.logWrapper(this.compileExpression, 'expression');
    }
    this.eat(';');
  }

  compileExpression() {
    this.logWrapper(this.compileTerm, 'term');

    while (this.tokenOneOf(['+', '-', '*', '/', '&', '|', '<', '>', '='])) {
      this.eat(this.tk.symbol());
      this.logWrapper(this.compileTerm, 'term');
    }
  }

  compileTerm() {
    if (this.tokenOneOf(IDENTIFIER)) {
      const {token: identifier} = this.eat(IDENTIFIER);
      const logData = {kind: this.st.kindOf(identifier), defined: false, index: this.st.indexOf(identifier), identifier};

      /* cases '.' and '(' comprise the subroutineCall rule.
        The '[' case is array access. The default case is plain varName */
      switch (this.tk.symbol()) {
        case '.':
          this.log({type: 'identifierToken', data: {
            ...logData,
            category: this.st.exists(logData.identifier) ? 'varName' : 'className'}});
          this.eat('.');
          const {token: identifier} = this.eat(IDENTIFIER);
          this.log({type: 'identifierToken', data: {
            category: 'subroutineName',
            defined: false,
            kind: SymbolTableKinds.NONE,
            identifier}});
          this.eat('(');
          this.logWrapper(this.compileExpressionList, 'expressionList');
          this.eat(')');
          break;
        case '(':
          this.log({type: 'identifierToken', data: {...logData, category: 'subroutineName'}});
          this.eat('(');
          this.logWrapper(this.compileExpressionList, 'expressionList');
          this.eat(')');
          break;
        case '[':
          this.log({type: 'identifierToken', data: {...logData, category: 'varName'}});
          this.eat('[');
          this.logWrapper(this.compileExpression, 'expression');
          this.eat(']');
          break;
        default:
          this.log({type: 'identifierToken', data: {...logData, category: 'varName'}});
      }
    } else if (this.tokenOneOf('(')) {
      this.eat('(');
      this.logWrapper(this.compileExpression, 'expression');
      this.eat(')');
    } else if (this.tokenOneOf(['-', '~'])) { // unaryOp term
      this.eat(this.tk.symbol());
      this.logWrapper(this.compileTerm, 'term');
    } else {
      this.eat([INT_CONST, STRING_CONST, ...KEYWORD_CONSTANT]);
    }
  }

  compileExpressionList() {
    if (this.tokenOneOf([INT_CONST, STRING_CONST, ...KEYWORD_CONSTANT, IDENTIFIER, '(', '-', '~'])) {
      this.logWrapper(this.compileExpression, 'expression');

      while (this.tokenOneOf(',')) {
        this.eat(',');
        this.logWrapper(this.compileExpression, 'expression');
      }
    }
  }

  dispose() {
    fs.closeSync(this.outputFile);
    this.outputFile = null;
  }
}
