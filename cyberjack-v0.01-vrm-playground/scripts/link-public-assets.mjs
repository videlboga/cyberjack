import {readdir,symlink,lstat} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd();
for(const entry of await readdir(path.join(root,'public'),{withFileTypes:true})){
 const target=path.join(root,'dist',entry.name);
 try{await lstat(target);continue}catch(e){if(e.code!=='ENOENT')throw e}
 await symlink(path.join('..','public',entry.name),target,entry.isDirectory()?'dir':'file');
}
console.log('Public assets linked to dist without duplicating the library.');
