// Newline framing must survive arbitrary network chunk and UTF-8 boundaries.
export async function readCommandResponse(response,onStep=()=>{}){
 if(!response.headers.get('content-type')?.includes('application/x-ndjson')){const value=await response.json();if(!response.ok)throw Error(value.error||String(response.status));return value;}
 if(!response.ok)throw Error('Планировщик: HTTP '+response.status);
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',plan,next=0;
 const consume=line=>{if(!line.trim())return;const event=JSON.parse(line);if(event.type==='error')throw Error(event.error);if(event.type==='step'){if(event.index!==next||event.step?.status!=='ready')throw Error('Неверный порядок проверенных этапов');next++;onStep(event);}else if(event.type==='plan'){if(plan)throw Error('Повторный итоговый план');plan=event.plan;}else throw Error('Неизвестное сообщение планировщика');};
 try{for(;;){const {value,done}=await reader.read();buffer+=done?decoder.decode():decoder.decode(value,{stream:true});let end;while((end=buffer.indexOf('\n'))>=0){consume(buffer.slice(0,end));buffer=buffer.slice(end+1);}if(done)break;}if(buffer.trim())consume(buffer);if(!plan)throw Error('Планировщик прервал передачу до завершения плана');return plan;}finally{reader.releaseLock();}
}
