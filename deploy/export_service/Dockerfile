FROM python:3.11-slim

# System deps for fiona/GDAL, shapely (GEOS), pyproj (PROJ)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libgdal-dev gdal-bin libgeos-dev libproj-dev gcc && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8100

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8100", "--workers", "2"]
