const fs = require('fs');
const path = require('path');
const yargs = require('yargs');
const {CompilationEngine} = require('./CompilationEngine');

const argv = yargs
  .usage('Usage: $0 <src file|src dir> [args]')
  .demandCommand(1, 'Source file/dir not found')
  .check((argv, opt) => {
    return fs.existsSync(argv._[0]);
  })
  .boolean('enable-parse-tree')
  .options({
    'suffix': {
      alias: 's',
      describe: 'Appends text to the output filename',
      default: '',
    },
    'enable-parse-tree': {
      alias: 'p',
      describe: 'Writes the source parse tree to XML',
    },
  })
  .fail((msg, err, yargs) => {
    if (err) throw err;
    console.error("Source file/dir not found");
    console.error(yargs.help());
    process.exit(1);
  })
  .version(false)
  .argv;

const inputArg = argv._[0];
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
    name: inputParsed.name + argv["suffix"],
  });
  console.log(`Compiling ${path.relative(process.cwd(), f)} -> ${path.relative(process.cwd(), output)}.vm`);
  const ce = new CompilationEngine(input, output, argv['enable-parse-tree']);
  ce.dispose();
})
