import { Request, Response } from 'express';
import { listInbox, resolveOpportunity } from '../../scenario/eventDirector';

export const getEventInbox = (_req:Request, res:Response) => {
    try {
        res.json({ success:true, events:listInbox() });
    } catch (error:any) {
        res.status(500).json({ success:false, error:error.message });
    }
};

export const chooseEventOpportunity = (req:Request, res:Response) => {
    try {
        const choice = String(req.body.choice || '');
        res.json({ success:true, result:resolveOpportunity(String(req.params.id), choice) });
    } catch (error:any) {
        res.status(400).json({ success:false, error:error.message });
    }
};
