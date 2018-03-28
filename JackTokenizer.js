const readlines = require('n-readlines');
const {Enum} = require('./Enum');

const TokenTypes = new Enum({
  KEYWORD: { value: 0, description: "keyword" },
  SYMBOL: { value: 1, description: "symbol" },
  IDENTIFIER: { value: 2, description: "identifier" },
  INT_CONST: { value: 3, description: "integerConstant" },
  STRING_CONST: { value: 4, description: "stringConstant" },
});

const TokenKeywords = new Enum({
  CLASS: { value: 0, description: 'class' },
  METHOD: { value: 1, description: 'method' },
  FUNCTION: { value: 2, description: 'function' },
  CONSTRUCTOR: { value: 3, description: 'constructor' },
  INT: { value: 4, description: 'int' },
  BOOLEAN: { value: 5, description: 'boolean' },
  CHAR: { value: 6, description: 'char' },
  VOID: { value: 7, description: 'void' },
  VAR: { value: 8, description: 'var' },
  STATIC: { value: 9, description: 'static' },
  FIELD: { value: 10, description: 'field' },
  LET: { value: 11, description: 'let' },
  DO: { value: 12, description: 'do' },
  IF: { value: 13, description: 'if' },
  ELSE: { value: 14, description: 'else' },
  WHILE: { value: 15, description: 'while' },
  RETURN: { value: 16, description: 'return' },
  TRUE: { value: 17, description: 'true' },
  FALSE: { value: 18, description: 'false' },
  NULL: { value: 19, description: 'null' },
  THIS: { value: 20, description: 'this' },
});

class JackTokenizer {
  constructor(filename) {
    this.readLine = new readlines(filename);
    this.prevLine = '';
    this.line = '';
    this.lineIndex = 0;
    this.nextToken = {};
    this.token = {};
  }

  getLine() {
    let noComments = '';
    let whiteSpaceComment = /\/\/.*/;
    const blockComment = /\/\*(?:\*(?!\/)|(?<!\*)\/|[^\*\/])*(\*\/)?$/; // match * if no / after it, match / if no * before it

    if (this.line = this.readLine.next()) {
      this.line = this.prevLine + this.line.toString().trim();
      noComments = this.line.replace(whiteSpaceComment, '').trim();
      const blockMatch = this.line.match(blockComment);

      if (Array.isArray(blockMatch)) {
        noComments = this.line.replace(blockComment, '').trim();
        if (blockMatch[1] === undefined) {
          this.prevLine = blockMatch[0];
        } else if (blockMatch[1] === '*/') {
          this.prevLine = '';
        }
      }

      if (noComments.length === 0) {
        return this.getLine();
        this.prevLine = '';
      } else {
        return noComments;
      }
    }
    return false;
  }

  hasMoreTokens() {
    if (this.lineIndex === 0 || this.lineIndex >= this.line.length) {
      if ((this.line = this.getLine()) === false) {
        return false;
      }
      this.lineIndex = 0;
    }
    const keywordRe = "\\b(class|constructor|function|method|field|static|var|int|char|boolean|void|true|false|null|this|let|do|if|else|while|return)\\b";
    const identifierRe = "\\b([a-z][a-z_0-9]*)\\b";
    const symbolRe = "([\\-\\[\\]{}().,;+*/&|<>=~])";
    const intConstRe = "(\\d+)";
    const stringConstRe = '"(.+)"';
    const tokens = new RegExp([keywordRe, identifierRe, symbolRe, intConstRe, stringConstRe].join('|'), "gi");
    let matches;

    tokens.lastIndex = this.lineIndex;
    if ((matches = tokens.exec(this.line)) !== null) {
      const { KEYWORD, IDENTIFIER, SYMBOL, INT_CONST, STRING_CONST } = TokenTypes;
      const captureGroup = [KEYWORD, IDENTIFIER, SYMBOL, INT_CONST, STRING_CONST];
      matches.slice(1).forEach((match, i) => {
        if (match) {
          this.nextToken.type = captureGroup[i];
          this.nextToken.value = match;
        }
      })
      this.lineIndex = tokens.lastIndex;
      return true;
    }
  }

  advance() {
    this.token = this.nextToken;
  }

  tokenType() {
    return this.token.type;
  }

  keyword() {
    return TokenKeywords[this.token.value.toUpperCase()];
  }

  symbol() {
    return this.token.value;
  }

  identifier() {
    return this.token.value;
  }

  intVal() {
    return parseInt(this.token.value, 10);
  }

  stringVal() {
    return this.nextToken.value;
  }
}

module.exports = {
  TokenTypes,
  TokenKeywords,
  JackTokenizer,
};
