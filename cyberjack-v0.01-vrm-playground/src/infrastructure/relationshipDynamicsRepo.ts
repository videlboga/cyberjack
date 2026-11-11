import { db } from './db';

export type RelationshipDynamics = {
    subjectId:string; actorId:string; resistance:number; learnedCompliance:number;
    dependency:number; dissociation:number; fear:number;
};

const clamp = (value:number) => Math.max(0, Math.min(100, value));
const map = (row:any):RelationshipDynamics => ({
    subjectId:row.subject_id, actorId:row.actor_id,
    resistance:Number(row.resistance || 0), learnedCompliance:Number(row.learned_compliance || 0),
    dependency:Number(row.dependency || 0), dissociation:Number(row.dissociation || 0), fear:Number(row.fear || 0),
});

export const relationshipDynamicsRepo = {
    get(subjectId:string, actorId:string):RelationshipDynamics {
        db.prepare(`INSERT OR IGNORE INTO relationship_dynamics(subject_id,actor_id) VALUES (?,?)`).run(subjectId,actorId);
        return map(db.prepare(`SELECT * FROM relationship_dynamics WHERE subject_id=? AND actor_id=?`).get(subjectId,actorId));
    },
    change(subjectId:string, actorId:string, delta:Partial<Omit<RelationshipDynamics,'subjectId'|'actorId'>>) {
        const current = this.get(subjectId,actorId);
        const next = {
            resistance:clamp(current.resistance + Number(delta.resistance || 0)),
            learnedCompliance:clamp(current.learnedCompliance + Number(delta.learnedCompliance || 0)),
            dependency:clamp(current.dependency + Number(delta.dependency || 0)),
            dissociation:clamp(current.dissociation + Number(delta.dissociation || 0)),
            fear:clamp(current.fear + Number(delta.fear || 0)),
        };
        db.prepare(`UPDATE relationship_dynamics SET resistance=?,learned_compliance=?,dependency=?,dissociation=?,fear=?,updated_at=CURRENT_TIMESTAMP WHERE subject_id=? AND actor_id=?`)
            .run(next.resistance,next.learnedCompliance,next.dependency,next.dissociation,next.fear,subjectId,actorId);
        return { subjectId,actorId,...next };
    },
    recoverAlone(subjectId:string, minutes=1) {
        const rows = db.prepare(`SELECT actor_id FROM relationship_dynamics WHERE subject_id=?`).all(subjectId) as any[];
        for (const row of rows) this.change(subjectId,row.actor_id,{
            fear:-.08*minutes, dissociation:-.04*minutes, resistance:.03*minutes, dependency:-.015*minutes,
        });
    },
};
