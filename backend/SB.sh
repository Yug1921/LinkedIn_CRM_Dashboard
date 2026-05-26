#!/bin/bash

source venv/Scripts/activate

export PATH="$(pwd)/venv/Scripts:$PATH"

python -m uvicorn app.main:app --reload