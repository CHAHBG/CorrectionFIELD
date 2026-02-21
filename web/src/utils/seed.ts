import { getDB } from '../db/db';

export async function seedDatabase() {
    const db = await getDB();

    // Check if data exists
    const count = await db.count('parcels');
    if (count > 0) {
        console.log('Database already seeded');
        return;
    }

    const communeId = 'CMC01';

    // Dummy Commune
    await db.put('communes', {
        code: communeId,
        name: 'DEMO COMMUNE',
        bbox: [-13.02, 14.02, -13.00, 14.04],
        geometry: null // TODO: Add dummy geometry
    });

    // Dummy Parcels
    const parcels = [];
    for (let i = 0; i < 50; i++) {
        const lng = -13.01 + (Math.random() - 0.5) * 0.01;
        const lat = 14.03 + (Math.random() - 0.5) * 0.01;

        parcels.push({
            communeId,
            numParcel: `P${i.toString().padStart(4, '0')}`,
            type: (Math.random() > 0.5 ? 'sans_enquete' : 'sans_numero') as 'sans_enquete' | 'sans_numero',
            status: 'pending' as 'pending' | 'corrected' | 'validated' | 'synced',
            bbox: [lng, lat, lng, lat] as [number, number, number, number], // Point bbox for now
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [lng, lat],
                    [lng + 0.0001, lat],
                    [lng + 0.0001, lat + 0.0001],
                    [lng, lat + 0.0001],
                    [lng, lat]
                ]]
            },
            properties: {
                raw_owner: `Owner ${i}`
            },
            updatedAt: new Date().toISOString(),
            isDeleted: false
        });
    }

    const tx = db.transaction('parcels', 'readwrite');
    await Promise.all(parcels.map(p => tx.store.add(p)));
    await tx.done;
    console.log('Database seeded with 50 parcels');
}
