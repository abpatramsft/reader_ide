"""Tests for the skills auto-discovery registry (backend/skills/__init__.py)."""
import pytest

from skills import SKILLS, Skill, get_skill, list_skills, _parse_skill_md


class TestListSkills:
    def test_returns_list(self):
        result = list_skills()
        assert isinstance(result, list)

    def test_at_least_one_skill_loaded(self):
        """The skills/ directory ships with several .skill.md files."""
        assert len(list_skills()) > 0

    def test_each_skill_has_required_keys(self):
        for skill in list_skills():
            assert "name" in skill, f"Missing 'name' in {skill}"
            assert "display_name" in skill, f"Missing 'display_name' in {skill}"
            assert "description" in skill, f"Missing 'description' in {skill}"
            assert "icon" in skill, f"Missing 'icon' in {skill}"
            assert "placeholder" in skill, f"Missing 'placeholder' in {skill}"

    def test_names_are_non_empty_strings(self):
        for skill in list_skills():
            assert isinstance(skill["name"], str)
            assert len(skill["name"]) > 0


class TestGetSkill:
    def test_known_skill_names_are_findable(self):
        """Every name returned by list_skills() must be retrievable."""
        for d in list_skills():
            skill = get_skill(d["name"])
            assert skill is not None
            assert isinstance(skill, Skill)

    def test_unknown_skill_returns_none(self):
        assert get_skill("__no_such_skill__") is None

    def test_get_skill_case_sensitive(self):
        """Skill lookup is case-sensitive by convention."""
        for d in list_skills():
            # Uppercase variant should NOT match the lowercase name
            upper = d["name"].upper()
            if upper != d["name"]:
                assert get_skill(upper) is None
                break


class TestSkillDataclass:
    def test_to_dict_contains_expected_keys(self):
        skill = next(iter(SKILLS.values()))
        d = skill.to_dict()
        for key in ("name", "display_name", "description", "icon", "placeholder"):
            assert key in d

    def test_to_dict_does_not_expose_prompt_template(self):
        """prompt_template is internal; the public dict must not include it."""
        skill = next(iter(SKILLS.values()))
        assert "prompt_template" not in skill.to_dict()


class TestKnownSkillNames:
    """Smoke-test that the expected built-in skills are present."""

    EXPECTED = {"recap", "explain", "theme", "summary", "timeline"}

    def test_expected_skills_present(self):
        loaded_names = {d["name"] for d in list_skills()}
        for name in self.EXPECTED:
            assert name in loaded_names, f"Expected skill '{name}' not found"
