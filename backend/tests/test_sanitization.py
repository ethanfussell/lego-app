"""Tests for input sanitization utilities and schema validators."""
import pytest

from app.core.sanitize import sanitize_text, sanitize_oneline


# ---------------------------------------------------------------------------
# sanitize_text
# ---------------------------------------------------------------------------

def test_sanitize_text_strips_tags():
    assert sanitize_text("<b>bold</b> text") == "bold text"


def test_sanitize_text_escapes_ampersand():
    """Bare ampersands are escaped."""
    assert sanitize_text("AT&T is great") == "AT&amp;T is great"


def test_sanitize_text_escapes_angle_brackets():
    """Lone angle brackets (not forming tags) are escaped."""
    assert sanitize_text("3 < 5") == "3 &lt; 5"


def test_sanitize_text_strips_script_tags():
    result = sanitize_text('<script>alert("xss")</script>Hello')
    assert "<script>" not in result
    assert "Hello" in result


def test_sanitize_text_preserves_newlines():
    result = sanitize_text("line1\nline2\nline3")
    assert "\n" in result


def test_sanitize_text_empty_string():
    assert sanitize_text("") == ""


def test_sanitize_text_strips_surrounding_whitespace():
    assert sanitize_text("  hello  ") == "hello"


def test_sanitize_text_plain_text_unchanged():
    assert sanitize_text("Just a normal review") == "Just a normal review"


# ---------------------------------------------------------------------------
# sanitize_oneline
# ---------------------------------------------------------------------------

def test_sanitize_oneline_collapses_whitespace():
    assert sanitize_oneline("  hello   world  ") == "hello world"


def test_sanitize_oneline_strips_newlines():
    assert sanitize_oneline("line1\nline2\tline3") == "line1 line2 line3"


def test_sanitize_oneline_strips_tags():
    assert sanitize_oneline("<b>title</b>") == "title"


def test_sanitize_oneline_empty_string():
    assert sanitize_oneline("") == ""


# ---------------------------------------------------------------------------
# ReviewCreate schema validation
# ---------------------------------------------------------------------------

class TestReviewCreateValidation:

    def test_text_within_limit(self):
        from app.schemas.review import ReviewCreate
        r = ReviewCreate(text="A" * 5000)
        assert len(r.text) == 5000

    def test_text_exceeds_limit(self):
        from app.schemas.review import ReviewCreate
        with pytest.raises(Exception):  # ValidationError
            ReviewCreate(text="A" * 5001)

    def test_text_sanitized(self):
        from app.schemas.review import ReviewCreate
        r = ReviewCreate(text="<b>Great</b> set!")
        assert r.text == "Great set!"

    def test_text_none_allowed(self):
        from app.schemas.review import ReviewCreate
        r = ReviewCreate(text=None, rating=4.0)
        assert r.text is None

    def test_rating_still_validates(self):
        from app.schemas.review import ReviewCreate
        with pytest.raises(Exception):
            ReviewCreate(rating=6.0)


# ---------------------------------------------------------------------------
# ListCreate schema validation
# ---------------------------------------------------------------------------

class TestListCreateValidation:

    def test_title_within_limit(self):
        from app.schemas.list import ListCreate
        lc = ListCreate(title="A" * 200)
        assert len(lc.title) <= 200

    def test_title_exceeds_limit(self):
        from app.schemas.list import ListCreate
        with pytest.raises(Exception):
            ListCreate(title="A" * 201)

    def test_title_sanitized(self):
        from app.schemas.list import ListCreate
        lc = ListCreate(title="<script>My List</script>")
        assert "<script>" not in lc.title
        assert "My List" in lc.title

    def test_title_whitespace_collapsed(self):
        from app.schemas.list import ListCreate
        lc = ListCreate(title="  My   List  ")
        assert lc.title == "My List"

    def test_description_within_limit(self):
        from app.schemas.list import ListCreate
        lc = ListCreate(title="Test", description="B" * 2000)
        assert len(lc.description) <= 2000

    def test_description_exceeds_limit(self):
        from app.schemas.list import ListCreate
        with pytest.raises(Exception):
            ListCreate(title="Test", description="B" * 2001)

    def test_description_sanitized(self):
        from app.schemas.list import ListCreate
        lc = ListCreate(title="Test", description="<img src=x onerror=alert(1)>Nice list")
        assert "<img" not in lc.description
        assert "Nice list" in lc.description


# ---------------------------------------------------------------------------
# ListUpdate schema validation
# ---------------------------------------------------------------------------

class TestListUpdateValidation:

    def test_title_sanitized(self):
        from app.schemas.list import ListUpdate
        lu = ListUpdate(title="<b>Updated</b>")
        assert lu.title == "Updated"

    def test_title_none_allowed(self):
        from app.schemas.list import ListUpdate
        lu = ListUpdate(title=None)
        assert lu.title is None

    def test_description_sanitized(self):
        from app.schemas.list import ListUpdate
        lu = ListUpdate(description="<em>emphasis</em> text")
        assert lu.description == "emphasis text"

    def test_title_exceeds_limit(self):
        from app.schemas.list import ListUpdate
        with pytest.raises(Exception):
            ListUpdate(title="X" * 201)
