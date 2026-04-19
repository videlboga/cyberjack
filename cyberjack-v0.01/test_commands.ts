import { parseVerbalInput } from './src/parser/verbalParser';

async function run() {
    const r1 = await parseVerbalInput("На колени!");
    console.log(r1.commandIntent);
    
    const r2 = await parseVerbalInput("Подойди ближе");
    console.log(r2.commandIntent);
}
run();
