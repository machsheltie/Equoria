#!/bin/bash
# Migration script for .claude reorganization

set -e  # Exit on error

echo "🚀 Starting .claude folder reorganization..."
echo ""

# Function to move and rename file
move_file() {
  local src="$1"
  local dest="$2"

  if [ -f "$src" ]; then
    mkdir -p "$(dirname "$dest")"
    mv "$src" "$dest"
    echo "✅ Moved: $(basename $src) → $dest"
  else
    echo "⚠️  Not found: $src"
  fi
}

# Category 1: Planning Documents
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Migrating Planning Documents..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
move_file "docs/DAY_3_PLAN.md" "planning/current/week1/day3Plan.md"
move_file "docs/DAY_3_IMPLEMENTATION_CHECKLIST.md" "planning/current/week1/day3ImplementationChecklist.md"
move_file "docs/DAY_3_PHASE_1_STRATEGY.md" "planning/current/week1/day3Phase1Strategy.md"
move_file "plans/week-2-plan.md" "planning/current/week2Plan.md"
move_file "plans/week-3-plan.md" "planning/current/week3Plan.md"
move_file "plans/week-4-plan.md" "planning/current/week4Plan.md"
move_file "docs/week2.md" "planning/archive/week2Old.md"
move_file "docs/nextphase-development-plan.md" "planning/current/nextPhaseDevelopmentPlan.md"
move_file "docs/FRONTEND_GROOM_IMPLEMENTATION_PLAN.md" "planning/current/frontendGroomImplementationPlan.md"
move_file "docs/DEPLOYMENT_PLAN.md" "planning/current/deploymentPlan.md"

# Category 2: Architecture - Backend
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏗️  Migrating Architecture Documents - Backend..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
move_file "docs/backend-overview.md" "architecture/backend/backendOverview.md"
move_file "docs/api_specs.markdown" "architecture/backend/apiSpecs.md"
move_file "docs/controllers-layer.md" "architecture/backend/controllersLayer.md"
move_file "docs/models-layer.md" "architecture/backend/modelsLayer.md"
move_file "docs/routes-layer.md" "architecture/backend/routesLayer.md"
move_file "docs/utils-layer.md" "architecture/backend/utilsLayer.md"
move_file "docs/architecture.markdown" "architecture/backend/architectureOverview.md"

# Architecture - Frontend
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎨 Migrating Architecture Documents - Frontend..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
move_file "docs/frontend-architecture.md" "architecture/frontend/frontendArchitecture.md"
move_file "plans/equoria-ui-design-overview.md" "architecture/frontend/uiDesignOverview.md"
move_file "docs/horsepage.md" "architecture/frontend/horsePage.md"

# Architecture - Database
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🗄️  Migrating Architecture Documents - Database..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
move_file "docs/database_schema.markdown" "architecture/database/databaseSchema.md"
move_file "docs/database-infrastructure.md" "architecture/database/databaseInfrastructure.md"

# Architecture - Testing
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 Migrating Architecture Documents - Testing..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
move_file "docs/testing-architecture.md" "architecture/testing/testingArchitecture.md"
move_file "rules/GROOM_API_TEST_PLAN.md" "architecture/testing/groomApiTestPlan.md"
move_file "rules/GROOM_API_TESTS.postman_collection.json" "architecture/testing/groomApiTests.postman_collection.json"

# Category 3: Game Design - Traits
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧬 Migrating Game Design Documents - Traits..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
move_file "docs/epigenetictraits.md" "gameDesign/traits/epigeneticTraits.md"
move_file "docs/advancedepigenetictraitsystem.md" "gameDesign/traits/advancedEpigeneticTraitSystem.md"
move_file "docs/advancedepigeneticsplan.md" "gameDesign/traits/advancedEpigeneticsPlan.md"
move_file "docs/epigeneticexpansionphase2.md" "gameDesign/traits/epigeneticExpansionPhase2.md"
move_file "docs/epigenetictraitflagsystem.md" "gameDesign/traits/epigeneticTraitFlagSystem.md"
move_file "docs/COMPREHENSIVE_TRAIT_DOCUMENTATION.md" "gameDesign/traits/comprehensiveTraitDocumentation.md"
move_file "docs/trait-modifiers.md" "gameDesign/traits/traitModifiers.md"
move_file "docs/longtermtrait.md" "gameDesign/traits/longTermTrait.md"
move_file "docs/ultrarareexotictraits.md" "gameDesign/traits/ultraRareExoticTraits.md"
move_file "docs/postmilestonetraitvalidation.md" "gameDesign/traits/postMilestoneTraitValidation.md"
move_file "docs/enhancedmilestoneeval.md" "gameDesign/traits/enhancedMilestoneEval.md"

# Game Design - Systems
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "⚙️  Migrating Game Design Documents - Systems..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
move_file "docs/groomsystem.md" "gameDesign/systems/groomSystem.md"
move_file "docs/training-system.md" "gameDesign/systems/trainingSystem.md"
move_file "plans/equoria-competition-systems-overview.md" "gameDesign/systems/competitionSystemsOverview.md"
move_file "plans/equoria-rider-systems-overview.md" "gameDesign/systems/riderSystemsOverview.md"
move_file "rules/groomprogressionpersonality.md" "gameDesign/systems/groomProgressionPersonality.md"
move_file "docs/groompersonalitytraitbonus.md" "gameDesign/systems/groomPersonalityTraitBonus.md"
move_file "docs/groomretirementreplacement.md" "gameDesign/systems/groomRetirementReplacement.md"

# Game Design - Features
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Migrating Game Design Documents - Features..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
move_file "docs/conformationshows.md" "gameDesign/features/conformationShows.md"
move_file "docs/disciplines.md" "gameDesign/features/disciplines.md"
move_file "rules/GAME_FEATURES.md" "gameDesign/features/gameFeaturesOverview.md"
move_file "rules/FOAL_ENRICHMENT_SUMMARY.md" "gameDesign/features/foalEnrichmentSummary.md"

# Category 4: Status Reports
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Migrating Status Reports..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
move_file "docs/DAY_2_TECHNICAL_REVIEW.md" "status/day2TechnicalReview.md"
move_file "docs/DAY_3_PHASE_1_SUMMARY.md" "status/day3Phase1Summary.md"
move_file "docs/systems_status_overview.md" "status/systemsStatusOverview.md"
move_file "rules/IMPLEMENTATION_SUMMARY.md" "status/implementationSummary.md"
move_file "rules/FINAL_STATUS_REPORT.md" "status/finalStatusReport.md"
move_file "docs/REMAINING_GAPS_ANALYSIS.md" "status/remainingGapsAnalysis.md"
move_file "docs/EXTERNAL_DOCUMENTATION_UPDATES.md" "status/externalDocumentationUpdates.md"
move_file "docs/CLAUDE_MD_UPDATES.md" "status/claudeMdUpdates.md"

# Category 5: Guides - Onboarding
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📚 Migrating Guides - Onboarding..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
move_file "docs/README.md" "guides/onboarding/equoriaReadme.md"
move_file "rules/README.md" "guides/onboarding/rulesReadme.md"
move_file "rules/CONTRIBUTING.md" "guides/onboarding/contributing.md"
move_file "docs/TECH_STACK_DOCUMENTATION.md" "guides/onboarding/techStackDocumentation.md"
move_file "docs/PRD_TECH_STACK_ADDENDUM.md" "guides/onboarding/prdTechStackAddendum.md"

# Guides - Development
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛠️  Migrating Guides - Development..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
move_file "docs/DEV_NOTES.md" "guides/development/devNotes.md"
move_file "rules/DEV_NOTES.md" "guides/development/rulesDevNotes.md"
move_file "docs/TODO.md" "guides/development/docsBacklog.md"
move_file "rules/TODO.md" "guides/development/rulesBacklog.md"
move_file "rules/taskplan.md" "guides/development/taskPlan.md"
move_file "rules/console_logging.md" "guides/development/consoleLogging.md"
move_file "rules/ES_MODULES_REQUIREMENTS.md" "guides/development/esModulesRequirements.md"
move_file "rules/SECURITY.md" "guides/development/security.md"
move_file "rules/SECURITY_IMPLEMENTATION_TASKS.md" "guides/development/securityImplementationTasks.md"
move_file "rules/DEPLOYMENT.md" "guides/development/deployment.md"

# Guides - Tools
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 Migrating Guides - Tools..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
move_file "docs/MCP_INSTALLATION_GUIDE.md" "guides/tools/mcpInstallationGuide.md"
move_file "docs/MCP_SERVER_STATUS.md" "guides/tools/mcpServerStatus.md"
move_file "docs/CLAUDE_CODE_RECOMMENDATIONS.md" "guides/tools/claudeCodeRecommendations.md"

# Category 6: Reference Documents
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📖 Migrating Reference Documents..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
move_file "docs/PRODUCT_REQUIREMENTS_DOCUMENT.md" "reference/productRequirementsDocument.md"
move_file "docs/equoria_specifics.markdown" "reference/equoriaSpecifics.md"
move_file "docs/project-summary.md" "reference/projectSummary.md"
move_file "docs/PROJECT_MILESTONES.md" "reference/projectMilestones.md"
move_file "rules/PROJECT_MILESTONES.md" "reference/rulesProjectMilestones.md"
move_file "rules/LICENSE.md" "reference/license.md"

# Category 7: Rules - Rename
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📜 Migrating Rules..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
move_file "rules/GENERAL_RULES.md" "rules/generalRules.md"

# Category 8: Archive
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🗃️  Archiving Old Files..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
move_file "docs/CLAUDE.md" "archive/oldProjectClaude.md"

# Move scripts to project root
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Moving Scripts..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ -d "rules/scripts" ]; then
  mv "rules/scripts" "../scripts"
  echo "✅ Moved: rules/scripts → ../scripts"
else
  echo "⚠️  Scripts folder not found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Migration complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Summary:"
find planning -name "*.md" | wc -l | xargs echo "  Planning documents:"
find architecture -name "*.md" | wc -l | xargs echo "  Architecture documents:"
find gameDesign -name "*.md" | wc -l | xargs echo "  Game design documents:"
find status -name "*.md" | wc -l | xargs echo "  Status reports:"
find guides -name "*.md" | wc -l | xargs echo "  Guides:"
find reference -name "*.md" | wc -l | xargs echo "  Reference documents:"
echo ""
echo "Next steps:"
echo "1. Review moved files"
echo "2. Remove empty folders"
echo "3. Generate index files"
