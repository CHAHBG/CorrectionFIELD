"""
CorrectionFIELD — Export Service
FastAPI micro-service that exports project/layer data in multiple
geospatial formats (GeoJSON, GPKG, CSV, Shapefile, KML).

Reads directly from PostgreSQL/PostGIS using psycopg2.
Meant to sit behind Kong or Caddy for auth verification.
"""

import io
import csv
import json
import os
import tempfile
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from enum import Enum
from typing import Optional

import fiona
import orjson
import psycopg2
import psycopg2.extras
from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from shapely import wkb
from shapely.geometry import Point, mapping as geom_mapping


# ── Config ──────────────────────────────────────────

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@db:5432/postgres",
)

ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "*").split(",")


# ── App lifecycle ───────────────────────────────────

def get_conn():
    return psycopg2.connect(DATABASE_URL)


@asynccontextmanager
async def lifespan(application: FastAPI):
    # Startup: verify DB connection
    conn = get_conn()
    conn.close()
    yield


app = FastAPI(
    title="CorrectionFIELD Export Service",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["*"],
)


# ── Enums & models ──────────────────────────────────


class ExportFormat(str, Enum):
    geojson = "geojson"
    gpkg = "gpkg"
    csv = "csv"
    shp = "shp"
    kml = "kml"


class StatusFilter(str, Enum):
    all = "all"
    pending = "pending"
    corrected = "corrected"
    validated = "validated"
    rejected = "rejected"
    locked = "locked"


class ExportMeta(BaseModel):
    project_slug: str
    layer_id: str
    format: ExportFormat
    status: StatusFilter
    feature_count: int
    exported_at: str


# ── Helpers ─────────────────────────────────────────


def _fetch_layer_features(
    layer_id: str,
    project_slug: str,
    status: StatusFilter,
    use_corrected: bool = True,
):
    """
    Fetch features for a given layer within a project.
    If use_corrected, merges the latest correction patch into props
    and uses corrected geometry when available.
    """
    conn = get_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Verify layer belongs to project
        cur.execute(
            """
            SELECT l.id, l.name, l.geometry_type, l.fields
            FROM public.layers l
            JOIN public.projects p ON p.id = l.project_id
            WHERE l.id = %s AND p.slug = %s
            """,
            (layer_id, project_slug),
        )
        layer = cur.fetchone()
        if not layer:
            raise HTTPException(
                status_code=404,
                detail=f"Layer {layer_id} not found in project '{project_slug}'",
            )

        # Build query — optionally join latest correction
        if use_corrected:
            query = """
                SELECT
                    f.id,
                    f.status,
                    f.props || COALESCE(c.props_patch, '{}'::jsonb) AS props,
                    ST_AsBinary(COALESCE(c.geom_corrected, f.geom)) AS geom_wkb,
                    f.source_file,
                    f.corrected_by,
                    f.corrected_at,
                    f.validated_by,
                    f.validated_at,
                    f.created_at,
                    f.updated_at
                FROM public.features f
                LEFT JOIN LATERAL (
                    SELECT props_patch, geom_corrected
                    FROM public.corrections
                    WHERE feature_id = f.id
                    ORDER BY created_at DESC
                    LIMIT 1
                ) c ON TRUE
                WHERE f.layer_id = %s
            """
        else:
            query = """
                SELECT
                    f.id,
                    f.status,
                    f.props,
                    ST_AsBinary(f.geom) AS geom_wkb,
                    f.source_file,
                    f.corrected_by,
                    f.corrected_at,
                    f.validated_by,
                    f.validated_at,
                    f.created_at,
                    f.updated_at
                FROM public.features f
                WHERE f.layer_id = %s
            """

        params: list = [layer_id]

        if status != StatusFilter.all:
            query += " AND f.status = %s"
            params.append(status.value)

        query += " ORDER BY f.created_at"

        cur.execute(query, params)
        rows = cur.fetchall()

        return layer, rows
    finally:
        conn.close()


def _rows_to_geojson(layer: dict, rows: list) -> dict:
    """Convert DB rows to a GeoJSON FeatureCollection dict."""
    features = []
    for row in rows:
        geom = wkb.loads(bytes(row["geom_wkb"]))
        props = dict(row["props"]) if row["props"] else {}
        # Add metadata fields
        props["_id"] = str(row["id"])
        props["_status"] = row["status"]
        props["_source_file"] = row.get("source_file")
        props["_corrected_at"] = (
            row["corrected_at"].isoformat() if row.get("corrected_at") else None
        )
        props["_validated_at"] = (
            row["validated_at"].isoformat() if row.get("validated_at") else None
        )

        features.append(
            {
                "type": "Feature",
                "id": str(row["id"]),
                "geometry": geom_mapping(geom),
                "properties": props,
            }
        )

    return {
        "type": "FeatureCollection",
        "name": layer["name"],
        "features": features,
    }


def _geometry_type_to_fiona(geom_type: str) -> str:
    """Map DB geometry type strings to Fiona schema type."""
    mapping = {
        "Point": "Point",
        "MultiPoint": "MultiPoint",
        "LineString": "LineString",
        "LineStringZ": "3D LineString",
        "MultiLineString": "MultiLineString",
        "Polygon": "Polygon",
        "MultiPolygon": "MultiPolygon",
        "Geometry": "Unknown",
    }
    return mapping.get(geom_type, "Unknown")


def _build_fiona_schema(layer: dict, sample_props: dict) -> dict:
    """Build a Fiona schema dict from layer metadata and sample properties."""
    properties = {}
    for key, value in sample_props.items():
        if isinstance(value, bool):
            properties[key] = "bool"
        elif isinstance(value, int):
            properties[key] = "int"
        elif isinstance(value, float):
            properties[key] = "float"
        else:
            properties[key] = "str"

    return {
        "geometry": _geometry_type_to_fiona(layer.get("geometry_type", "Geometry")),
        "properties": properties,
    }


def _serialize_props(props: dict) -> dict:
    """Ensure all property values are JSON-serializable strings for Fiona."""
    out = {}
    for k, v in props.items():
        if v is None:
            out[k] = None
        elif isinstance(v, (dict, list)):
            out[k] = json.dumps(v, default=str)
        elif isinstance(v, datetime):
            out[k] = v.isoformat()
        else:
            out[k] = v
    return out


# ── Endpoints ───────────────────────────────────────


@app.get("/health")
async def health():
    return {"status": "ok", "service": "export", "version": "2.0.0"}


@app.get("/export/{project_slug}/{layer_id}")
async def export_layer(
    project_slug: str,
    layer_id: str,
    format: ExportFormat = Query(ExportFormat.geojson, description="Output format"),
    status: StatusFilter = Query(StatusFilter.all, description="Filter by feature status"),
    corrected: bool = Query(True, description="Merge latest correction into output"),
):
    """
    Export a layer's features in the requested format.
    Supports: GeoJSON, GeoPackage, Shapefile, CSV, KML.
    """
    layer, rows = _fetch_layer_features(layer_id, project_slug, status, corrected)

    if not rows:
        raise HTTPException(
            status_code=404,
            detail="No features found matching the criteria.",
        )

    safe_name = layer["name"].replace(" ", "_")[:50]

    # ── GeoJSON ──────────────────────────────────
    if format == ExportFormat.geojson:
        fc = _rows_to_geojson(layer, rows)
        content = orjson.dumps(fc, option=orjson.OPT_INDENT_2)
        return Response(
            content=content,
            media_type="application/geo+json",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_name}.geojson"'
            },
        )

    # ── CSV ──────────────────────────────────────
    if format == ExportFormat.csv:
        fc = _rows_to_geojson(layer, rows)
        buf = io.StringIO()
        if fc["features"]:
            first_props = fc["features"][0]["properties"]
            fieldnames = ["_wkt"] + list(first_props.keys())
            writer = csv.DictWriter(buf, fieldnames=fieldnames)
            writer.writeheader()
            for feat in fc["features"]:
                geom = wkb.loads(
                    bytes(
                        next(
                            r["geom_wkb"]
                            for r in rows
                            if str(r["id"]) == feat["id"]
                        )
                    )
                )
                row_dict = {"_wkt": geom.wkt}
                row_dict.update(
                    {k: json.dumps(v, default=str) if isinstance(v, (dict, list)) else v
                     for k, v in feat["properties"].items()}
                )
                writer.writerow(row_dict)

        return Response(
            content=buf.getvalue(),
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="{safe_name}.csv"'
            },
        )

    # ── Fiona-based formats (GPKG, SHP, KML) ────
    driver_map = {
        ExportFormat.gpkg: ("GPKG", "application/geopackage+sqlite3", ".gpkg"),
        ExportFormat.shp: ("ESRI Shapefile", "application/x-shapefile", ".shp.zip"),
        ExportFormat.kml: ("KML", "application/vnd.google-earth.kml+xml", ".kml"),
    }

    driver, media_type, ext = driver_map[format]

    fc = _rows_to_geojson(layer, rows)

    # Collect all property keys for schema
    all_props: dict = {}
    for feat in fc["features"]:
        for k, v in feat["properties"].items():
            if k not in all_props and v is not None:
                all_props[k] = v
    schema = _build_fiona_schema(layer, all_props)

    with tempfile.TemporaryDirectory() as tmpdir:
        if format == ExportFormat.shp:
            # Shapefile: write then zip all component files
            shp_path = os.path.join(tmpdir, f"{safe_name}.shp")
            with fiona.open(shp_path, "w", driver=driver, schema=schema, crs="EPSG:4326") as dst:
                for feat in fc["features"]:
                    dst.write(
                        {
                            "geometry": feat["geometry"],
                            "properties": _serialize_props(feat["properties"]),
                        }
                    )

            # Create zip of all shapefile components
            import zipfile

            zip_buf = io.BytesIO()
            with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
                for fname in os.listdir(tmpdir):
                    fpath = os.path.join(tmpdir, fname)
                    zf.write(fpath, fname)
            zip_buf.seek(0)

            return Response(
                content=zip_buf.getvalue(),
                media_type="application/zip",
                headers={
                    "Content-Disposition": f'attachment; filename="{safe_name}.shp.zip"'
                },
            )
        else:
            out_path = os.path.join(tmpdir, f"{safe_name}{ext}")
            with fiona.open(out_path, "w", driver=driver, schema=schema, crs="EPSG:4326") as dst:
                for feat in fc["features"]:
                    dst.write(
                        {
                            "geometry": feat["geometry"],
                            "properties": _serialize_props(feat["properties"]),
                        }
                    )

            with open(out_path, "rb") as f:
                content = f.read()

            return Response(
                content=content,
                media_type=media_type,
                headers={
                    "Content-Disposition": f'attachment; filename="{safe_name}{ext}"'
                },
            )


@app.get("/export/{project_slug}/{layer_id}/meta")
async def export_meta(
    project_slug: str,
    layer_id: str,
    status: StatusFilter = Query(StatusFilter.all),
):
    """Return metadata about what would be exported (feature count, etc.)."""
    layer, rows = _fetch_layer_features(layer_id, project_slug, status, use_corrected=False)
    return ExportMeta(
        project_slug=project_slug,
        layer_id=layer_id,
        format=ExportFormat.geojson,
        status=status,
        feature_count=len(rows),
        exported_at=datetime.utcnow().isoformat(),
    )


@app.get("/projects/{project_slug}/layers")
async def list_layers(project_slug: str):
    """List all layers in a project (for export UI)."""
    conn = get_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur.execute(
            """
            SELECT l.id, l.name, l.geometry_type, l.is_reference,
                   l.display_order, l.group_name,
                   (SELECT count(*) FROM public.features WHERE layer_id = l.id) AS feature_count
            FROM public.layers l
            JOIN public.projects p ON p.id = l.project_id
            WHERE p.slug = %s
            ORDER BY l.display_order
            """,
            (project_slug,),
        )
        layers = cur.fetchall()
        # Convert uuid to str
        for lyr in layers:
            lyr["id"] = str(lyr["id"])
        return {"layers": layers}
    finally:
        conn.close()


@app.post("/webhook/kobo")
async def kobo_webhook(payload: dict):
    """
    Receives KoboToolbox webhook submissions.
    Expected to find '_id', '_geolocation', and fields mapped to layer properties.
    """
    # Quick validation
    kobo_form_id = payload.get("_xform_id_string")
    submission_id = payload.get("_id")
    
    if not kobo_form_id or not submission_id:
        raise HTTPException(status_code=400, detail="Missing _xform_id_string or _id")

    conn = get_conn()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # Find the layer configured for this Kobo form
        # We query the layers table where form_config->>'kobo_form_id' matches or similar logic
        # For v2, we assume form_config JSONB contains 'kobo_form_id'
        cur.execute(
            """
            SELECT id, fields, project_id 
            FROM public.layers 
            WHERE form_config->>'kobo_form_id' = %s
            LIMIT 1
            """,
            (str(kobo_form_id),)
        )
        layer = cur.fetchone()

        if not layer:
            # If we don't find it strictly by form_config, try finding any layer
            # just to avoid dropping data if it's uniquely mapped
            raise HTTPException(status_code=404, detail=f"No layer configured for Kobo form {kobo_form_id}")

        layer_id = str(layer["id"])
        fields_schema = layer.get("fields", [])

        # Match submission data to layer fields
        props_patch = {}
        for field in fields_schema:
            field_name = field.get("name")
            kobo_name = field.get("kobo_question_name", field_name)
            
            if kobo_name in payload:
                props_patch[field_name] = payload[kobo_name]

        # Extract geometry from _geolocation [lat, lon]
        geom_wkt = None
        gps_point_wkt = None
        geolocation = payload.get("_geolocation")
        
        if geolocation and len(geolocation) >= 2 and geolocation[0] is not None and geolocation[1] is not None:
            lat = float(geolocation[0])
            lon = float(geolocation[1])
            pt = Point(lon, lat)
            geom_wkt = pt.wkt
            gps_point_wkt = pt.wkt

        # Find if this submission updates an existing feature via a specific tracking field (e.g. 'feature_id')
        # Kobo forms usually pass the original feature id in a hidden field. Let's look for 'feature_id' or similar.
        feature_id = payload.get("feature_id") or payload.get("id_feature")
        
        if not feature_id:
            # Fallback: We can't link this to a specific feature cleanly without an ID.
            # Might store it as a new feature or orphan correction.
            raise HTTPException(status_code=400, detail="Submission missing feature_id linking field")

        # Upsert the correction
        query = """
            INSERT INTO public.corrections (
                feature_id, layer_id, props_patch, geom_corrected, gps_point, 
                kobo_submission_id, kobo_form_id, status, created_at, updated_at
            ) VALUES (
                %s, %s, %s, 
                ST_GeomFromText(%s, 4326), 
                ST_GeomFromText(%s, 4326), 
                %s, %s, 'submitted', now(), now()
            )
            ON CONFLICT (id) DO NOTHING
            RETURNING id;
        """
        
        # NOTE: UPSERT logic on conflict might require a UNIQUE constraint on Kobo submission ID.
        # Since we use UUID primary keys by default, we just insert. 
        # To make it truly idempotent based on Kobo ID, you'd add a unique constraint on (kobo_submission_id).
        
        cur.execute(
            query,
            (
                feature_id,
                layer_id,
                orjson.dumps(props_patch).decode('utf-8'),
                geom_wkt,
                gps_point_wkt,
                str(submission_id),
                str(kobo_form_id)
            )
        )
        
        # Also auto-update feature status to 'corrected'
        cur.execute(
            "UPDATE public.features SET status = 'corrected', updated_at = now() WHERE id = %s AND status = 'locked'",
            (feature_id,)
        )
        
        conn.commit()
        return {"status": "success", "layer_id": layer_id, "feature_id": feature_id}
        
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

