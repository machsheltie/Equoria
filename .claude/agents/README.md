# Custom Agents Directory

This directory contains custom agents for the Equoria project.

## Purpose

Custom agents extend Claude Code's capabilities with project-specific functionality and workflows.

## Structure

```
.claude/agents/
├── README.md           # This file
├── backend/            # Backend specific agents (future)
├── frontend/           # Frontend web app specific agents (future)
└── shared/             # Shared utility agents (future)
```

## Creating Custom Agents

Custom agents are YAML files that define specialized workflows. Example:

```yaml
name: "Backend Test Runner"
description: "Run backend tests with comprehensive reporting"
tools:
  - Bash
  - Read
  - Write
prompt: |
  Run the backend test suite and provide detailed results:
  1. Navigate to backend directory
  2. Run npm test with coverage
  3. Analyze results and report failures
  4. Suggest fixes for failing tests
```

## Best Practices

1. **Name agents clearly** - Use descriptive names that explain their purpose
2. **Limit tool access** - Only grant tools the agent actually needs
3. **Document thoroughly** - Include clear descriptions and usage examples
4. **Test agents** - Verify agent functionality before committing
5. **Version control** - Keep agents in git for team collaboration

## Available Agents

Currently, this project uses system-wide agents from installed plugins:
- **documentation-generator** - Generate comprehensive documentation
- **devops-automation** - CI/CD and deployment automation
- **testing-suite** - Advanced testing tools and workflows
- **project-management-suite** - Project tracking and management
- **security-pro** - Security scanning and best practices

## Adding New Agents

To add a new custom agent:

1. Create a YAML file in this directory
2. Define the agent's name, description, and tools
3. Write the agent's prompt/instructions
4. Test the agent with `/agent your-agent-name`
5. Document the agent in this README

## Resources

- [Claude Code Agents Documentation](https://docs.claude.com/claude-code/agents)
- [Agent Best Practices](https://docs.aitmpl.com/agents)
- [Example Agents](https://github.com/davila7/claude-code-templates/tree/main/agents)
