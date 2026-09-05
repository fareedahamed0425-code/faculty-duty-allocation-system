from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.db.session import engine, Base, SessionLocal
from app.models.entities import Role
from app.seed.seed_data import seed_database
from app.api.v1 import api_router

def init_db():
    try:
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            if db.query(Role).count() == 0:
                seed_database(db)
        finally:
            db.close()
    except Exception as e:
        print(f"Database initialization warning: {e}")

# Safe startup initialization
init_db()

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handler for clean error responses
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # For HTTPExceptions, let FastAPI handle them normally
    if hasattr(exc, "status_code"):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.detail}
        )
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal Server Error: {str(exc)}"}
    )

# Include API V1 Router
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "institution": settings.INSTITUTION_NAME,
        "max_weekly_substitutions": settings.MAX_WEEKLY_SUBSTITUTIONS,
        "max_daily_regular_classes": settings.MAX_DAILY_REGULAR_CLASSES,
        "model": settings.NVIDIA_MODEL
    }

import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Static files & SPA Frontend serving
static_candidates = [
    os.path.join(os.path.dirname(__file__), "static"),
    os.path.join(os.path.dirname(__file__), "..", "static"),
    os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"),
]

static_dir = None
for candidate in static_candidates:
    if os.path.exists(candidate) and os.path.isdir(candidate):
        static_dir = os.path.abspath(candidate)
        break

if static_dir and os.path.exists(os.path.join(static_dir, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="assets")
    app.mount("/api/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="api_assets")

@app.get("/")
@app.get("/api")
@app.get("/api/index.py")
async def root_index():
    if static_dir:
        index_file = os.path.join(static_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file, media_type="text/html")
    return JSONResponse(status_code=200, content={"message": "Faculty Duty Allocation System Backend is Running"})

@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    clean_path = full_path.strip("/")
    
    # Strip any Vercel serverless prefixes
    if clean_path.startswith("api/index.py/"):
        clean_path = clean_path[len("api/index.py/"):]
    elif clean_path == "api/index.py":
        clean_path = ""
    elif clean_path.startswith("api/"):
        if clean_path.startswith("api/v1"):
            return JSONResponse(status_code=404, content={"detail": "Not Found"})
        clean_path = clean_path[len("api/"):]
    elif clean_path == "api":
        clean_path = ""
    
    # Do not intercept docs / openapi
    if clean_path.startswith("docs") or clean_path.startswith("openapi.json"):
        return JSONResponse(status_code=404, content={"detail": "Not Found"})
    
    if static_dir:
        direct_file = os.path.join(static_dir, clean_path)
        if clean_path and os.path.exists(direct_file) and os.path.isfile(direct_file):
            media_type = None
            if direct_file.endswith(".js"):
                media_type = "application/javascript"
            elif direct_file.endswith(".css"):
                media_type = "text/css"
            elif direct_file.endswith(".svg"):
                media_type = "image/svg+xml"
            return FileResponse(direct_file, media_type=media_type)
        
        index_file = os.path.join(static_dir, "index.html")
        if os.path.exists(index_file):
            return FileResponse(index_file, media_type="text/html")
            
    return JSONResponse(status_code=200, content={"message": "Faculty Duty Allocation System Backend is Running"})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
