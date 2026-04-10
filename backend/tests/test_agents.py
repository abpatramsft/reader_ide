"""Tests for the agents auto-discovery registry (backend/agents/__init__.py)."""
import pytest

from agents import AGENTS, Agent, get_agent, list_agents, all_agents_sdk


class TestListAgents:
    def test_returns_list(self):
        result = list_agents()
        assert isinstance(result, list)

    def test_at_least_one_agent_loaded(self):
        """The agents/ directory ships with several .agent.md files."""
        assert len(list_agents()) > 0

    def test_each_agent_has_required_keys(self):
        for agent in list_agents():
            assert "name" in agent, f"Missing 'name' in {agent}"
            assert "display_name" in agent, f"Missing 'display_name' in {agent}"
            assert "description" in agent, f"Missing 'description' in {agent}"
            assert "icon" in agent, f"Missing 'icon' in {agent}"
            assert "placeholder" in agent, f"Missing 'placeholder' in {agent}"

    def test_names_are_non_empty_strings(self):
        for agent in list_agents():
            assert isinstance(agent["name"], str)
            assert len(agent["name"]) > 0


class TestGetAgent:
    def test_known_agents_are_retrievable(self):
        for d in list_agents():
            agent = get_agent(d["name"])
            assert agent is not None
            assert isinstance(agent, Agent)

    def test_unknown_agent_returns_none(self):
        assert get_agent("__no_such_agent__") is None

    def test_lookup_is_case_sensitive(self):
        for d in list_agents():
            upper = d["name"].upper()
            if upper != d["name"]:
                assert get_agent(upper) is None
                break


class TestAllAgentsSdk:
    def test_returns_list(self):
        result = all_agents_sdk()
        assert isinstance(result, list)

    def test_sdk_dicts_have_prompt_key(self):
        """SDK format includes the prompt body, unlike the public dict."""
        for agent_dict in all_agents_sdk():
            assert "prompt" in agent_dict
            assert "name" in agent_dict
            assert "display_name" in agent_dict

    def test_sdk_format_matches_agent_count(self):
        assert len(all_agents_sdk()) == len(list_agents())


class TestAgentDataclass:
    def test_to_dict_does_not_expose_prompt(self):
        """The public-facing dict must not expose the agent persona prompt."""
        agent = next(iter(AGENTS.values()))
        d = agent.to_dict()
        assert "prompt" not in d

    def test_to_sdk_dict_includes_prompt(self):
        agent = next(iter(AGENTS.values()))
        sdk = agent.to_sdk_dict()
        assert "prompt" in sdk
        assert len(sdk["prompt"]) > 0


class TestKnownAgentNames:
    """Smoke-test that the expected built-in agents are present."""

    EXPECTED = {"archivist", "critic", "debater", "historian", "philosopher"}

    def test_expected_agents_present(self):
        loaded_names = {d["name"] for d in list_agents()}
        for name in self.EXPECTED:
            assert name in loaded_names, f"Expected agent '{name}' not found"
