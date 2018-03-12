import fs from 'fs';
import path from 'path';
import CompilationEngine from './CompilationEngine';

const inputArg = process.argv[2];
const outputFilenamePostfix = process.argv[3];

if (!fs.existsSync(inputArg)) {
  throw Error('No such file/dir', inputArg);
}

const stats = fs.statSync(inputArg);
let files = [];
if (stats.isDirectory()) {
  files = fs.readdirSync(inputArg).filter(f => f.endsWith('.jack')).map(f => `${inputArg}/${f}`);
} else if (stats.isFile()) {
  files.push(inputArg);
}

files.forEach(f => {
  const inputParsed = path.parse(f);
  const dir = path.resolve(inputParsed.dir);
  const input = path.format({
    dir,
    base: inputParsed.base,
  });
  const output = path.format({
    dir,
    name: inputParsed.name + outputFilenamePostfix,
  });
  console.log(`Compiling ${path.relative(process.cwd(), f)} -> ${path.relative(process.cwd(), output)}.vm`);
  const ce = new CompilationEngine(input, output);
  ce.dispose();
})
