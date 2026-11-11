// Experimental replacement for the wall-clock pose/worker clocks.
// One issued ticket owns one pose sample and one complete worker cohort.
// Wall time controls presentation cadence only; it never changes solver dt.
export function createRibbonFixedTimeline({hz=60}={}){
 if(!Number.isInteger(hz)||hz<1)throw new RangeError('hz must be a positive integer');
 let epoch=0,tick=0,pending=null;
 const dt=1/hz;
 return {
  get time(){return tick/hz;},get epoch(){return epoch;},get pending(){return pending;},
  reset(){epoch++;tick=0;pending=null;},
  issue(){
   if(pending)return null;
   pending=Object.freeze({epoch,tick:tick+1,time:(tick+1)/hz,dt});
   return pending;
  },
  commit(ticket){
   if(!pending||ticket!==pending||ticket.epoch!==epoch)return false;
   tick=ticket.tick;pending=null;return true;
  }
 };
}
