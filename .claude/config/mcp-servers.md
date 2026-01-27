# MCP Server Configuration

**Last Updated:** 2025-01-18
**Purpose:** Model Context Protocol server configurations for Equoria project

---

## Recommended MCP Servers

### 1. Sequential Thinking (Required)

**Purpose:** Complex problem-solving and architectural decisions
**Priority:** Critical

**Configuration:**

```json
{
  "server": "sequential-thinking",
  "enabled": true,
  "use_for": [
    "Architectural design decisions",
    "Complex algorithm development",
    "System integration planning",
    "Performance optimization strategies"
  ]
}
```

**Use Cases:**

- Architectural design decisions
- Complex algorithm development
- System integration planning
- Performance optimization strategies

---

### 2. Context7 (Required)

**Purpose:** Advanced context management for large codebase
**Priority:** Critical

**Configuration:**

```json
{
  "server": "context7",
  "enabled": true,
  "use_for": [
    "Codebase understanding across 30+ tables",
    "Cross-system dependency tracking",
    "Documentation correlation",
    "Long-term project memory"
  ]
}
```

**Use Cases:**

- Codebase understanding across 30+ database tables
- Cross-system dependency tracking
- Documentation correlation
- Long-term project memory

---

### 3. GitHub Integration (Required)

**Purpose:** Version control and CI/CD integration
**Priority:** Critical

**Configuration:**

```json
{
  "server": "github",
  "enabled": true,
  "use_for": [
    "Pull request creation and management",
    "Issue tracking integration",
    "CI/CD workflow monitoring",
    "Code review coordination"
  ]
}
```

**Use Cases:**

- Pull request creation and management
- Issue tracking integration
- CI/CD workflow monitoring (9-job GitHub Actions workflow)
- Code review coordination

---

### 4. Task Manager (High Priority)

**Purpose:** Project task coordination and sprint planning
**Priority:** High

**Configuration:**

```json
{
  "server": "task-manager",
  "enabled": true,
  "use_for": [
    "Sprint planning and tracking",
    "Feature development coordination",
    "Bug tracking and resolution",
    "Frontend development roadmap (23-30 hours)"
  ]
}
```

**Use Cases:**

- Sprint planning and tracking
- Feature development coordination
- Bug tracking and resolution
- Frontend development roadmap management

---

### 5. Serenity (Recommended)

**Purpose:** Code quality and testing assistance
**Priority:** Medium-High

**Configuration:**

```json
{
  "server": "serenity",
  "enabled": true,
  "use_for": [
    "Test generation and validation",
    "Code quality analysis",
    "Refactoring suggestions",
    "Performance profiling"
  ]
}
```

**Use Cases:**

- Test generation and validation
- Code quality analysis
- Refactoring suggestions
- Performance profiling

---

### 6. Chrome Dev Tools (Recommended for Frontend)

**Purpose:** Frontend debugging and performance
**Priority:** Medium (High for frontend development)

**Configuration:**

```json
{
  "server": "chrome-dev-tools",
  "enabled": true,
  "use_for": [
    "React browser game debugging",
    "Performance monitoring",
    "Network request analysis",
    "Memory leak detection"
  ]
}
```

**Use Cases:**

- React browser game debugging
- Performance monitoring (Lighthouse integration)
- Network request analysis
- Memory leak detection

---

## MCP Server Best Practices

### When to Use Each Server

**Sequential Thinking:**

- Before starting complex feature development
- When debugging multi-system issues
- For performance optimization planning
- During architectural decision-making

**Context7:**

- When working across multiple files/systems
- For understanding code dependencies
- When correlating documentation with code
- For long-running development sessions

**GitHub:**

- Before creating pull requests
- When reviewing CI/CD pipeline status
- For issue triage and management
- During code review sessions

**Task Manager:**

- At start of each sprint
- For tracking frontend development progress
- When planning feature development
- For coordinating parallel tasks

**Serenity:**

- When generating tests for new code
- For code quality audits
- During refactoring sessions
- For identifying performance bottlenecks

**Chrome Dev Tools:**

- When debugging React components
- For frontend performance optimization
- When analyzing network requests
- For memory profiling

---

## Troubleshooting

### Server Not Responding

1. Check server is installed and accessible
2. Verify configuration in `claude_desktop_config.json`
3. Restart Claude desktop application
4. Check server logs for errors

### Performance Issues

1. Limit concurrent server usage to 2-3 at a time
2. Use appropriate server for task (avoid overkill)
3. Monitor memory usage
4. Close unused server connections

---

**Related Documentation:**

- [Agent Configuration](./agents-config.md)
- [Skills Configuration](./skills-config.md)
- [Hooks Configuration](./hooks-config.md)
