# JackCompiler

JackCompiler extends [JackAnalyzer](https://github.com/timiscoding/JackAnalyzer) (syntax analyzer) to form the frontend compiler to the [VMtranslator](https://github.com/timiscoding/vmtranslator) backend compiler. The Jack compilation process consists of 2 stages:

1. programs written in the high level Jack language are first compiled down to a virtual machine (VM) language (similar to Java bytecode)
1. the VM compiler translates it down to the Hack assembly language

## API

### JackCompiler
Coordinates compiling a single file or directory. Functionality is almost identical to the [JackAnalyzer module](https://github.com/timiscoding/JackAnalyzer). A second command line arg can be passed which adds a postfix to the filename (useful for testing).

### SymbolTable
Updates the symbol table whenever a class/subroutine variable declaration is found. This allows the compiler to map the variable names to the low level virtual memory segments that the Hack assembly language understands.

|Method|Arguments|Return|function|
|---|---|---|---|
|constructor|||init symbol table|
|startSubroutine|||resets the subroutine level symbol table|
|define|name:string, <br>type:string, <br>kind: SymbolTableKinds {NONE, STATIC, FIELD, VAR, ARG}||Define a new symbol|
|varCount|kind: SymbolTableKinds|int|Returns the number of variables in the symbol table for that kind|
|kindOf|name: string|SymbolTableKinds|Returns the kind for a given variable name|
|typeOf|name: string|string|Returns the type for a given variable name|
|indexOf|name: string|int|Returns the index of the variable. This is used to map to a RAM address|
|exists|name: string|boolean|Returns true if the variable name exists in the table. Else false|

### VMWriter
Writes the VM commands to file

|Method|Arguments|function|
|---|---|---|
|constructor|outputFilename|Creates a file `outputFilename.vm` for writing|
|writePush|segment:Segments <br>{CONST, ARG, LOCAL, STATIC, THIS, THAT, POINTER, TEMP},<br>index:int|Write a push command to the virtual memory segment|
|writePop|segment:Segments <br>{ARG, LOCAL, STATIC, THIS, THAT, POINTER, TEMP},<br>index:int|Write a pop command to the memory segment|
|writeArithmetic|command:Commands<br>{ADD, SUB, NEG, AND, OR, NOT, EQ, GT, LT}|Write an logical or arithmetic command|
|writeLabel|label:string|Write a label command|
|writeGoto|label:string|Write a goto command|
|writeIf|label:string|Write an if-goto command|
|writeCall|name:string, nArgs:int|Write a function call command|
|writeFunction|name:string, nLocals:int|Write a function declaration command|
|writeReturn||Write a function return command|

### CompilationEngine
Compiles VM code. API is identical to the [CompilationEngine module](https://github.com/timiscoding/JackAnalyzer) found in JackAnalyzer. Logging the parse tree XML can be turned off/on with the last arg `constructor(input, output, true)`.

## Install & Usage
```
npm install
node --experimental-modules JackCompiler.mjs <file/dir>
```

## Testing
Each of the folders contains Jack programs used to test the compiler. All except `ExpressionTest` were provided by the nand2tetris course creators. A bash script `regressTest.sh` compiles the Jack programs from the test dirs using this compiler as well as the course supplied [JackCompiler](http://nand2tetris.org/software.php) and tests that they match.
