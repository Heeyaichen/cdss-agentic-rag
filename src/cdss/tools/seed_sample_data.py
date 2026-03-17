from __future__ import annotations

import os
import sys
from datetime import UTC, datetime
from typing import Final

from azure.cosmos import CosmosClient
from azure.identity import DefaultAzureCredential
from azure.storage.blob import BlobServiceClient

PATIENT_PROFILE_ID: Final[str] = "patient_12345"
PROTOCOL_BLOB_NAME: Final[str] = "ENDO-DM-CKD-2025-v3.md"
LAB_REPORT_BLOB_NAME: Final[str] = "lab_report_patient_12345_20260128.txt"


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise ValueError(f"Missing required environment variable: {name}")
    return value


def _seed_cosmos(credential: DefaultAzureCredential) -> None:
    endpoint = _required_env("CDSS_AZURE_COSMOS_ENDPOINT")
    database_name = os.getenv("CDSS_AZURE_COSMOS_DATABASE_NAME", "cdss-db")
    container_name = os.getenv("CDSS_AZURE_COSMOS_PATIENT_PROFILES_CONTAINER", "patient-profiles")

    client = CosmosClient(endpoint, credential=credential)
    database = client.get_database_client(database_name)
    container = database.get_container_client(container_name)

    now = datetime.now(UTC).isoformat()
    patient = {
        "id": PATIENT_PROFILE_ID,
        "patient_id": PATIENT_PROFILE_ID,
        "name": "Jane Doe",
        "demographics": {"age": 65, "sex": "female"},
        "conditions": ["Type 2 Diabetes Mellitus", "CKD Stage 3"],
        "medications": ["Metformin", "Lisinopril"],
        "allergies": ["Sulfa"],
        "labs": {"hba1c": "8.4", "egfr": "42", "uacr": "110"},
        "created_at": now,
        "updated_at": now,
    }

    container.upsert_item(patient)


def _seed_blob(credential: DefaultAzureCredential) -> None:
    blob_endpoint = _required_env("CDSS_AZURE_BLOB_ENDPOINT")
    protocol_container = os.getenv("CDSS_AZURE_BLOB_PROTOCOLS_CONTAINER", "treatment-protocols")
    staging_container = os.getenv("CDSS_AZURE_BLOB_STAGING_CONTAINER", "staging-documents")

    client = BlobServiceClient(account_url=blob_endpoint, credential=credential)

    protocol_content = """# Endocrinology Protocol - T2DM with CKD Stage 3
- Prefer SGLT2 inhibitor when clinically appropriate.
- Reassess metformin dose when eGFR <45.
- Monitor UACR and renal function every 3 months.
"""
    lab_content = "HbA1c 8.4; eGFR 42; UACR 110"

    client.get_blob_client(container=protocol_container, blob=PROTOCOL_BLOB_NAME).upload_blob(
        protocol_content.encode("utf-8"),
        overwrite=True,
    )
    client.get_blob_client(container=staging_container, blob=LAB_REPORT_BLOB_NAME).upload_blob(
        lab_content.encode("utf-8"),
        overwrite=True,
    )


def main() -> int:
    try:
        credential = DefaultAzureCredential()
        _seed_cosmos(credential)
        _seed_blob(credential)
    except Exception as exc:  # noqa: BLE001
        print(f"[ERROR] In-network seed failed: {exc}")
        return 1

    print("[SUCCESS] In-network sample data seeded.")
    print(f"[SUCCESS] Patient profile upserted: {PATIENT_PROFILE_ID}")
    print(f"[SUCCESS] Protocol blob uploaded: {PROTOCOL_BLOB_NAME}")
    print(f"[SUCCESS] Lab report blob uploaded: {LAB_REPORT_BLOB_NAME}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
