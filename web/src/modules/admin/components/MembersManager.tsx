// =====================================================
//  FieldCorrect — Members Manager (with zone assignment)
// =====================================================

import { useState, useRef, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Input } from '@/shared/ui/components';
import { supabase } from '@/infra/supabase';
import { useProjectStore } from '@/stores/projectStore';
import { geometryToEwkt } from '@/shared/utils/geometry';
import type { ProjectMember, MemberRole } from '@/shared/types';
import Map, { Source, Layer, type MapRef, type MapLayerMouseEvent } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapPin, Shield, Trash2, Hexagon, X } from 'lucide-react';

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Propriétaire',
  admin: 'Admin',
  supervisor: 'Superviseur',
  corrector: 'Correcteur',
  editor: 'Éditeur',
  viewer: 'Lecteur',
};

const ROLE_COLORS: Record<MemberRole, string> = {
  owner: 'bg-yellow-100 text-yellow-700',
  admin: 'bg-red-100 text-red-700',
  supervisor: 'bg-purple-100 text-purple-700',
  corrector: 'bg-blue-100 text-blue-700',
  editor: 'bg-green-100 text-green-700',
  viewer: 'bg-gray-100 text-gray-700',
};

const MINI_MAP_STYLE = {
  version: 8 as const,
  name: 'ZoneMap',
  sources: {
    osm: { type: 'raster' as const, tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256 },
  },
  layers: [{ id: 'osm-tiles', type: 'raster' as const, source: 'osm', minzoom: 0, maxzoom: 22 }],
};

type MemberWithProfile = ProjectMember & {
  profile: { email: string; full_name: string; avatar_url: string } | null;
  zone?: GeoJSON.Polygon | string | null;
};

export function MembersManager() {
  const { currentProject } = useProjectStore();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('corrector');
  const [zoneDrawMemberId, setZoneDrawMemberId] = useState<string | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<[number, number][]>([]);
  const mapRef = useRef<MapRef>(null);

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', currentProject?.id],
    queryFn: async () => {
      if (!currentProject) return [];
      const { data, error } = await supabase
        .from('project_members')
        .select('*, profile:user_id(id, email, full_name, avatar_url)')
        .eq('project_id', currentProject.id)
        .order('role');
      if (error) throw error;
      return (data ?? []) as MemberWithProfile[];
    },
    enabled: !!currentProject,
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!currentProject || !email) return;
      const { data: user } = await supabase.from('profiles').select('id').eq('email', email).single();
      if (!user) throw new Error('Utilisateur introuvable');
      const { error } = await supabase.from('project_members').insert({
        project_id: currentProject.id,
        user_id: user.id,
        role,
      });
      if (error) throw error;
    },
    onSuccess: () => { setEmail(''); queryClient.invalidateQueries({ queryKey: ['members'] }); },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ memberId, newRole }: { memberId: string; newRole: MemberRole }) => {
      const { error } = await supabase.from('project_members').update({ role: newRole }).eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
  });

  const removeMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase.from('project_members').delete().eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
  });

  const assignZoneMutation = useMutation({
    mutationFn: async ({ memberId, zone }: { memberId: string; zone: GeoJSON.Polygon | null }) => {
      const { error } = await supabase
        .from('project_members')
        .update({ zone: zone ? geometryToEwkt(zone) : null })
        .eq('id', memberId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] }),
  });

  // --------------- Zone drawing ---------------
  const handleMapClick = useCallback((e: MapLayerMouseEvent) => {
    if (!zoneDrawMemberId) return;
    setDrawingPoints((pts) => [...pts, [e.lngLat.lng, e.lngLat.lat]]);
  }, [zoneDrawMemberId]);

  const confirmZone = useCallback(() => {
    if (!zoneDrawMemberId || drawingPoints.length < 3) return;
    const ring = [...drawingPoints, drawingPoints[0]];
    const polygon: GeoJSON.Polygon = { type: 'Polygon', coordinates: [ring] };
    assignZoneMutation.mutate({ memberId: zoneDrawMemberId, zone: polygon });
    setZoneDrawMemberId(null);
    setDrawingPoints([]);
  }, [zoneDrawMemberId, drawingPoints, assignZoneMutation]);

  const cancelZone = useCallback(() => {
    setZoneDrawMemberId(null);
    setDrawingPoints([]);
  }, []);

  const removeZone = useCallback((memberId: string) => {
    assignZoneMutation.mutate({ memberId, zone: null });
  }, [assignZoneMutation]);

  // GeoJSON for the drawing preview
  const drawingGeoJson = useMemo((): GeoJSON.FeatureCollection => {
    const features: GeoJSON.Feature[] = [];
    if (drawingPoints.length > 0) {
      features.push(...drawingPoints.map((pt) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: pt },
        properties: {},
      })));
    }
    if (drawingPoints.length >= 2) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: drawingPoints },
        properties: {},
      });
    }
    if (drawingPoints.length >= 3) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[...drawingPoints, drawingPoints[0]]] },
        properties: {},
      });
    }
    return { type: 'FeatureCollection', features };
  }, [drawingPoints]);

  // Existing zones as GeoJSON
  const zonesGeoJson = useMemo((): GeoJSON.FeatureCollection => {
    const features: GeoJSON.Feature[] = [];
    for (const m of members) {
      if (m.zone && typeof m.zone === 'object') {
        features.push({
          type: 'Feature',
          geometry: m.zone as GeoJSON.Polygon,
          properties: { name: m.profile?.full_name ?? 'Member', role: m.role },
        });
      }
    }
    return { type: 'FeatureCollection', features };
  }, [members]);

  const isDrawing = !!zoneDrawMemberId;
  const drawingMember = members.find((m) => m.id === zoneDrawMemberId);

  return (
    <div className="space-y-6 p-6 max-h-[80vh] overflow-y-auto">
      <h2 className="text-lg font-semibold flex items-center gap-2">
        <Shield size={18} /> Membres du projet
      </h2>

      {/* Invite form */}
      <div className="flex gap-2">
        <Input placeholder="Email de l'utilisateur" value={email} onChange={(e) => setEmail(e.target.value)} className="flex-1" />
        <select className="rounded-md border border-gray-300 px-2 text-sm" value={role} onChange={(e) => setRole(e.target.value as MemberRole)}>
          {(Object.entries(ROLE_LABELS) as [MemberRole, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <Button onClick={() => inviteMutation.mutate()} disabled={!email || inviteMutation.isPending}>
          Inviter
        </Button>
      </div>

      {inviteMutation.isError && (
        <p className="text-sm text-red-600">{inviteMutation.error instanceof Error ? inviteMutation.error.message : 'Erreur'}</p>
      )}

      {/* Members list */}
      <div className="space-y-2">
        {isLoading && <p className="text-sm text-gray-500">Chargement…</p>}
        {members.map((m) => (
          <div key={m.id} className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-medium text-gray-600">
                  {(m.profile?.full_name ?? m.profile?.email)?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="text-sm font-medium">{m.profile?.full_name ?? 'Sans nom'}</p>
                  <p className="text-xs text-gray-400">{m.profile?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[m.role]}`}
                  value={m.role}
                  onChange={(e) => updateRoleMutation.mutate({ memberId: m.id, newRole: e.target.value as MemberRole })}
                >
                  {(Object.entries(ROLE_LABELS) as [MemberRole, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <button className="text-gray-400 hover:text-red-500 text-sm" onClick={() => { if (confirm('Retirer ce membre ?')) removeMutation.mutate(m.id); }}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            {/* Zone assignment row */}
            <div className="flex items-center gap-2 text-xs">
              <Hexagon size={12} className="text-gray-400" />
              {m.zone ? (
                <>
                  <span className="text-green-600 font-medium">Zone assignée</span>
                  <Button variant="ghost" size="sm" className="h-5 text-xs px-1" onClick={() => setZoneDrawMemberId(m.id)}>
                    Redessiner
                  </Button>
                  <Button variant="ghost" size="sm" className="h-5 text-xs px-1 text-red-500" onClick={() => removeZone(m.id)}>
                    Supprimer zone
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-gray-400">Aucune zone</span>
                  <Button variant="ghost" size="sm" className="h-5 text-xs px-1" onClick={() => setZoneDrawMemberId(m.id)}>
                    <MapPin size={10} className="mr-0.5" /> Dessiner zone
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Zone drawing map */}
      {isDrawing && (
        <div className="rounded-lg border overflow-hidden">
          <div className="flex items-center justify-between bg-blue-50 px-3 py-2">
            <span className="text-sm font-medium text-blue-800">
              Dessiner la zone de {drawingMember?.profile?.full_name ?? 'ce membre'}
            </span>
            <button onClick={cancelZone}><X size={16} className="text-gray-500" /></button>
          </div>
          <p className="text-xs text-gray-500 px-3 py-1">Cliquez sur la carte pour tracer un polygone. Min 3 points.</p>
          <div className="h-64 relative">
            <Map
              ref={mapRef}
              initialViewState={{ latitude: 12.56, longitude: -12.18, zoom: 10 }}
              mapStyle={MINI_MAP_STYLE}
              onClick={handleMapClick}
              cursor="crosshair"
              style={{ width: '100%', height: '100%' }}
            >
              {/* Existing zones */}
              <Source id="existing-zones" type="geojson" data={zonesGeoJson}>
                <Layer id="existing-zones-fill" type="fill" paint={{ 'fill-color': '#10b981', 'fill-opacity': 0.15 }} />
                <Layer id="existing-zones-stroke" type="line" paint={{ 'line-color': '#10b981', 'line-width': 2 }} />
              </Source>
              {/* Drawing preview */}
              <Source id="drawing" type="geojson" data={drawingGeoJson}>
                <Layer id="draw-fill" type="fill" paint={{ 'fill-color': '#3b82f6', 'fill-opacity': 0.2 }} filter={['==', '$type', 'Polygon']} />
                <Layer id="draw-line" type="line" paint={{ 'line-color': '#3b82f6', 'line-width': 2, 'line-dasharray': [4, 2] }} filter={['==', '$type', 'LineString']} />
                <Layer id="draw-pts" type="circle" paint={{ 'circle-radius': 5, 'circle-color': '#3b82f6', 'circle-stroke-color': '#fff', 'circle-stroke-width': 2 }} filter={['==', '$type', 'Point']} />
              </Source>
            </Map>
          </div>
          <div className="flex items-center justify-between bg-gray-50 px-3 py-2">
            <span className="text-xs text-gray-500">{drawingPoints.length} point(s)</span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDrawingPoints([])}>Effacer</Button>
              <Button variant="ghost" size="sm" onClick={cancelZone}>Annuler</Button>
              <Button size="sm" disabled={drawingPoints.length < 3 || assignZoneMutation.isPending} onClick={confirmZone}>
                Valider zone
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
