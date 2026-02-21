import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getDB } from '../db/db';
import { ArrowLeft, Save } from 'lucide-react';
import type { CorrectionDB } from '../db/db';

type LocalParcel = CorrectionDB['parcels']['value'];

export default function CorrectionForm() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [parcel, setParcel] = useState<LocalParcel | null>(null);
    const [loading, setLoading] = useState(true);

    // Form State
    const [numParcel, setNumParcel] = useState('');
    const [owner, setOwner] = useState('');

    const [notes, setNotes] = useState('');

    useEffect(() => {
        const loadParcel = async () => {
            if (!id) return;
            try {
                const db = await getDB();
                const p = await db.get('parcels', parseInt(id, 10));
                if (p) {
                    setParcel(p);
                    setNumParcel(p.numParcel);
                    setOwner(String(p.properties?.raw_owner ?? ''));
                    // Load existing correction if any
                    // const correction = await db.getFromIndex('corrections', 'by-parcel', p.id);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadParcel();
    }, [id]);

    const handleSave = async () => {
        if (!parcel) return;

        try {
            const db = await getDB();

            // 1. Create/Update Correction
            const correction = {
                uuid: crypto.randomUUID(),
                parcelId: parcel.id!,
                numParcel,
                enqueteur: 'Admin', // TODO: Get from auth
                status: 'draft' as const,
                notes,
                gpsLatitude: 0, // TODO: Get current location
                gpsLongitude: 0,
                gpsAccuracy: 0,
                dirty: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            await db.put('corrections', correction);

            // 2. Update Parcel Status
            parcel.status = 'corrected';
            parcel.numParcel = numParcel;
            parcel.properties.raw_owner = owner;
            await db.put('parcels', parcel);

            navigate(-1);
        } catch (e) {
            console.error('Failed to save', e);
            alert('Failed to save correction');
        }
    };

    if (loading) return <div className="p-4">Loading...</div>;
    if (!parcel) return <div className="p-4">Parcel not found</div>;

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 shadow-sm">
                <button onClick={() => navigate(-1)} className="mr-4 p-2 hover:bg-gray-100 rounded-full">
                    <ArrowLeft size={20} />
                </button>
                <h1 className="font-bold text-lg text-gray-800">Edit Parcel</h1>
            </header>

            <main className="flex-1 p-4 overflow-y-auto">
                <div className="max-w-md mx-auto bg-white rounded-lg shadow p-6 space-y-6">

                    {/* Read-only info */}
                    <div className="bg-blue-50 p-4 rounded-md border border-blue-100">
                        <p className="text-sm text-blue-800">Original Type: <span className="font-medium">{parcel.type}</span></p>
                        <p className="text-sm text-blue-800">Commune: <span className="font-medium">{parcel.communeId}</span></p>
                    </div>

                    {/* Form Fields */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Parcel Number</label>
                        <input
                            type="text"
                            value={numParcel}
                            onChange={(e) => setNumParcel(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name</label>
                        <input
                            type="text"
                            value={owner}
                            onChange={(e) => setOwner(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    <button
                        onClick={handleSave}
                        className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-md font-medium hover:bg-blue-700 transition-colors"
                    >
                        <Save size={18} />
                        Save Correction
                    </button>

                </div>
            </main>
        </div>
    );
}
