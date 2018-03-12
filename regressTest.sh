files=(
  ExpressionTest/ExpressionTest
)

for file in ${files[@]}; do
  jackSrc="${file}.jack"
  node --experimental-modules --no-warnings JackCompiler.mjs $jackSrc _test
  JackCompiler.sh $jackSrc
  myvm="${file}_test.vm"
  verified="${file}.vm"
  TextComparer.sh $myvm $verified

  if [ $? != 0 ]; then
    echo "${file}.vm COMPARISON FAILED"
    break
  fi
done
