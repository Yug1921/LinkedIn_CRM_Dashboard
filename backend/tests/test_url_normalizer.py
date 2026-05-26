import pytest
from app.utils.url_normalizer import normalize_linkedin_url


def test_normalize_valid_profile_url():
    assert normalize_linkedin_url("https://www.linkedin.com/in/someone") == "https://www.linkedin.com/in/someone"


def test_normalize_valid_company_url():
    assert normalize_linkedin_url("https://www.linkedin.com/company/acme-inc") == "https://www.linkedin.com/company/acme-inc"


def test_normalize_strips_query_params():
    assert (
        normalize_linkedin_url("https://www.linkedin.com/in/someone/?trk=public_profile")
        == "https://www.linkedin.com/in/someone"
    )


def test_normalize_strips_trailing_slash():
    assert normalize_linkedin_url("https://www.linkedin.com/in/someone/") == "https://www.linkedin.com/in/someone"


def test_normalize_invalid_url_raises():
    with pytest.raises(ValueError):
        normalize_linkedin_url("https://example.com/in/someone")