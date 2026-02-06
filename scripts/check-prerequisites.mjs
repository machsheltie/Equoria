#!/usr/bin/env node

/**
 * Prerequisite Checker for Sprint Status
 *
 * Validates that all prerequisites are met before an epic can start:
 * 1. Retrospective Gate: Previous epic's retrospective must be completed (for epics only)
 * 2. Action Items: All P0 action items blocking the epic must be completed
 *
 * This prevents blocked epics from starting and ensures sustainable development velocity.
 *
 * Usage:
 *   npm run check-prerequisites <epic-id>
 *   npm run check-prerequisites epic-6
 *
 * Exit Codes:
 *   0 - All prerequisites met (retrospective + action items)
 *   1 - Prerequisites missing or validation failed
 *
 * Related: AI-5-6 (Prerequisite System), AI-5-9 (Retrospective Gate)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

/**
 * Load and parse sprint-status.yaml
 */
function loadSprintStatus() {
  const sprintStatusPath = path.join(
    __dirname,
    '..',
    'docs',
    'sprint-artifacts',
    'sprint-status.yaml'
  );

  if (!fs.existsSync(sprintStatusPath)) {
    console.error(
      `${colors.red}✗ Error: sprint-status.yaml not found at ${sprintStatusPath}${colors.reset}`
    );
    process.exit(1);
  }

  try {
    const fileContents = fs.readFileSync(sprintStatusPath, 'utf8');
    const data = yaml.load(fileContents);
    return data;
  } catch (error) {
    console.error(
      `${colors.red}✗ Error parsing sprint-status.yaml: ${error.message}${colors.reset}`
    );
    process.exit(1);
  }
}

/**
 * Find all action items that block a specific epic or story
 */
function findBlockingActionItems(sprintStatus, targetId) {
  const blockingItems = [];

  if (!sprintStatus.action_items) {
    return blockingItems;
  }

  for (const [actionId, actionData] of Object.entries(sprintStatus.action_items)) {
    if (actionData.blocks && Array.isArray(actionData.blocks)) {
      if (actionData.blocks.includes(targetId)) {
        blockingItems.push({
          id: actionId,
          ...actionData,
        });
      }
    }
  }

  return blockingItems;
}

/**
 * Check if an action item is completed
 */
function isActionItemCompleted(actionItem) {
  return actionItem.status === 'completed';
}

/**
 * Find previous epic retrospective
 * For epic-6, looks for epic-5-retrospective
 */
function findPreviousEpicRetrospective(targetId) {
  const epicMatch = targetId.match(/^epic-(\d+)$/);
  if (!epicMatch) {
    return null; // Not an epic, no retrospective required
  }

  const epicNumber = parseInt(epicMatch[1], 10);
  if (epicNumber <= 1) {
    return null; // First epic has no previous retrospective
  }

  const previousEpicNumber = epicNumber - 1;
  const retroId = `epic-${previousEpicNumber}-retrospective`;

  return retroId;
}

/**
 * Check if previous epic's retrospective is complete
 */
function checkRetrospectiveGate(sprintStatus, targetId) {
  const retroId = findPreviousEpicRetrospective(targetId);

  // If no retrospective required, return success
  if (!retroId) {
    return {
      required: false,
      passed: true,
    };
  }

  // Find retrospective in development_status or action_items
  const retroData = getTargetData(sprintStatus, retroId);

  if (!retroData) {
    return {
      required: true,
      passed: false,
      error: `Retrospective '${retroId}' not found in sprint-status.yaml`,
    };
  }

  // Check if retrospective is completed
  if (retroData.status !== 'completed') {
    return {
      required: true,
      passed: false,
      error: `Retrospective '${retroId}' not completed (status: ${retroData.status})`,
      retroData,
    };
  }

  // Check if retro_file is defined
  if (!retroData.retro_file) {
    return {
      required: true,
      passed: false,
      error: `Retrospective '${retroId}' missing retro_file field`,
      retroData,
    };
  }

  // All checks passed
  return {
    required: true,
    passed: true,
    retroId,
    retroFile: retroData.retro_file,
  };
}

/**
 * Get epic or story data by ID
 */
function getTargetData(sprintStatus, targetId) {
  // Check in development_status
  if (sprintStatus.development_status && sprintStatus.development_status[targetId]) {
    return sprintStatus.development_status[targetId];
  }

  // Check in action_items
  if (sprintStatus.action_items && sprintStatus.action_items[targetId]) {
    return sprintStatus.action_items[targetId];
  }

  return null;
}

/**
 * Format action item status for display
 */
function formatActionItem(actionItem) {
  const statusIcon = isActionItemCompleted(actionItem) ? '✓' : '✗';
  const statusColor = isActionItemCompleted(actionItem) ? colors.green : colors.red;
  const priority = actionItem.priority || 'P?';
  const owner = actionItem.owner || 'Unassigned';

  return `  ${statusColor}${statusIcon}${colors.reset} ${colors.bright}${actionItem.id}${colors.reset}: ${actionItem.title}
     Status: ${statusColor}${actionItem.status}${colors.reset} | Priority: ${priority} | Owner: ${owner}`;
}

/**
 * Main prerequisite check function
 */
function checkPrerequisites(targetId) {
  console.log(
    `${colors.cyan}${colors.bright}Checking prerequisites for: ${targetId}${colors.reset}\n`
  );

  const sprintStatus = loadSprintStatus();
  const targetData = getTargetData(sprintStatus, targetId);

  if (!targetData) {
    console.error(
      `${colors.red}✗ Error: Target '${targetId}' not found in sprint-status.yaml${colors.reset}`
    );
    process.exit(1);
  }

  console.log(`${colors.blue}Target:${colors.reset} ${targetData.title || targetId}`);
  console.log(`${colors.blue}Status:${colors.reset} ${targetData.status || 'unknown'}\n`);

  // Check retrospective gate (for epics only)
  const retroCheck = checkRetrospectiveGate(sprintStatus, targetId);

  if (retroCheck.required) {
    console.log(`${colors.cyan}${colors.bright}Retrospective Gate Check:${colors.reset}`);

    if (retroCheck.passed) {
      console.log(`${colors.green}✓ Previous epic retrospective completed${colors.reset}`);
      console.log(`  ${colors.blue}Retrospective ID:${colors.reset} ${retroCheck.retroId}`);
      console.log(`  ${colors.blue}Retrospective File:${colors.reset} ${retroCheck.retroFile}\n`);
    } else {
      console.log(`${colors.red}${colors.bright}✗ RETROSPECTIVE GATE: FAILED${colors.reset}`);
      console.log(`${colors.red}${retroCheck.error}${colors.reset}\n`);
      console.log(
        `${colors.yellow}REQUIREMENT:${colors.reset} Epic N-1 retrospective must be completed before Epic N can start.`
      );
      console.log(
        `${colors.yellow}This prevents recursive process failures and ensures continuous improvement.\n${colors.reset}`
      );
      process.exit(1);
    }
  }

  // Find all blocking action items
  const blockingItems = findBlockingActionItems(sprintStatus, targetId);

  if (blockingItems.length === 0) {
    console.log(`${colors.green}✓ No blocking action items found${colors.reset}`);
    console.log(`${colors.green}✓ Prerequisites check: PASSED${colors.reset}\n`);
    return true;
  }

  console.log(
    `${colors.yellow}Found ${blockingItems.length} action item(s) that block ${targetId}:${colors.reset}\n`
  );

  // Categorize action items
  const completedItems = blockingItems.filter(isActionItemCompleted);
  const pendingItems = blockingItems.filter((item) => !isActionItemCompleted(item));

  // Display completed items
  if (completedItems.length > 0) {
    console.log(
      `${colors.green}${colors.bright}Completed (${completedItems.length}):${colors.reset}`
    );
    completedItems.forEach((item) => {
      console.log(formatActionItem(item));
    });
    console.log();
  }

  // Display pending items
  if (pendingItems.length > 0) {
    console.log(`${colors.red}${colors.bright}Pending (${pendingItems.length}):${colors.reset}`);
    pendingItems.forEach((item) => {
      console.log(formatActionItem(item));
      if (item.description) {
        console.log(`     ${colors.blue}Description:${colors.reset} ${item.description}`);
      }
      if (item.time_estimate) {
        console.log(`     ${colors.blue}Estimate:${colors.reset} ${item.time_estimate}`);
      }
      console.log();
    });
  }

  // Summary
  console.log(`${colors.bright}Summary:${colors.reset}`);
  console.log(`  Total blocking items: ${blockingItems.length}`);
  console.log(`  ${colors.green}Completed: ${completedItems.length}${colors.reset}`);
  console.log(`  ${colors.red}Pending: ${pendingItems.length}${colors.reset}`);
  console.log();

  // Final result
  if (pendingItems.length > 0) {
    console.log(`${colors.red}${colors.bright}✗ Prerequisites check: FAILED${colors.reset}`);
    console.log(
      `${colors.red}Cannot start ${targetId} until all ${pendingItems.length} blocking action items are completed.${colors.reset}\n`
    );
    return false;
  } else {
    console.log(`${colors.green}${colors.bright}✓ Prerequisites check: PASSED${colors.reset}`);
    console.log(
      `${colors.green}All blocking action items are completed. ${targetId} is ready to start.${colors.reset}\n`
    );
    return true;
  }
}

/**
 * CLI Entry Point
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error(`${colors.red}✗ Error: Missing target ID${colors.reset}`);
    console.log('\nUsage:');
    console.log('  npm run check-prerequisites <epic-id>');
    console.log('  npm run check-prerequisites <story-id>');
    console.log('\nExamples:');
    console.log('  npm run check-prerequisites epic-6');
    console.log('  npm run check-prerequisites 6-1-breeding-pair-selection');
    console.log('  npm run check-prerequisites prep-sprint-epic-6\n');
    process.exit(1);
  }

  const targetId = args[0];
  const passed = checkPrerequisites(targetId);

  process.exit(passed ? 0 : 1);
}

main();
