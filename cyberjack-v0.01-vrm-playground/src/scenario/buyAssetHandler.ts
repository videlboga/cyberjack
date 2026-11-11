import { resourceRepo, subjectRepo, characterRepo } from '../infrastructure/repositories';
import { db } from '../infrastructure/db';

export function handleBuyAssetAction(playerId: string, brokerId: string, sceneId: string, assetId: string): string {
    return db.transaction(() => {
        const brokerRes = resourceRepo.get(brokerId);
        if (!brokerRes || !brokerRes.resources['store_catalog']?.metadata?.assets) {
            throw new Error('Broker has no catalog');
        }

        const assets = brokerRes.resources['store_catalog'].metadata.assets as any[];
        const targetAsset = assets.find(a => a.id === assetId);
        
        if (!targetAsset) {
            throw new Error('Asset not found in catalog');
        }

        const playerRes = resourceRepo.get(playerId);
        const credits = playerRes?.resources['credits']?.amount || 0;
        
        // In future: read broker attitude to reduce price
        const brokerSubj = subjectRepo.get(brokerId);
        let price = targetAsset.basePrice;
        if (brokerSubj) {
            const discountFactor = 1 - ((brokerSubj.attitude / 100) * (brokerSubj.plasticity / 100)); // up to 100% discount, realistically 20-30%
            price = Math.max(0, Math.floor(price * discountFactor));
        }

        if (credits < price) {
            throw new Error(`Insufficient funds. Need ${price}, have ${credits}`);
        }

        // Process payment
        if (playerRes) {
            playerRes.resources['credits'].amount -= price;
            resourceRepo.save(playerRes);
        }

        // Remove from broker
        const newAssets = assets.filter(a => a.id !== assetId);
        brokerRes.resources['store_catalog'].metadata.assets = newAssets;
        resourceRepo.save(brokerRes);

        // Create the raw asset subject
        characterRepo.ensureSubject(assetId, targetAsset.name);
        subjectRepo.save(assetId, targetAsset.name, {
            tension: 0, sensitivity: 50, capacity: 50, openness: 50, plasticity: 50, attitude: 30
        });
        
        // Give it raw flag
        const newRaw = subjectRepo.get(assetId);
        if (newRaw) {
            if (!newRaw.flags) newRaw.flags = [];
            newRaw.flags.push('status:raw');
            subjectRepo.save(assetId, targetAsset.name, newRaw);
        }

        // Attach to current scene
        db.prepare('INSERT OR IGNORE INTO scene_characters (scene_id, character_id, role, presence_state) VALUES (?, ?, ?, ?)').run(
            sceneId, assetId, 'participant', 'present'
        );

        return `[SYSTEM: Покупка актива ${targetAsset.name} (${assetId}) успешна. Списано ${price}cr. Товар доставлен.]`;
    })();
}
