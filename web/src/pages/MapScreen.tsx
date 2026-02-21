
import Map from '../components/Map';
import { useParcels } from '../hooks/useParcels';
import { seedDatabase } from '../utils/seed';

interface ClickedFeature {
    properties?: {
        numParcel?: string;
        [key: string]: unknown;
    };
}

export default function MapScreen() {
    const { parcels, refresh } = useParcels('CMC01'); // Using dummy commune ID

    const handleSeed = async () => {
        await seedDatabase();
        refresh();
    };

    const handleParcelClick = (feature: ClickedFeature) => {
        console.log('Clicked parcel:', feature);
        alert(`Clicked parcel: ${feature.properties?.numParcel ?? 'N/A'}`);
    };

    return (
        <div className="h-screen w-screen flex flex-col">
            <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 shadow-sm z-20">
                <h1 className="font-bold text-lg text-gray-800">CorrectionFIELD</h1>
                <div className="ml-auto flex gap-2">
                    <button
                        onClick={handleSeed}
                        className="px-3 py-1 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 cursor-pointer"
                    >
                        Load Demo Data
                    </button>
                    <button className="px-3 py-1 bg-blue-600 text-white rounded text-sm font-medium">Sync</button>
                    <button className="px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm font-medium">Menu</button>
                </div>
            </header>
            <main className="flex-1 relative">
                <Map
                    parcels={parcels}
                    onParcelClick={handleParcelClick}
                />
            </main>
        </div>
    );
}
