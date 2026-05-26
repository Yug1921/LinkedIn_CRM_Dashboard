from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.api import api_router
from app.api.routes.scoring import router as scoring_router

app = FastAPI(
    title="CRM Dashboard API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://linked-in-crm-dashboard.vercel.app",
        "https://linked-in-crm-dashboard-git-main-yugyugupadhyay-7261s-projects.vercel.app",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(scoring_router, prefix="/api", tags=["scoring"])