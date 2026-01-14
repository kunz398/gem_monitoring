from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from app.routes import endpoints
from fastapi.routing import APIRoute
from pydantic import BaseModel
from app.db import close_connection_pool

app = FastAPI(
    title="Monitoring API",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    root_path="/widget10-api"  # Serve docs/openapi under the proxied root
)

# Trust proxy headers
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["*"]
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3111",  # React development server
        "http://127.0.0.1:3111",  # Alternative localhost
        "http://frontend:3111", 
        "http://localhost:8011",
        "http://localhost:3001",
        "http://localhost:8085",  # Main nginx gateway
        "http://172.25.160.1:8011/",
        "https://opmthredds.gem.spc.int/"  
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
)

templates = Jinja2Templates(directory="app/templates")

app.include_router(endpoints.router, prefix="/service")

@app.on_event("startup")
async def startup_event():
    """Initialize database schema on application startup"""
    from app.models import DatabaseSchema
    DatabaseSchema.initialize_database()

@app.on_event("shutdown")
async def shutdown_event():
    """Close database connection pool on application shutdown"""
    close_connection_pool()

def extract_pydantic_fields(model_class):
    """Extract fields from a Pydantic model"""
    if not issubclass(model_class, BaseModel):
        return []

    fields = []
    for field_name, field_info in model_class.model_fields.items():
        field_type = field_info.annotation
        is_required = field_info.is_required()

        # Handle default values properly - avoid PydanticUndefined
        default_value = ""
        if hasattr(field_info, 'default') and field_info.default is not None:
            # Check if it's PydanticUndefined (which means no default)
            default_str = str(field_info.default)
            if 'PydanticUndefined' not in default_str:
                default_value = field_info.default

        # Get a readable type name
        type_name = getattr(field_type, '__name__', str(field_type))
        #Clean up better readability
        if 'IPvAnyAddress' in type_name:
            type_name = 'IP Address'
        elif 'typing.' in type_name:
            type_name = type_name.replace('typing.', '')

        fields.append({
            "name": field_name,
            "type": type_name,
            "required": is_required,
            "default": default_value
        })

    return fields


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    api_routes = []

    for route in app.routes:
        # Safely get the path, skip if not available
        route_path = getattr(route, 'path', None)
        if not route_path:
            continue
            
        if route_path.startswith(("/docs", "/redoc", "/openapi")):
            continue
        if not isinstance(route, APIRoute):
            continue
        if "GET" in route.methods or "POST" in route.methods:  # You can include other methods if needed
            # Extract parameters for the endpoint
            params = []

            # Handle path parameters
            for dep in route.dependant.path_params:
                params.append({
                    "name": dep.name,
                    "type": getattr(dep.type_, "__name__", str(dep.type_)),
                    "required": dep.required,
                    "default": dep.default if dep.default is not None else "",
                    "location": "path"
                })

            # Handle query parameters
            for dep in route.dependant.query_params:
                params.append({
                    "name": dep.name,
                    "type": getattr(dep.type_, "__name__", str(dep.type_)),
                    "required": dep.required,
                    "default": dep.default if dep.default is not None else "",
                    "location": "query"
                })

            # Handle body parameters (Pydantic models)
            for dep in route.dependant.body_params:
                if hasattr(dep.type_, 'model_fields'):  # It's a Pydantic model
                    # Extract fields from the Pydantic model
                    pydantic_fields = extract_pydantic_fields(dep.type_)
                    for field in pydantic_fields:
                        field["location"] = "body"
                        params.append(field)
                else:
                    # Regular body parameter
                    params.append({
                        "name": dep.name,
                        "type": getattr(dep.type_, "__name__", str(dep.type_)),
                        "required": dep.required,
                        "default": dep.default if dep.default is not None else "",
                        "location": "body"
                    })

            api_routes.append({
                "path": route_path,
                "methods": list(route.methods),
                "description": route.summary or (route.endpoint.__doc__ or "").strip(),
                "parameters": params
            })

    return templates.TemplateResponse("index.html", {
        "request": request,
        "title": "API Index Documentation",
        "routes": api_routes
    })


# Health check endpoint for Docker
@app.get("/health")
async def health_check():
    return {"status": "healthy", "message": "API is running"}