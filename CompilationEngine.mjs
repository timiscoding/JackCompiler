import fs from 'fs';
import {default as JackTokenizer, TokenTypes, TokenKeywords} from './JackTokenizer';

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

export default class CompilationEngine {
  constructor(inputFile, outputFile) {
    this.inputFile = inputFile;
    this.outputFile = fs.openSync(outputFile, 'w+');
    this.tk = new JackTokenizer(inputFile);
    this.indentLevel = 0;

    if (this.tk.hasMoreTokens()) {
      this.tk.advance(); // set the first token
    }

    this.compileClass();
  }

  getToken(tokenType) {
    return tokenMethod.get(tokenType).call(this.tk);
  }

  log(str) {
    fs.appendFileSync(this.outputFile, '  '.repeat(this.indentLevel) + str + '\n');
  }

  logWrapper(compileCb, tag) {
    this.indentLevel++;
    this.log(`<${tag}>`);
    compileCb.call(this);
    this.log(`</${tag}>`);
    this.indentLevel--;
  }

  tokenOneOf(accepted) {
    const thisTokenType = this.tk.tokenType();
    const thisToken = this.getToken(thisTokenType);

    return (Array.isArray(accepted) &&
      (accepted.includes(thisToken) || accepted.includes(thisTokenType)))
      || accepted === thisToken || accepted === thisTokenType;
  }

  eat(accepted) {
    this.indentLevel++;
    const thisTokenType = this.tk.tokenType();
    let thisToken = this.getToken(thisTokenType);

    if (this.tokenOneOf(accepted)) {
      if (this.tokenOneOf([STRING_CONST, SYMBOL])) {
        thisToken = toEntity(thisToken);
      }
      this.log(`<${thisTokenType.display}> ${thisToken.display || thisToken} </${thisTokenType.display}>`)

      if (this.tk.hasMoreTokens()) {
        this.tk.advance();
      }
    } else {
      throw new Error(`Failed to see "${accepted.display || accepted}" token`);
    }

    this.indentLevel--;
  }

  compileClass() {
    this.log('<class>');
    this.eat(CLASS);
    this.eat(IDENTIFIER);
    this.eat('{');

    while (this.tokenOneOf([STATIC, FIELD])) {
      this.logWrapper(this.compileClassVarDec, 'classVarDec');
    }

    while (this.tokenOneOf([CONSTRUCTOR, FUNCTION, METHOD])) {
      this.logWrapper(this.compileSubroutineDec, 'subroutineDec');
    }

    this.eat('}');
    this.log('</class>');
  }

  compileClassVarDec() {
    this.eat([STATIC, FIELD]);
    this.eat(TYPE_RULE);
    this.eat(IDENTIFIER);

    while (this.tokenOneOf(',')) {
      this.eat(',');
      this.eat(IDENTIFIER);
    }

    this.eat(';');
  }

  compileSubroutineDec() {
    this.eat([CONSTRUCTOR, FUNCTION, METHOD]);
    this.eat([VOID, ...TYPE_RULE]);
    this.eat(IDENTIFIER);
    this.eat('(');
    this.logWrapper(this.compileParameterList, 'parameterList');
    this.eat(')');
    this.logWrapper(this.compileSubroutineBody, 'subroutineBody');
  }

  compileParameterList() {
    if (this.tokenOneOf(TYPE_RULE)) {
      this.eat(TYPE_RULE);
      this.eat(IDENTIFIER);

      while (this.tokenOneOf(',')) {
        this.eat(',');
        this.eat(TYPE_RULE);
        this.eat(IDENTIFIER);
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
    this.eat(TYPE_RULE);
    this.eat(IDENTIFIER);

    while (this.tokenOneOf(',')) {
      this.eat(',');
      this.eat(IDENTIFIER);
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
    this.eat(IDENTIFIER);

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
    this.eat(IDENTIFIER);
    switch (this.tk.symbol()) {
      case '.':
        this.eat('.');
        this.eat(IDENTIFIER);
      case '(':
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
      this.eat(IDENTIFIER);

      // cases '.' and '(' comprise the subroutineCall rule. The '[' case is array access
      switch (this.tk.symbol()) {
        case '.':
          this.eat('.');
          this.eat(IDENTIFIER);
        case '(':
          this.eat('(');
          this.logWrapper(this.compileExpressionList, 'expressionList');
          this.eat(')');
          break;
        case '[':
          this.eat('[');
          this.logWrapper(this.compileExpression, 'expression');
          this.eat(']');
          break;
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
